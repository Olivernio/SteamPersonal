using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using SteamPersonal.Services;

namespace SteamPersonal
{
    static class Program
    {
        private static WebView2? _webView;
        private static GameDownloaderService _downloader = new GameDownloaderService();

        [STAThread]
        static void Main()
        {
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Crear ventana de Windows personalizada
            var mainForm = new Form
            {
                Text = "Steam Personal",
                Width = 1280,
                Height = 800,
                StartPosition = FormStartPosition.CenterScreen,
                FormBorderStyle = FormFormBorderStyle.Sizable
            };

            _webView = new WebView2 { Dock = DockStyle.Fill };
            mainForm.Controls.Add(_webView);

            mainForm.Load += async (s, e) => await InitializeWebViewAsync();

            Application.Run(mainForm);
        }

        private static async Task InitializeWebViewAsync()
        {
            if (_webView == null) return;

            // Inicializar el entorno de WebView2
            await _webView.EnsureCoreWebView2Async();

            // Configurar ruta local de wwwroot
            string wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
            
            // Si el frontend fue compilado con Vite/npm build, apuntamos al index.html
            string indexPath = Path.Combine(wwwrootPath, "index.html");

            if (File.Exists(indexPath))
            {
                _webView.Source = new Uri(indexPath);
            }
            else
            {
                // Si estás corriendo Vite en modo desarrollo (npm run dev)
                _webView.Source = new Uri("http://localhost:5173");
            }

            // Escuchar mensajes enviados desde JavaScript en React
            _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            // Escuchar eventos del motor de descarga C# y retransmitirlos al Frontend
            _downloader.ProgressChanged += (s, e) =>
            {
                var payload = new
                {
                    type = "DOWNLOAD_PROGRESS",
                    progress = e.ProgressPercentage,
                    downloaded = e.BytesDownloaded,
                    total = e.TotalBytes,
                    file = e.CurrentFile,
                    status = e.Status
                };

                SendToFrontend(payload);
            };

            _downloader.DownloadCompleted += (s, dest) =>
            {
                SendToFrontend(new { type = "DOWNLOAD_COMPLETED", destination = dest });
            };
        }

        // Manejador de comandos desde JavaScript
        private static async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            try
            {
                string json = e.WebMessageAsJson;
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                string action = root.GetProperty("action").GetString() ?? "";

                if (action == "START_DOWNLOAD")
                {
                    string url = root.GetProperty("url").GetString() ?? "";
                    string targetFolder = Path.Combine(Directory.GetCurrentDirectory(), "JuegoExtraido");
                    
                    _ = _downloader.StartDownloadAndExtractAsync(url, targetFolder);
                }
                else if (action == "PAUSE_DOWNLOAD")
                {
                    _downloader.Pause();
                }
                else if (action == "RESUME_DOWNLOAD")
                {
                    _downloader.Resume();
                }
                else if (action == "CANCEL_DOWNLOAD")
                {
                    _downloader.Cancel();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al procesar mensaje de JS: {ex.Message}");
            }
        }

        private static void SendToFrontend(object data)
        {
            if (_webView != null && _webView.InvokeRequired)
            {
                _webView.Invoke(new Action(() => SendToFrontend(data)));
                return;
            }

            if (_webView?.CoreWebView2 != null)
            {
                string json = JsonSerializer.Serialize(data);
                _webView.CoreWebView2.PostWebMessageAsJson(json);
            }
        }
    }
}