using System;
using System.Drawing;
using System.IO;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;
using SteamPersonal.Services;

namespace SteamPersonal
{
    public class CustomMainForm : Form
    {
        private const int WM_NCHITTEST = 0x84;
        private const int HTCLIENT = 0x1;
        private const int HTCAPTION = 0x2;
        private const int HTLEFT = 10;
        private const int HTRIGHT = 11;
        private const int HTTOP = 12;
        private const int HTTOPLEFT = 13;
        private const int HTTOPRIGHT = 14;
        private const int HTBOTTOM = 15;
        private const int HTBOTTOMLEFT = 16;
        private const int HTBOTTOMRIGHT = 17;

        public CustomMainForm()
        {
            Text = "Steam Personal";
            Width = 1280;
            Height = 800;
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.None;
            DoubleBuffered = true;
        }

        protected override void WndProc(ref Message m)
        {
            base.WndProc(ref m);

            if (m.Msg == WM_NCHITTEST)
            {
                // Enable resizing borders even with FormBorderStyle.None
                Point pos = PointToClient(new Point(m.LParam.ToInt32()));
                int border = 6;

                if (pos.X <= border)
                {
                    if (pos.Y <= border) m.Result = (IntPtr)HTTOPLEFT;
                    else if (pos.Y >= ClientSize.Height - border) m.Result = (IntPtr)HTBOTTOMLEFT;
                    else m.Result = (IntPtr)HTLEFT;
                }
                else if (pos.X >= ClientSize.Width - border)
                {
                    if (pos.Y <= border) m.Result = (IntPtr)HTTOPRIGHT;
                    else if (pos.Y >= ClientSize.Height - border) m.Result = (IntPtr)HTBOTTOMRIGHT;
                    else m.Result = (IntPtr)HTRIGHT;
                }
                else if (pos.Y >= ClientSize.Height - border)
                {
                    m.Result = (IntPtr)HTBOTTOM;
                }
                else if (pos.Y <= border)
                {
                    m.Result = (IntPtr)HTTOP;
                }
            }
        }
    }

    static class Program
    {
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);

        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HT_CAPTION = 0x2;

        private static CustomMainForm? _mainForm;
        private static WebView2? _webView;
        private static GameDownloaderService _downloader = new GameDownloaderService();
        private static GameRecipeService _recipeService = new GameRecipeService(_downloader);
        private static GameLauncherService _launcher = new GameLauncherService();
        private static SavegameService _savegameService = new SavegameService();
        private static SteamPersonal.Services.Achievements.AchievementService _achievementService = new SteamPersonal.Services.Achievements.AchievementService();
        private static string _currentGameTitle = "Descarga Activa";

        [STAThread]
        static void Main()
        {
            SteamPersonal.Services.SettingsManager.Load();
            Application.SetHighDpiMode(HighDpiMode.SystemAware);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            _mainForm = new CustomMainForm();

            _webView = new WebView2 { Dock = DockStyle.Fill };
            _mainForm.Controls.Add(_webView);

            _mainForm.Load += async (s, e) => await InitializeWebViewAsync();

            Application.Run(_mainForm);
        }

        private static bool _isWebViewInitialized = false;

        private static async Task InitializeWebViewAsync()
        {
            if (_webView == null || _isWebViewInitialized) return;
            _isWebViewInitialized = true;

            try
            {
                if (_webView.CoreWebView2 == null)
                {
                    await _webView.EnsureCoreWebView2Async(null);
                }

                _webView.CoreWebView2.WebMessageReceived -= OnWebMessageReceived;
                _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

                // Detectar si el servidor de desarrollo de Vite (npm run dev) está activo
                if (await IsViteDevServerRunningAsync())
                {
                    _webView.CoreWebView2.Navigate("http://localhost:5173");
                }
                else
                {
                    // Si no hay servidor dev, cargar bundle estático empaquetado (dist o wwwroot)
                    string wwwrootPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "wwwroot");
                    string distPath = Path.Combine(wwwrootPath, "dist");
                    string targetFolder = Directory.Exists(distPath) ? distPath : wwwrootPath;

                    _webView.CoreWebView2.SetVirtualHostNameToFolderMapping(
                        "steam.local",
                        targetFolder,
                        CoreWebView2HostResourceAccessKind.Allow
                    );

                    _webView.CoreWebView2.Navigate("http://steam.local/index.html");
                }

                // Escuchar eventos del motor de descarga C# y retransmitirlos al Frontend
                _downloader.ProgressChanged += (s, e) =>
                {
                    var payload = new
                    {
                        type = "DOWNLOAD_PROGRESS",
                        progress = e.ProgressPercentage,
                        downloaded = e.BytesDownloaded,
                        total = e.TotalBytes,
                        speed = e.Speed,
                        file = e.CurrentFile,
                        status = e.Status,
                        filesCompleted = e.FilesCompleted,
                        gameTitle = _currentGameTitle
                    };

                    SendToFrontend(payload);
                };

                _downloader.DownloadCompleted += (s, dest) =>
                {
                    SendToFrontend(new { type = "DOWNLOAD_COMPLETED", destination = dest });
                };

                _downloader.DownloadFailed += (s, ex) =>
                {
                    SendToFrontend(new { type = "DOWNLOAD_FAILED", error = ex.Message });
                };

                // Escuchar eventos del lanzador de juegos
                _launcher.GameStarted += (s, gameTitle) =>
                {
                    SendToFrontend(new { type = "GAME_STARTED", gameTitle });
                };

                _launcher.GameExited += (s, e) =>
                {
                    _achievementService.StopMonitoring();
                    SendToFrontend(new { type = "GAME_EXITED", gameTitle = e.GameTitle, sessionMinutes = e.SessionMinutes });
                };

                _launcher.LaunchFailed += (s, err) =>
                {
                    _achievementService.StopMonitoring();
                    SendToFrontend(new { type = "LAUNCH_FAILED", error = err });
                };

                // Escuchar eventos de Logros desbloqueados en tiempo real
                _achievementService.AchievementUnlocked += (s, e) =>
                {
                    SendToFrontend(new
                    {
                        type = "ACHIEVEMENT_UNLOCKED",
                        gameKey = e.GameKey,
                        appId = e.AppId,
                        achievement = new
                        {
                            apiName = e.Achievement.ApiName,
                            displayName = e.Achievement.DisplayName,
                            description = e.Achievement.Description,
                            iconUrl = e.Achievement.IconUrl,
                            iconGrayUrl = e.Achievement.IconGrayUrl,
                            unlocked = e.Achievement.Unlocked,
                            unlockTime = e.Achievement.UnlockTime?.ToString("o")
                        }
                    });
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WebView2] Advertencia en inicialización: {ex.Message}");
            }
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

                if (action == "MINIMIZE_WINDOW")
                {
                    _mainForm?.Invoke(new Action(() => _mainForm.WindowState = FormWindowState.Minimized));
                }
                else if (action == "MAXIMIZE_WINDOW")
                {
                    _mainForm?.Invoke(new Action(() =>
                    {
                        if (_mainForm.WindowState == FormWindowState.Maximized)
                            _mainForm.WindowState = FormWindowState.Normal;
                        else
                            _mainForm.WindowState = FormWindowState.Maximized;
                    }));
                }
                else if (action == "CLOSE_WINDOW")
                {
                    _mainForm?.Invoke(new Action(() => _mainForm.Close()));
                }
                else if (action == "GET_SETTINGS")
                {
                    var settings = SteamPersonal.Services.SettingsManager.Current;
                    SendToFrontend(new
                    {
                        type = "SETTINGS_LOADED",
                        settings = new
                        {
                            steamApiKey = settings.SteamApiKey,
                            showBuildId = settings.ShowBuildId,
                            enableDynamicBackgrounds = settings.EnableDynamicBackgrounds,
                            bgImageDurationMs = settings.BgImageDurationMs,
                            bgFadeDurationMs = settings.BgFadeDurationMs
                        }
                    });
                }
                else if (action == "SAVE_SETTINGS")
                {
                    if (root.TryGetProperty("settings", out var settingsProp))
                    {
                        var settings = SteamPersonal.Services.SettingsManager.Current;
                        if (settingsProp.TryGetProperty("steamApiKey", out var keyProp))
                        {
                            settings.SteamApiKey = keyProp.GetString() ?? "";
                        }
                        if (settingsProp.TryGetProperty("showBuildId", out var showBuildProp) && showBuildProp.ValueKind == System.Text.Json.JsonValueKind.True)
                        {
                            settings.ShowBuildId = true;
                        }
                        else
                        {
                            settings.ShowBuildId = false;
                        }

                        if (settingsProp.TryGetProperty("enableDynamicBackgrounds", out var enableBgProp) && enableBgProp.ValueKind == System.Text.Json.JsonValueKind.True)
                        {
                            settings.EnableDynamicBackgrounds = true;
                        }
                        else if (settingsProp.TryGetProperty("enableDynamicBackgrounds", out var enableBgPropFalse) && enableBgPropFalse.ValueKind == System.Text.Json.JsonValueKind.False)
                        {
                            settings.EnableDynamicBackgrounds = false;
                        }

                        if (settingsProp.TryGetProperty("bgImageDurationMs", out var bgImageDurProp) && bgImageDurProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                        {
                            settings.BgImageDurationMs = bgImageDurProp.GetInt32();
                        }
                        
                        if (settingsProp.TryGetProperty("bgFadeDurationMs", out var bgFadeDurProp) && bgFadeDurProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                        {
                            settings.BgFadeDurationMs = bgFadeDurProp.GetInt32();
                        }

                        SteamPersonal.Services.SettingsManager.Save(settings);
                    }
                }
                else if (action == "DRAG_WINDOW")
                {
                    _mainForm?.Invoke(new Action(() =>
                    {
                        if (_mainForm != null && _mainForm.WindowState != FormWindowState.Maximized)
                        {
                            ReleaseCapture();
                            SendMessage(_mainForm.Handle, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
                        }
                    }));
                }
                else if (action == "START_DOWNLOAD")
                {
                    string url = root.GetProperty("url").GetString() ?? "";
                    if (root.TryGetProperty("gameTitle", out var titleProp))
                    {
                        _currentGameTitle = titleProp.GetString() ?? "Descarga Activa";
                    }

                    string version = "1.0.0";
                    if (root.TryGetProperty("version", out var versionProp))
                    {
                        version = versionProp.GetString() ?? "1.0.0";
                    }

                    var recipe = new SteamPersonal.Services.Models.InstallationRecipe
                    {
                        Title = _currentGameTitle,
                        LatestOfficialVersion = version
                    };

                    _ = _recipeService.ExecuteRecipeAsync(recipe, url);
                }
                else if (action == "CHECK_INSTALLATIONS")
                {
                    var gamesArray = root.GetProperty("games").EnumerateArray();
                    var installedMap = new Dictionary<string, string>();
                    var installations = new Dictionary<string, object>();
                    string juegosDir = Path.Combine(Directory.GetCurrentDirectory(), "Juegos");

                    if (!Directory.Exists(juegosDir))
                    {
                        Directory.CreateDirectory(juegosDir);
                    }

                    var allJuegosFolders = Directory.GetDirectories(juegosDir);

                    foreach (var game in gamesArray)
                    {
                        string title = game.GetString() ?? "";
                        if (string.IsNullOrEmpty(title)) continue;

                        string safeTitle = string.Concat(title.Split(Path.GetInvalidFileNameChars())).Trim();
                        string gameDir = Path.Combine(juegosDir, safeTitle);
                        
                        var installedVersions = new List<string>();
                        var pathsMap = new Dictionary<string, string>();

                        // Check main folder: Juegos/<SafeTitle>
                        if (Directory.Exists(gameDir))
                        {
                            // 1. Check if there are version subdirectories (e.g. Juegos/<SafeTitle>/v1.0, v1.1)
                            var subDirs = Directory.GetDirectories(gameDir);
                            bool foundSubVersions = false;

                            foreach (var subDir in subDirs)
                            {
                                string? exeInSub = GameLauncherService.FindMainExecutable(subDir);
                                if (!string.IsNullOrEmpty(exeInSub))
                                {
                                    string versionFile = Path.Combine(subDir, "version.txt");
                                    string vName = File.Exists(versionFile)
                                        ? File.ReadAllText(versionFile).Trim()
                                        : Path.GetFileName(subDir);

                                    if (!string.IsNullOrEmpty(vName) && !installedVersions.Contains(vName))
                                    {
                                        installedVersions.Add(vName);
                                        pathsMap[vName] = subDir;
                                        foundSubVersions = true;
                                    }
                                }
                            }

                            // 2. If no subversion directories with exe were found, check the main folder itself
                            if (!foundSubVersions)
                            {
                                string? mainExe = GameLauncherService.FindMainExecutable(gameDir);
                                if (!string.IsNullOrEmpty(mainExe))
                                {
                                    string versionFile = Path.Combine(gameDir, "version.txt");
                                    string vName = File.Exists(versionFile)
                                        ? File.ReadAllText(versionFile).Trim()
                                        : "v1.0";

                                    installedVersions.Add(vName);
                                    pathsMap[vName] = gameDir;
                                }
                            }
                        }

                        // Also check sibling folders: Juegos/<SafeTitle> (vX.Y) or Juegos/<SafeTitle> - vX.Y
                        foreach (var siblingDir in allJuegosFolders)
                        {
                            string folderName = Path.GetFileName(siblingDir);
                            if (folderName.StartsWith(safeTitle, StringComparison.OrdinalIgnoreCase) && !siblingDir.Equals(gameDir, StringComparison.OrdinalIgnoreCase))
                            {
                                string? sibExe = GameLauncherService.FindMainExecutable(siblingDir);
                                if (!string.IsNullOrEmpty(sibExe))
                                {
                                    string versionFile = Path.Combine(siblingDir, "version.txt");
                                    string vName = File.Exists(versionFile)
                                        ? File.ReadAllText(versionFile).Trim()
                                        : folderName.Substring(safeTitle.Length).Trim(' ', '-', '(', ')', '_');

                                    if (string.IsNullOrEmpty(vName)) vName = "v1.0";

                                    if (!installedVersions.Contains(vName))
                                    {
                                        installedVersions.Add(vName);
                                        pathsMap[vName] = siblingDir;
                                    }
                                }
                            }
                        }

                        if (installedVersions.Count > 0)
                        {
                            string primaryVersion = installedVersions[installedVersions.Count - 1];
                            installedMap[title] = primaryVersion;
                            installations[title] = new
                            {
                                isInstalled = true,
                                installedVersions = installedVersions,
                                primaryVersion = primaryVersion,
                                paths = pathsMap
                            };
                        }
                        else
                        {
                            installations[title] = new
                            {
                                isInstalled = false,
                                installedVersions = new string[0],
                                primaryVersion = "",
                                paths = new Dictionary<string, string>()
                            };
                        }
                    }

                    var response = new
                    {
                        type = "INSTALLATION_STATUS",
                        installedMap = installedMap,
                        installations = installations
                    };
                    _webView.Invoke(new Action(() => SendToFrontend(response)));
                }
                else if (action == "LAUNCH_GAME")
                {
                    string gameTitle = root.GetProperty("gameTitle").GetString() ?? "";
                    string safeTitle = string.Concat(gameTitle.Split(Path.GetInvalidFileNameChars())).Trim();

                    long appId = root.TryGetProperty("appId", out var appProp) && appProp.TryGetInt64(out long aVal) ? aVal : 0;
                    string gameKey = root.TryGetProperty("gameKey", out var keyProp) ? keyProp.GetString() ?? "" : "";
                    string customSavePattern = root.TryGetProperty("savePattern", out var patProp) ? patProp.GetString() ?? "" : "";
                    string customPath = root.TryGetProperty("gamePath", out var pathProp) ? pathProp.GetString() ?? "" : "";
                    string targetVersion = root.TryGetProperty("version", out var verProp) ? verProp.GetString() ?? "" : "";

                    string juegosDir = Path.Combine(Directory.GetCurrentDirectory(), "Juegos");
                    string gameFolder = "";

                    if (!string.IsNullOrEmpty(customPath) && Directory.Exists(customPath))
                    {
                        gameFolder = customPath;
                    }
                    else if (!string.IsNullOrEmpty(targetVersion))
                    {
                        // Check if version specific subfolder exists
                        string versionSubFolder = Path.Combine(juegosDir, safeTitle, targetVersion);
                        string versionSiblingFolder = Path.Combine(juegosDir, $"{safeTitle} ({targetVersion})");
                        string versionDashFolder = Path.Combine(juegosDir, $"{safeTitle} - {targetVersion}");

                        if (Directory.Exists(versionSubFolder) && GameLauncherService.FindMainExecutable(versionSubFolder) != null)
                        {
                            gameFolder = versionSubFolder;
                        }
                        else if (Directory.Exists(versionSiblingFolder) && GameLauncherService.FindMainExecutable(versionSiblingFolder) != null)
                        {
                            gameFolder = versionSiblingFolder;
                        }
                        else if (Directory.Exists(versionDashFolder) && GameLauncherService.FindMainExecutable(versionDashFolder) != null)
                        {
                            gameFolder = versionDashFolder;
                        }
                    }

                    if (string.IsNullOrEmpty(gameFolder))
                    {
                        gameFolder = Path.Combine(juegosDir, safeTitle);
                    }

                    // Auto-detect AppID for Monster Hunter Rise if not explicitly passed
                    if (appId == 0 && (gameTitle.Contains("Monster Hunter Rise", StringComparison.OrdinalIgnoreCase) || gameKey.Equals("mh_rise", StringComparison.OrdinalIgnoreCase)))
                    {
                        appId = 1446780;
                    }

                    _launcher.LaunchGame(gameTitle, gameFolder);

                    // Iniciar monitoreo en tiempo real de logros con Goldberg SteamEmu
                    _ = _achievementService.StartMonitoringGameAsync(appId, gameKey, "goldberg", customSavePattern, gameFolder);
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
                else if (action == "GET_ACHIEVEMENTS")
                {
                    long appId = root.TryGetProperty("appId", out var appProp) && appProp.TryGetInt64(out long aVal) ? aVal : 0;
                    string gameKey = root.TryGetProperty("gameKey", out var keyProp) ? keyProp.GetString() ?? "" : "";
                    string gameTitle = root.TryGetProperty("gameTitle", out var titleProp) ? titleProp.GetString() ?? "" : "";
                    string customSavePattern = root.TryGetProperty("savePattern", out var patProp) ? patProp.GetString() ?? "" : "";
                    string customPath = root.TryGetProperty("gamePath", out var pathProp) ? pathProp.GetString() ?? "" : "";

                    if (appId == 0 && (gameTitle.Contains("Monster Hunter Rise", StringComparison.OrdinalIgnoreCase) || gameKey.Equals("mh_rise", StringComparison.OrdinalIgnoreCase)))
                    {
                        appId = 1446780;
                    }

                    var (found, unlockedCount, totalCount, achievements) = await _achievementService.GetGameAchievementsAsync(appId, gameKey, customSavePattern, customPath);

                    SendToFrontend(new
                    {
                        type = "ACHIEVEMENTS_DATA_RESULT",
                        gameKey,
                        appId,
                        found,
                        unlockedCount,
                        totalCount,
                        achievements = achievements.Select(a => new
                        {
                            apiName = a.ApiName,
                            displayName = a.DisplayName,
                            description = a.Description,
                            iconUrl = a.IconUrl,
                            iconGrayUrl = a.IconGrayUrl,
                            unlocked = a.Unlocked,
                            unlockTime = a.UnlockTime?.ToString("o")
                        })
                    });
                }
                else if (action == "BACKUP_SAVEGAME")
                {
                    string gameTitle = root.GetProperty("gameTitle").GetString() ?? "";
                    string gameKey = root.GetProperty("gameKey").GetString() ?? "";
                    string savePattern = root.GetProperty("savePattern").GetString() ?? "";

                    var res = await _savegameService.BackupSavegameAsync(gameTitle, gameKey, savePattern);
                    SendToFrontend(new
                    {
                        type = "SAVEGAME_BACKUP_RESULT",
                        gameKey,
                        success = res.Success,
                        message = res.Message,
                        sizeBytes = res.SizeBytes,
                        timestamp = res.Timestamp.ToString("o"),
                        uploadedToCloud = res.UploadedToCloud
                    });
                }
                else if (action == "RESTORE_SAVEGAME")
                {
                    string gameTitle = root.GetProperty("gameTitle").GetString() ?? "";
                    string gameKey = root.GetProperty("gameKey").GetString() ?? "";
                    string savePattern = root.GetProperty("savePattern").GetString() ?? "";

                    bool success = await _savegameService.RestoreSavegameAsync(gameTitle, gameKey, savePattern);
                    SendToFrontend(new
                    {
                        type = "SAVEGAME_RESTORE_RESULT",
                        gameKey,
                        success,
                        message = success ? "Partida guardada restaurada con éxito desde Oracle Cloud." : "Error al restaurar partida guardada."
                    });
                }
                else if (action == "GET_SAVEGAME_INFO")
                {
                    string gameKey = root.GetProperty("gameKey").GetString() ?? "";
                    string savePattern = root.GetProperty("savePattern").GetString() ?? "";

                    var info = await _savegameService.GetSavegameInfoAsync(gameKey, savePattern);
                    SendToFrontend(new
                    {
                        type = "SAVEGAME_INFO_RESULT",
                        gameKey,
                        exists = info.Exists,
                        sizeBytes = info.SizeBytes,
                        updatedAt = info.UpdatedAt.ToString("o"),
                        resolvedPath = info.LocalPathResolved
                    });
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

        private static async Task<bool> IsViteDevServerRunningAsync()
        {
            try
            {
                using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(1500) };
                using var response = await client.GetAsync("http://localhost:5173");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}