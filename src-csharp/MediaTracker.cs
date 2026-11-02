using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Threading;
using Windows.Media.Control;
using Windows.Storage.Streams;

namespace ScreenAudioVisualizer
{
    public class MediaTrackDto
    {
        public string title { get; set; } = "";
        public string artist { get; set; } = "";
        public string album { get; set; } = "";
        public string? thumbnailUrl { get; set; }
        public bool isPlaying { get; set; }
        public string? dominantColor { get; set; }
    }

    public class MediaTracker
    {
        private GlobalSystemMediaTransportControlsSessionManager? _sessionManager;
        private readonly DispatcherTimer _pollTimer;
        public event Action<MediaTrackDto>? TrackChanged;

        private string _lastTitle = "";
        private bool _lastPlaying = false;

        public MediaTracker()
        {
            // Polling periódico cada 1 segundo para garantizar que cambios en YouTube/Chrome/Edge se detecten siempre
            _pollTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(1000)
            };
            _pollTimer.Tick += async (s, e) => await UpdateCurrentSessionAsync();
        }

        public async Task StartAsync()
        {
            try
            {
                _sessionManager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
                if (_sessionManager != null)
                {
                    _sessionManager.CurrentSessionChanged += async (s, e) => await UpdateCurrentSessionAsync();
                    _sessionManager.SessionsChanged += async (s, e) => await UpdateCurrentSessionAsync();
                    await UpdateCurrentSessionAsync();
                    _pollTimer.Start();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al inicializar Windows Media Controls: {ex.Message}");
            }
        }

        public async Task UpdateCurrentSessionAsync()
        {
            if (_sessionManager == null) return;

            try
            {
                // 1. Obtener todas las sesiones multimedia activas (Chrome, Edge, Spotify, etc.)
                var sessions = _sessionManager.GetSessions();
                GlobalSystemMediaTransportControlsSession? activeSession = null;

                // Buscar primero la que esté en estado Playing
                foreach (var session in sessions)
                {
                    try
                    {
                        var info = session.GetPlaybackInfo();
                        if (info?.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing)
                        {
                            activeSession = session;
                            break;
                        }
                    }
                    catch { }
                }

                // Si no hay una con Playing explícito, tomar GetCurrentSession o la primera disponible
                if (activeSession == null)
                {
                    activeSession = _sessionManager.GetCurrentSession() ?? sessions.FirstOrDefault();
                }

                if (activeSession == null)
                {
                    if (_lastTitle != "Audio del Sistema")
                    {
                        _lastTitle = "Audio del Sistema";
                        TrackChanged?.Invoke(new MediaTrackDto
                        {
                            title = "Audio de la PC",
                            artist = "Sistema Windows",
                            album = "",
                            thumbnailUrl = null,
                            isPlaying = true,
                            dominantColor = "#00f0ff"
                        });
                    }
                    return;
                }

                var playbackInfo = activeSession.GetPlaybackInfo();
                bool isPlaying = playbackInfo?.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;

                var mediaProperties = await activeSession.TryGetMediaPropertiesAsync();
                string title = mediaProperties?.Title ?? "";
                string artist = mediaProperties?.Artist ?? "";
                string appId = activeSession.SourceAppUserModelId ?? "";

                // Si el título está vacío, inferir por el nombre del ejecutable
                if (string.IsNullOrWhiteSpace(title))
                {
                    if (appId.Contains("chrome", StringComparison.OrdinalIgnoreCase)) title = "YouTube (Chrome)";
                    else if (appId.Contains("edge", StringComparison.OrdinalIgnoreCase)) title = "YouTube (Edge)";
                    else if (appId.Contains("firefox", StringComparison.OrdinalIgnoreCase)) title = "Navegador Web";
                    else if (appId.Contains("spotify", StringComparison.OrdinalIgnoreCase)) title = "Spotify";
                    else title = "Audio de la PC";
                }

                if (string.IsNullOrWhiteSpace(artist))
                {
                    if (appId.Contains("chrome", StringComparison.OrdinalIgnoreCase)) artist = "Google Chrome";
                    else if (appId.Contains("edge", StringComparison.OrdinalIgnoreCase)) artist = "Microsoft Edge";
                    else if (appId.Contains("spotify", StringComparison.OrdinalIgnoreCase)) artist = "Spotify";
                    else artist = "Reproductor Activo";
                }

                // Evitar notificaciones redundantes si nada cambió
                if (title == _lastTitle && isPlaying == _lastPlaying)
                {
                    return;
                }

                _lastTitle = title;
                _lastPlaying = isPlaying;

                string? base64Thumb = null;
                if (mediaProperties?.Thumbnail != null)
                {
                    try
                    {
                        using var stream = await mediaProperties.Thumbnail.OpenReadAsync();
                        using var netStream = stream.AsStreamForRead();
                        using var ms = new MemoryStream();
                        await netStream.CopyToAsync(ms);
                        byte[] bytes = ms.ToArray();
                        if (bytes.Length > 0)
                        {
                            base64Thumb = "data:image/jpeg;base64," + Convert.ToBase64String(bytes);
                        }
                    }
                    catch { }
                }

                var track = new MediaTrackDto
                {
                    title = title,
                    artist = artist,
                    album = mediaProperties?.AlbumTitle ?? "",
                    thumbnailUrl = base64Thumb,
                    isPlaying = isPlaying,
                    dominantColor = "#00f0ff"
                };

                TrackChanged?.Invoke(track);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al actualizar metadata de música: {ex.Message}");
            }
        }
    }
}
