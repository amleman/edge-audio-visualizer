using System.Diagnostics;
using System.Threading;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace ScreenAudioVisualizer;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : System.Windows.Application
{
    private const string WebView2DownloadUrl = "https://developer.microsoft.com/microsoft-edge/webview2/#download-section";
    private Mutex? _singleInstanceMutex;

    protected override void OnStartup(StartupEventArgs e)
    {
        // Una sola instancia: abrir el programa dos veces crearía dos overlays encimados
        _singleInstanceMutex = new Mutex(true, "EdgeAudioVisualizer.SingleInstance", out bool isFirstInstance);
        if (!isFirstInstance)
        {
            System.Windows.MessageBox.Show(
                "Edge Audio Visualizer ya está abierto.\n\nBúscalo en la parte superior de la pantalla o en el icono junto al reloj de Windows.",
                "Edge Audio Visualizer", MessageBoxButton.OK, MessageBoxImage.Information);
            Shutdown();
            return;
        }

        // WebView2 viene con Windows 11 y casi todos los Windows 10 actualizados; si falta, explicar cómo instalarlo
        try
        {
            CoreWebView2Environment.GetAvailableBrowserVersionString();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            var result = System.Windows.MessageBox.Show(
                "Para funcionar, este programa necesita \"Microsoft Edge WebView2 Runtime\" (gratis, de Microsoft).\n\n¿Quieres abrir la página de descarga? Elige \"Evergreen Bootstrapper\", instálalo y vuelve a abrir el programa.",
                "Falta un componente de Windows", MessageBoxButton.YesNo, MessageBoxImage.Warning);
            if (result == MessageBoxResult.Yes)
            {
                Process.Start(new ProcessStartInfo(WebView2DownloadUrl) { UseShellExecute = true });
            }
            Shutdown();
            return;
        }

        base.OnStartup(e);
    }

    protected override void OnExit(ExitEventArgs e)
    {
        _singleInstanceMutex?.Dispose();
        base.OnExit(e);
    }
}
