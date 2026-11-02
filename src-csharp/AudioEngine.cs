using System;
using System.Numerics;
using NAudio.Wave;

namespace ScreenAudioVisualizer
{
    public class AudioFrameDto
    {
        public float[] frequencies { get; set; } = new float[64];
        public float bass { get; set; }
        public float mid { get; set; }
        public float treble { get; set; }
        public float volume { get; set; }
        public bool isSilent { get; set; }
    }

    public class AudioEngine : IDisposable
    {
        private WasapiLoopbackCapture? _capture;
        private readonly float[] _fftBuffer = new float[1024];
        private int _bufferPos = 0;
        private readonly object _lock = new();

        private readonly float[] _currentBands = new float[64];
        private readonly float[] _hannWindow = new float[1024];

        public float Sensitivity { get; set; } = 1.0f;
        public float Smoothing { get; set; } = 0.82f; // Decay factor (0.0 a 0.95)

        public event Action<AudioFrameDto>? FrameAvailable;

        public AudioEngine()
        {
            // Precalcular ventana de Hann
            for (int i = 0; i < 1024; i++)
            {
                _hannWindow[i] = 0.5f * (1.0f - (float)Math.Cos(2.0 * Math.PI * i / 1023.0));
            }
        }

        public void Start()
        {
            try
            {
                _capture = new WasapiLoopbackCapture();
                _capture.DataAvailable += OnDataAvailable;
                _capture.RecordingStopped += (s, a) => { };
                _capture.StartRecording();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al iniciar captura de audio: {ex.Message}");
            }
        }

        private void OnDataAvailable(object? sender, WaveInEventArgs e)
        {
            if (_capture == null || e.BytesRecorded == 0) return;

            var waveFormat = _capture.WaveFormat;
            int channels = waveFormat.Channels;
            bool isFloat = waveFormat.Encoding == WaveFormatEncoding.IeeeFloat;

            lock (_lock)
            {
                if (isFloat)
                {
                    int sampleCount = e.BytesRecorded / 4;
                    for (int i = 0; i < sampleCount; i += channels)
                    {
                        float sample = BitConverter.ToSingle(e.Buffer, i * 4);
                        _fftBuffer[_bufferPos++] = sample;

                        if (_bufferPos >= 1024)
                        {
                            ProcessFFT();
                            _bufferPos = 0;
                        }
                    }
                }
                else
                {
                    int sampleCount = e.BytesRecorded / 2;
                    for (int i = 0; i < sampleCount; i += channels)
                    {
                        short sample = BitConverter.ToInt16(e.Buffer, i * 2);
                        _fftBuffer[_bufferPos++] = sample / 32768.0f;

                        if (_bufferPos >= 1024)
                        {
                            ProcessFFT();
                            _bufferPos = 0;
                        }
                    }
                }
            }
        }

        private void ProcessFFT()
        {
            Complex[] complexBuffer = new Complex[1024];
            float rmsSum = 0;

            for (int i = 0; i < 1024; i++)
            {
                float val = _fftBuffer[i] * _hannWindow[i];
                complexBuffer[i] = new Complex(val, 0);
                rmsSum += val * val;
            }

            float volume = (float)Math.Sqrt(rmsSum / 1024.0f) * 2.0f * Sensitivity;
            volume = Math.Clamp(volume, 0.0f, 1.0f);

            // Ejecutar FFT Radix-2
            FFT(complexBuffer);

            // Mapear los primeros 512 bins en 64 bandas logarítmicas con rango dinámico limpio
            float[] newBands = new float[64];
            int nyquistBins = 512;

            for (int band = 0; band < 64; band++)
            {
                // Escala logarítmica (distribución musical de octavas)
                double lowFrac = Math.Pow(band / 64.0, 2.3);
                double highFrac = Math.Pow((band + 1) / 64.0, 2.3);

                int startBin = Math.Clamp((int)(lowFrac * nyquistBins), 0, nyquistBins - 1);
                int endBin = Math.Clamp((int)(highFrac * nyquistBins), startBin + 1, nyquistBins);

                float bandEnergy = 0;
                for (int b = startBin; b < endBin; b++)
                {
                    // Normalización adecuada al tamaño de ventana FFT (1024 / 4 = 256)
                    float mag = (float)complexBuffer[b].Magnitude / 256.0f;
                    bandEnergy += mag;
                }
                bandEnergy /= (endBin - startBin);

                // Compensación progresiva para agudos (curva isofónica simplificada)
                float freqBoost = 1.0f + (band * 0.035f);
                
                // Rango dinámico suave y reactivo con curva perceptual gamma (evita saturación en 1.0)
                float normalized = Math.Clamp((float)Math.Pow(bandEnergy * 5.0f * freqBoost * Sensitivity, 0.75), 0.0f, 1.0f);

                // Decay suave estilo ecualizador profesional
                _currentBands[band] = Math.Max(normalized, _currentBands[band] * Smoothing);
                newBands[band] = _currentBands[band];
            }

            // Segmentar en Bass (0-7), Mid (8-28), Treble (29-63)
            float bassSum = 0;
            for (int i = 0; i < 8; i++) bassSum += newBands[i];
            float bass = Math.Clamp(bassSum / 8.0f, 0.0f, 1.0f);

            float midSum = 0;
            for (int i = 8; i < 29; i++) midSum += newBands[i];
            float mid = Math.Clamp(midSum / 21.0f, 0.0f, 1.0f);

            float trebleSum = 0;
            for (int i = 29; i < 64; i++) trebleSum += newBands[i];
            float treble = Math.Clamp(trebleSum / 35.0f, 0.0f, 1.0f);

            bool isSilent = volume < 0.003f && bass < 0.003f;

            var frame = new AudioFrameDto
            {
                frequencies = (float[])newBands.Clone(),
                bass = bass,
                mid = mid,
                treble = treble,
                volume = volume,
                isSilent = isSilent
            };

            FrameAvailable?.Invoke(frame);
        }

        private static void FFT(Complex[] buffer)
        {
            int n = buffer.Length;
            if (n <= 1) return;

            int j = 0;
            for (int i = 0; i < n - 1; i++)
            {
                if (i < j)
                {
                    var temp = buffer[i];
                    buffer[i] = buffer[j];
                    buffer[j] = temp;
                }
                int k = n / 2;
                while (k <= j)
                {
                    j -= k;
                    k /= 2;
                }
                j += k;
            }

            for (int len = 2; len <= n; len <<= 1)
            {
                double angle = -2 * Math.PI / len;
                Complex wlen = new Complex(Math.Cos(angle), Math.Sin(angle));
                for (int i = 0; i < n; i += len)
                {
                    Complex w = 1.0;
                    for (int k = 0; k < len / 2; k++)
                    {
                        Complex u = buffer[i + k];
                        Complex v = buffer[i + k + len / 2] * w;
                        buffer[i + k] = u + v;
                        buffer[i + k + len / 2] = u - v;
                        w *= wlen;
                    }
                }
            }
        }

        public void Dispose()
        {
            try
            {
                _capture?.StopRecording();
                _capture?.Dispose();
            }
            catch { }
        }
    }
}
