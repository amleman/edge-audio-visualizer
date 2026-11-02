using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using Microsoft.Web.WebView2.Core;

namespace ScreenAudioVisualizer
{
    public partial class OverlayWindow : Window
    {
        private bool _isReady = false;

        public OverlayWindow()
        {
            InitializeComponent();
            Loaded += OnLoaded;
            SourceInitialized += OnSourceInitialized;
        }

        private void OnSourceInitialized(object? sender, EventArgs e)
        {
            // Habilitar click-through total: los clics pasan a cualquier ventana debajo
            var hwnd = new WindowInteropHelper(this).Handle;
            Win32Helper.EnableClickThrough(hwnd);
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            try
            {
                webView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(0, 0, 0, 0);

                string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ScreenAudioVisualizer", "OverlayWV2");
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await webView.EnsureCoreWebView2Async(env);

                // Configurar fondo 100% transparente en el WebView
                webView.DefaultBackgroundColor = System.Drawing.Color.FromArgb(0, 0, 0, 0);
                webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
                webView.CoreWebView2.Settings.AreDevToolsEnabled = false;

                // Buscar carpeta dist
                string[] possibleDirs = new[]
                {
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist"),
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "dist"),
                    Path.Combine(Directory.GetCurrentDirectory(), "dist")
                };

                string? validDist = possibleDirs.Select(Path.GetFullPath).FirstOrDefault(d => File.Exists(Path.Combine(d, "index.html")));

                if (!string.IsNullOrEmpty(validDist))
                {
                    webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "visualizer.overlay",
                        validDist,
                        CoreWebView2HostResourceAccessKind.Allow
                    );
                    webView.CoreWebView2.Navigate("https://visualizer.overlay/index.html?mode=overlay");
                }
                else
                {
                    webView.CoreWebView2.Navigate("http://localhost:1420?mode=overlay");
                }

                _isReady = true;
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Error al cargar overlay: {ex.Message}");
            }
        }

        public void SendAudioFrame(AudioFrameDto frame)
        {
            if (!_isReady || webView.CoreWebView2 == null) return;

            try
            {
                var payload = new
                {
                    type = "audio-frame",
                    data = frame
                };
                string json = JsonSerializer.Serialize(payload);
                webView.CoreWebView2.PostWebMessageAsJson(json);
            }
            catch { }
        }

        public void SendSettings(string settingsJson)
        {
            if (!_isReady || webView.CoreWebView2 == null) return;

            try
            {
                var payload = new
                {
                    type = "settings-update",
                    data = JsonDocument.Parse(settingsJson).RootElement
                };
                string json = JsonSerializer.Serialize(payload);
                webView.CoreWebView2.PostWebMessageAsJson(json);
            }
            catch { }
        }

        public void SendMediaTrack(MediaTrackDto track)
        {
            if (!_isReady || webView.CoreWebView2 == null) return;

            try
            {
                var payload = new
                {
                    type = "media-track",
                    data = track
                };
                string json = JsonSerializer.Serialize(payload);
                webView.CoreWebView2.PostWebMessageAsJson(json);
            }
            catch { }
        }
    }
}
