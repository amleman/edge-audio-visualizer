using System;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Forms = System.Windows.Forms;

namespace ScreenAudioVisualizer
{
    public partial class MainWindow : Window
    {
        private OverlayWindow? _overlayWindow;
        private AudioEngine? _audioEngine;
        private MediaTracker? _mediaTracker;
        private Forms.NotifyIcon? _notifyIcon;
        private bool _isControlReady = false;

        private AudioFrameDto? _latestFrame;
        private MediaTrackDto? _latestTrack;
        private readonly DispatcherTimer _renderTimer;

        public MainWindow()
        {
            InitializeComponent();

            _renderTimer = new DispatcherTimer(DispatcherPriority.Render)
            {
                Interval = TimeSpan.FromMilliseconds(16) // ~60 FPS
            };
            _renderTimer.Tick += OnRenderTick;

            Loaded += OnLoaded;
            Closing += OnClosing;
        }

        private async void OnLoaded(object sender, RoutedEventArgs e)
        {
            // 1. Iniciar Overlay Window primero
            _overlayWindow = new OverlayWindow();
            _overlayWindow.Show();

            // 2. Posicionar la ventana arriba en el centro (Dynamic Island compacta)
            Width = 440;
            Height = 56;
            Left = Math.Max(0, (SystemParameters.PrimaryScreenWidth - Width) / 2);
            Top = 8;

            // Poner MainWindow en el tope absoluto de la pila
            Topmost = false;
            Topmost = true;
            Activate();

            // 3. Iniciar Tray Icon
            InitTrayIcon();

            // 4. Iniciar WebView2 para el Control Center con transparencia
            try
            {
                webViewControl.DefaultBackgroundColor = System.Drawing.Color.FromArgb(0, 0, 0, 0);

                string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ScreenAudioVisualizer", "ControlWV2");
                var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
                await webViewControl.EnsureCoreWebView2Async(env);

                webViewControl.DefaultBackgroundColor = System.Drawing.Color.FromArgb(0, 0, 0, 0);
                webViewControl.CoreWebView2.Settings.IsStatusBarEnabled = false;
                webViewControl.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;

                webViewControl.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

                string[] possibleDirs = new[]
                {
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "dist"),
                    Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "dist"),
                    Path.Combine(Directory.GetCurrentDirectory(), "dist")
                };

                string? validDist = possibleDirs.Select(Path.GetFullPath).FirstOrDefault(d => File.Exists(Path.Combine(d, "index.html")));

                if (!string.IsNullOrEmpty(validDist))
                {
                    webViewControl.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "visualizer.control",
                        validDist,
                        CoreWebView2HostResourceAccessKind.Allow
                    );
                    webViewControl.CoreWebView2.Navigate("https://visualizer.control/index.html?mode=control");
                }
                else
                {
                    webViewControl.CoreWebView2.Navigate("http://localhost:1420?mode=control");
                }

                _isControlReady = true;
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"Error al cargar el panel de control: {ex.Message}");
            }

            // 5. Iniciar Audio Engine
            _audioEngine = new AudioEngine();
            _audioEngine.FrameAvailable += (frame) =>
            {
                _latestFrame = frame;
            };
            _audioEngine.Start();

            // 6. Iniciar Media Tracker (Windows Media Controls & YouTube)
            _mediaTracker = new MediaTracker();
            _mediaTracker.TrackChanged += (track) =>
            {
                _latestTrack = track;
                Dispatcher.Invoke(() =>
                {
                    _overlayWindow?.SendMediaTrack(track);
                    SendTrackToControl(track);
                });
            };
            await _mediaTracker.StartAsync();

            _renderTimer.Start();
        }

        private void OnRenderTick(object? sender, EventArgs e)
        {
            if (_latestFrame != null)
            {
                _overlayWindow?.SendAudioFrame(_latestFrame);

                if (_isControlReady && webViewControl.CoreWebView2 != null && IsVisible)
                {
                    try
                    {
                        var payload = new
                        {
                            type = "audio-frame",
                            data = _latestFrame
                        };
                        webViewControl.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
                    }
                    catch { }
                }
            }
        }

        private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                using var doc = JsonDocument.Parse(e.WebMessageAsJson);
                var root = doc.RootElement;
                if (!root.TryGetProperty("action", out var actionProp)) return;

                string action = actionProp.GetString() ?? "";

                switch (action)
                {
                    case "set-window-expanded":
                        if (root.TryGetProperty("data", out var expData) && expData.TryGetProperty("expanded", out var expProp))
                        {
                            bool expanded = expProp.GetBoolean();
                            Dispatcher.Invoke(() =>
                            {
                                if (expanded)
                                {
                                    Width = 660;
                                    Height = 820;
                                    Left = Math.Max(0, (SystemParameters.PrimaryScreenWidth - Width) / 2);
                                    Top = 8;
                                }
                                else
                                {
                                    Width = 440;
                                    Height = 56;
                                    Left = Math.Max(0, (SystemParameters.PrimaryScreenWidth - Width) / 2);
                                    Top = 8;
                                }
                                Topmost = false;
                                Topmost = true;
                                Activate();
                            });
                        }
                        break;

                    case "drag-window":
                        Dispatcher.Invoke(() =>
                        {
                            try
                            {
                                if (Forms.Control.MouseButtons == Forms.MouseButtons.Left)
                                {
                                    DragMove();
                                }
                            }
                            catch { }
                        });
                        break;

                    case "update-settings":
                        if (root.TryGetProperty("data", out var dataProp))
                        {
                            string rawJson = dataProp.GetRawText();
                            _overlayWindow?.SendSettings(rawJson);

                            if (dataProp.TryGetProperty("sensitivity", out var sensProp))
                            {
                                if (sensProp.TryGetSingle(out float sens) && _audioEngine != null)
                                {
                                    _audioEngine.Sensitivity = sens;
                                }
                            }
                            if (dataProp.TryGetProperty("smoothing", out var smoothProp))
                            {
                                if (smoothProp.TryGetSingle(out float smooth) && _audioEngine != null)
                                {
                                    _audioEngine.Smoothing = smooth;
                                }
                            }
                        }
                        break;

                    case "minimize-tray":
                        Hide();
                        _notifyIcon?.ShowBalloonTip(1500, "Edge Audio Visualizer", "La visualización sigue activa en tus bordes. Clic aquí para reabrir ajustes.", Forms.ToolTipIcon.Info);
                        break;

                    case "close-app":
                        Close();
                        break;

                    case "toggle-overlay":
                        if (_overlayWindow != null)
                        {
                            if (_overlayWindow.IsVisible)
                                _overlayWindow.Hide();
                            else
                                _overlayWindow.Show();
                        }
                        break;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error procesando mensaje web: {ex.Message}");
            }
        }

        private void SendTrackToControl(MediaTrackDto track)
        {
            if (!_isControlReady || webViewControl.CoreWebView2 == null) return;
            try
            {
                var payload = new
                {
                    type = "media-track",
                    data = track
                };
                webViewControl.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(payload));
            }
            catch { }
        }

        private void InitTrayIcon()
        {
            _notifyIcon = new Forms.NotifyIcon
            {
                Text = "Edge Audio Visualizer",
                // Icono embebido en el .exe (ApplicationIcon en el .csproj)
                Icon = (Environment.ProcessPath != null ? System.Drawing.Icon.ExtractAssociatedIcon(Environment.ProcessPath) : null) ?? SystemIcons.Application,
                Visible = true
            };

            var contextMenu = new Forms.ContextMenuStrip();
            contextMenu.Items.Add("Abrir Opciones", null, (s, a) =>
            {
                Show();
                WindowState = WindowState.Normal;
                Topmost = true;
                Activate();
            });

            contextMenu.Items.Add("Alternar Overlay", null, (s, a) =>
            {
                if (_overlayWindow != null)
                {
                    if (_overlayWindow.IsVisible) _overlayWindow.Hide();
                    else _overlayWindow.Show();
                }
            });

            contextMenu.Items.Add(new Forms.ToolStripSeparator());

            contextMenu.Items.Add("Salir", null, (s, a) =>
            {
                Close();
            });

            _notifyIcon.ContextMenuStrip = contextMenu;
            _notifyIcon.DoubleClick += (s, a) =>
            {
                Show();
                WindowState = WindowState.Normal;
                Topmost = true;
                Activate();
            };
        }

        private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
        {
            _renderTimer.Stop();
            _audioEngine?.Dispose();
            _overlayWindow?.Close();
            if (_notifyIcon != null)
            {
                _notifyIcon.Visible = false;
                _notifyIcon.Dispose();
            }
            System.Windows.Application.Current.Shutdown();
        }
    }
}
