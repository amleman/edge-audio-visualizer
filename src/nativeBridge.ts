import { AudioData, MediaTrackInfo, VisualizerSettings, DEFAULT_SETTINGS } from './types';

export type NativeMessage = 
  | { type: 'audio-frame'; data: AudioData }
  | { type: 'media-track'; data: MediaTrackInfo }
  | { type: 'settings-update'; data: VisualizerSettings };

type MessageCallback = (msg: NativeMessage) => void;

class NativeBridge {
  private listeners: Set<MessageCallback> = new Set();
  private mockInterval: number | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isMicActive = false;
  public isNative = false;

  constructor() {
    this.init();
  }

  private init() {
    // @ts-expect-error WebView2 injects window.chrome.webview
    if (typeof window !== 'undefined' && window.chrome?.webview) {
      this.isNative = true;
      // @ts-expect-error WebView2
      window.chrome.webview.addEventListener('message', (event: { data: NativeMessage | string }) => {
        let msg: NativeMessage;
        if (typeof event.data === 'string') {
          try {
            msg = JSON.parse(event.data);
          } catch {
            return;
          }
        } else {
          msg = event.data;
        }
        this.notify(msg);
      });
    } else {
      // Modo Navegador
      this.startMockAudio();
    }
  }

  public subscribe(cb: MessageCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(msg: NativeMessage) {
    this.listeners.forEach((cb) => cb(msg));
  }

  public sendSettings(settings: VisualizerSettings) {
    try {
      localStorage.setItem('edge_viz_settings', JSON.stringify(settings));
    } catch {
      // Ignorar
    }

    // @ts-expect-error WebView2
    if (this.isNative && window.chrome?.webview) {
      // @ts-expect-error WebView2
      window.chrome.webview.postMessage({
        action: 'update-settings',
        data: settings,
      });
    }
  }

  public loadStoredSettings(): VisualizerSettings {
    try {
      const stored = localStorage.getItem('edge_viz_settings');
      if (stored) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  }

  public closeApp() {
    // @ts-expect-error WebView2
    if (this.isNative && window.chrome?.webview) {
      // @ts-expect-error WebView2
      window.chrome.webview.postMessage({ action: 'close-app' });
    }
  }

  public minimizeToTray() {
    // @ts-expect-error WebView2
    if (this.isNative && window.chrome?.webview) {
      // @ts-expect-error WebView2
      window.chrome.webview.postMessage({ action: 'minimize-tray' });
    }
  }

  public toggleOverlay(visible?: boolean) {
    // @ts-expect-error WebView2
    if (this.isNative && window.chrome?.webview) {
      // @ts-expect-error WebView2
      window.chrome.webview.postMessage({ action: 'toggle-overlay', data: { visible } });
    }
  }

  public startNativeDrag() {
    // @ts-expect-error WebView2
    if (this.isNative && window.chrome?.webview) {
      // @ts-expect-error WebView2
      window.chrome.webview.postMessage({ action: 'drag-window' });
    }
  }

  public setWindowExpanded(expanded: boolean) {
    // @ts-expect-error WebView2
    if (this.isNative && window.chrome?.webview) {
      // @ts-expect-error WebView2
      window.chrome.webview.postMessage({ action: 'set-window-expanded', data: { expanded } });
    }
  }

  // Activar captura de micrófono / audio real en el navegador
  public async toggleMicrophone(): Promise<boolean> {
    if (this.isMicActive) {
      this.stopMicrophone();
      this.startMockAudio();
      return false;
    }

    try {
      if (this.mockInterval) {
        clearInterval(this.mockInterval);
        this.mockInterval = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.mediaStream = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(stream);

      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      this.analyser = analyser;

      this.isMicActive = true;
      this.pollWebAudio();

      this.notify({
        type: 'media-track',
        data: {
          title: 'Micrófono / Entrada de Audio Activa',
          artist: 'Web Audio API',
          album: 'Entrada en tiempo real',
          thumbnailUrl: null,
          isPlaying: true,
          dominantColor: '#ff0055',
        },
      });

      return true;
    } catch (err) {
      console.warn('No se pudo acceder al micrófono:', err);
      this.startMockAudio();
      return false;
    }
  }

  private pollWebAudio = () => {
    if (!this.isMicActive || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const frequencies: number[] = [];
    for (let i = 0; i < 64; i++) {
      const idx = Math.floor((i / 64) * bufferLength);
      frequencies.push((dataArray[idx] || 0) / 255.0);
    }

    const bass = frequencies.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
    const mid = frequencies.slice(8, 30).reduce((a, b) => a + b, 0) / 22;
    const treble = frequencies.slice(30, 64).reduce((a, b) => a + b, 0) / 34;
    const volume = (bass * 0.5 + mid * 0.3 + treble * 0.2);

    this.notify({
      type: 'audio-frame',
      data: {
        frequencies,
        bass,
        mid,
        treble,
        volume,
        isSilent: volume < 0.02,
      },
    });

    requestAnimationFrame(this.pollWebAudio);
  };

  private stopMicrophone() {
    this.isMicActive = false;
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  public isUsingMic() {
    return this.isMicActive;
  }

  private startMockAudio() {
    if (this.mockInterval) return;

    let phase = 0;
    this.mockInterval = window.setInterval(() => {
      phase += 0.08;
      const beat = Math.pow(Math.max(0, Math.sin(phase * 2.2)), 4);
      const frequencies: number[] = [];

      for (let i = 0; i < 64; i++) {
        const fNorm = i / 64;
        let amp = 0;
        if (fNorm < 0.15) {
          amp = beat * 0.95 + Math.sin(phase * 4 + i) * 0.15;
        } else if (fNorm < 0.5) {
          amp = (Math.sin(phase * 3 + i * 0.8) * 0.5 + 0.5) * (0.3 + beat * 0.45);
        } else {
          amp = (Math.sin(phase * 5 + i * 1.5) * 0.5 + 0.5) * (0.2 + beat * 0.3);
        }
        frequencies.push(Math.min(1.0, Math.max(0, amp)));
      }

      const bass = beat * 0.9;
      const mid = frequencies.slice(10, 30).reduce((a, b) => a + b, 0) / 20;
      const treble = frequencies.slice(30, 60).reduce((a, b) => a + b, 0) / 30;
      const volume = (bass * 0.5 + mid * 0.3 + treble * 0.2);

      this.notify({
        type: 'audio-frame',
        data: {
          frequencies,
          bass,
          mid,
          treble,
          volume,
          isSilent: false,
        },
      });
    }, 1000 / 60);

    setTimeout(() => {
      this.notify({
        type: 'media-track',
        data: {
          title: 'Cyber City Nights (Simulado)',
          artist: 'Neon Waveform',
          album: 'Synth Resonance 2026',
          thumbnailUrl: null,
          isPlaying: true,
          dominantColor: '#ff0055',
        },
      });
    }, 400);
  }
}

export const nativeBridge = new NativeBridge();
