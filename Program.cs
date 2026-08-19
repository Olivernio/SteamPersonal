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

                    // Per-mirror recipe: optional steps sent by the frontend
                    // when the selected mirror has recipe_mode = "override"
                    string mirrorProvider = "default";
                    if (root.TryGetProperty("mirrorProvider", out var mpProp))
                        mirrorProvider = mpProp.GetString() ?? "default";

                    var recipe = new SteamPersonal.Services.Models.InstallationRecipe
                    {
                        Title = _currentGameTitle,
                        LatestOfficialVersion = version
                    };

                    // If the frontend sends mirror-specific steps, use them directly
                    if (root.TryGetProperty("recipeSteps", out var stepsProp) &&
                        stepsProp.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        var mirrorSteps = System.Text.Json.JsonSerializer.Deserialize<
                            List<SteamPersonal.Services.Models.RecipeStep>>(stepsProp.GetRawText());
                        if (mirrorSteps != null && mirrorSteps.Count > 0)
                        {
                            recipe.Steps = mirrorSteps;
                            System.Console.WriteLine($"[Recipe] Using mirror-specific recipe ({mirrorSteps.Count} steps) from provider: {mirrorProvider}");
                        }
                    }
                    // Gofile API token (optional, from user settings or Supabase system_settings)
                    string? gofileToken = null;
                    if (root.TryGetProperty("gofileToken", out var gtProp))
                    {
                        gofileToken = gtProp.GetString();
                        if (!string.IsNullOrWhiteSpace(gofileToken))
                        {
                            System.Console.WriteLine("[Gofile] Token de API configurado recibido desde el cliente.");
                        }
                    }

                    _ = _recipeService.ExecuteRecipeAsync(recipe, url, gofileToken);
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

                    // ── Step 1: Scan ALL folders in Juegos/ and build a manifest index ──
                    // Key: gameTitle (from manifest or derived), Value: list of (version, path)
                    var manifestIndex = new Dictionary<string, List<(string version, string path)>>(StringComparer.OrdinalIgnoreCase);

                    foreach (var folder in Directory.GetDirectories(juegosDir))
                    {
                        TryIndexFolder(folder, manifestIndex, juegosDir);
                    }

                    // ── Step 2: Match catalog games to manifest index ──
                    foreach (var game in gamesArray)
                    {
                        string title = game.GetString() ?? "";
                        if (string.IsNullOrEmpty(title)) continue;

                        string safeTitle = string.Concat(title.Split(Path.GetInvalidFileNameChars())).Trim();

                        // Look up by exact game title first, then by safeTitle
                        if (!manifestIndex.TryGetValue(title, out var versionList) &&
                            !manifestIndex.TryGetValue(safeTitle, out versionList))
                        {
                            // No installation found
                            installations[title] = new
                            {
                                isInstalled = false,
                                installedVersions = new string[0],
                                primaryVersion = "",
                                paths = new Dictionary<string, string>()
                            };
                            continue;
                        }

                        // Sort versions descending (newest first)
                        versionList.Sort((a, b) => CompareVersionStrings(b.version, a.version));

                        var installedVersions = new List<string>();
                        var pathsMap = new Dictionary<string, string>();

                        foreach (var (ver, path) in versionList)
                        {
                            if (!installedVersions.Contains(ver))
                            {
                                installedVersions.Add(ver);
                                pathsMap[ver] = path;
                            }
                        }

                        string primaryVersion = installedVersions[0]; // newest
                        installedMap[title] = primaryVersion;
                        installations[title] = new
                        {
                            isInstalled = true,
                            installedVersions = installedVersions,
                            primaryVersion = primaryVersion,
                            paths = pathsMap
                        };
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
                        // 1. Explicit path provided (e.g. from installedPaths map)
                        gameFolder = customPath;
                    }
                    else
                    {
                        // 2. Normalise target version
                        if (!string.IsNullOrEmpty(targetVersion) &&
                            !targetVersion.StartsWith("v", StringComparison.OrdinalIgnoreCase))
                            targetVersion = "v" + targetVersion;

                        // 3. Try the canonical versioned sibling folder first
                        if (!string.IsNullOrEmpty(targetVersion))
                        {
                            string versionedSibling = Path.Combine(juegosDir, $"{safeTitle} ({targetVersion})");
                            if (Directory.Exists(versionedSibling) && GameLauncherService.FindMainExecutable(versionedSibling) != null)
                            {
                                gameFolder = versionedSibling;
                            }
                            else
                            {
                                // Check one level down (repack layout: exe lives in subfolder)
                                if (Directory.Exists(versionedSibling))
                                {
                                    foreach (var sub in Directory.GetDirectories(versionedSibling))
                                    {
                                        if (GameLauncherService.FindMainExecutable(sub) != null)
                                        {
                                            gameFolder = sub;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // 4. Fallback: scan all Juegos/ folders and find by sp_install.json
                        if (string.IsNullOrEmpty(gameFolder) && Directory.Exists(juegosDir))
                        {
                            foreach (var folder in Directory.GetDirectories(juegosDir))
                            {
                                string mfPath = Path.Combine(folder, "sp_install.json");
                                if (!File.Exists(mfPath)) continue;
                                try
                                {
                                    using var mfDoc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(mfPath));
                                    string mfTitle   = mfDoc.RootElement.TryGetProperty("gameTitle", out var gtp) ? gtp.GetString() ?? "" : "";
                                    string mfSafe    = mfDoc.RootElement.TryGetProperty("safeTitle",  out var stp) ? stp.GetString() ?? "" : mfTitle;
                                    string mfVersion = mfDoc.RootElement.TryGetProperty("version",    out var vp)  ? vp.GetString() ?? "" : "";

                                    bool titleMatch = string.Equals(mfTitle, gameTitle, StringComparison.OrdinalIgnoreCase) ||
                                                      string.Equals(mfSafe,  safeTitle,  StringComparison.OrdinalIgnoreCase);
                                    bool versionMatch = string.IsNullOrEmpty(targetVersion) ||
                                                        string.Equals(mfVersion, targetVersion, StringComparison.OrdinalIgnoreCase);

                                    if (titleMatch && versionMatch)
                                    {
                                        // Prefer the exe path (may be a subfolder)
                                        string candidatePath = GameLauncherService.FindMainExecutable(folder) != null ? folder : "";
                                        if (string.IsNullOrEmpty(candidatePath))
                                        {
                                            foreach (var sub in Directory.GetDirectories(folder))
                                            {
                                                if (GameLauncherService.FindMainExecutable(sub) != null)
                                                {
                                                    candidatePath = sub;
                                                    break;
                                                }
                                            }
                                        }
                                        if (!string.IsNullOrEmpty(candidatePath))
                                        {
                                            gameFolder = candidatePath;
                                            break;
                                        }
                                    }
                                }
                                catch { }
                            }
                        }

                        // 5. Absolute last resort: use legacy base folder
                        if (string.IsNullOrEmpty(gameFolder))
                        {
                            gameFolder = Path.Combine(juegosDir, safeTitle);
                        }
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
                else if (action == "GET_PENDING_DOWNLOADS")
                {
                    // Scan Juegos/ for folders with an incomplete download (.manifest.json)
                    string juegosDir = Path.Combine(Directory.GetCurrentDirectory(), "Juegos");
                    var pendingList = new List<object>();

                    if (Directory.Exists(juegosDir))
                    {
                        foreach (var folder in Directory.GetDirectories(juegosDir))
                        {
                            string mfPath = Path.Combine(folder, ".manifest.json");
                            if (!File.Exists(mfPath)) continue;

                            try
                            {
                                string mfJson = File.ReadAllText(mfPath);
                                var mf = JsonSerializer.Deserialize<SteamPersonal.Services.Models.DownloadManifest>(mfJson);
                                if (mf == null) continue;

                                // Skip corrupted or already completed manifests
                                if (mf.Status == "completed") continue;

                                double progress = (mf.TotalBytesExpected > 0)
                                    ? (double)mf.BytesDownloaded / mf.TotalBytesExpected * 100
                                    : (mf.CompletedFiles?.Count > 0 ? -1 : 0); // -1 = unknown %, files known

                                pendingList.Add(new
                                {
                                    gameTitle = mf.GameTitle,
                                    version = mf.Version,
                                    sourceUrl = mf.SourceUrl,
                                    destinationDir = mf.DestinationDir,
                                    status = mf.Status,
                                    filesCompleted = mf.CompletedFiles?.Count ?? 0,
                                    bytesDownloaded = mf.BytesDownloaded,
                                    totalBytesExpected = mf.TotalBytesExpected,
                                    progress
                                });
                            }
                            catch { /* skip corrupted manifest */ }
                        }
                    }

                    SendToFrontend(new { type = "PENDING_DOWNLOADS", pending = pendingList });
                }
                else if (action == "RESUME_PENDING_DOWNLOAD")
                {
                    // Resume a previously interrupted/paused download from manifest data
                    string resumeUrl = root.TryGetProperty("sourceUrl", out var suProp) ? suProp.GetString() ?? "" : "";
                    string resumeTitle = root.TryGetProperty("gameTitle", out var rtProp) ? rtProp.GetString() ?? "" : "";
                    string resumeVersion = root.TryGetProperty("version", out var rvProp) ? rvProp.GetString() ?? "" : "";
                    string resumeDestDir = root.TryGetProperty("destinationDir", out var rdProp) ? rdProp.GetString() ?? "" : "";

                    if (string.IsNullOrEmpty(resumeUrl) || string.IsNullOrEmpty(resumeDestDir))
                    {
                        SendToFrontend(new { type = "DOWNLOAD_FAILED", error = "Datos de reanudación incompletos." });
                    }
                    else
                    {
                        _currentGameTitle = resumeTitle;

                        // Read gofile token from manifest if stored
                        string? gofileToken = null;
                        string mfPath = Path.Combine(resumeDestDir, ".manifest.json");
                        if (File.Exists(mfPath))
                        {
                            try
                            {
                                var mfJson = File.ReadAllText(mfPath);
                                var mf = JsonSerializer.Deserialize<SteamPersonal.Services.Models.DownloadManifest>(mfJson);
                                gofileToken = mf?.GofileToken;
                            }
                            catch { }
                        }

                        // Build a minimal recipe that points straight to stream_extract
                        var resumeRecipe = new SteamPersonal.Services.Models.InstallationRecipe
                        {
                            Title = resumeTitle,
                            LatestOfficialVersion = resumeVersion
                        };
                        resumeRecipe.Steps.Add(new SteamPersonal.Services.Models.RecipeStep
                        {
                            Action = "stream_extract",
                            Url = resumeUrl,
                            Provider = "resume"
                        });

                        Console.WriteLine($"[Resume] Reanudando descarga de '{resumeTitle}' en '{resumeDestDir}'");
                        _ = _recipeService.ExecuteRecipeAsync(resumeRecipe, resumeUrl, gofileToken);
                    }
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

        // ── Installation Detection Helpers ────────────────────────

        /// <summary>
        /// Tries to index an installation folder by reading sp_install.json (preferred),
        /// version.txt (fallback), or deriving metadata from the folder name.
        /// Subfolders that are part of the game content (no manifest / no version.txt) are
        /// NOT treated as separate versions — this prevents repack subfolder noise.
        /// </summary>
        private static void TryIndexFolder(
            string folder,
            Dictionary<string, List<(string version, string path)>> index,
            string juegosDir)
        {
            // ── Exclude folders with an ongoing/paused download ──
            // A .manifest.json signals that extraction is incomplete.
            // We must NOT report these as installed or the UI shows a false "Ready to play".
            string downloadManifestPath = Path.Combine(folder, ".manifest.json");
            if (File.Exists(downloadManifestPath))
            {
                Console.WriteLine($"[Index] Skipping incomplete download folder: {Path.GetFileName(folder)}");
                return;
            }

            string manifestPath = Path.Combine(folder, "sp_install.json");

            // ── Priority 1: sp_install.json ──────────────────────
            if (File.Exists(manifestPath))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(File.ReadAllText(manifestPath));
                    string gameTitle = doc.RootElement.TryGetProperty("gameTitle", out var gtp) ? gtp.GetString() ?? "" : "";
                    string version   = doc.RootElement.TryGetProperty("version", out var vp)   ? vp.GetString() ?? "v1.0" : "v1.0";
                    string safeTitle = doc.RootElement.TryGetProperty("safeTitle", out var stp) ? stp.GetString() ?? "" : gameTitle;

                    if (string.IsNullOrWhiteSpace(gameTitle)) gameTitle = safeTitle;
                    if (string.IsNullOrWhiteSpace(gameTitle)) return;

                    // Normalize version
                    if (!version.StartsWith("v", StringComparison.OrdinalIgnoreCase)) version = "v" + version;

                    // Prefer exe-containing path: could be the folder itself or a single subdir
                    string installPath = folder;
                    if (GameLauncherService.FindMainExecutable(folder) == null)
                    {
                        // Try one level down (common repack layout)
                        foreach (var sub in Directory.GetDirectories(folder))
                        {
                            if (GameLauncherService.FindMainExecutable(sub) != null)
                            {
                                installPath = sub;
                                break;
                            }
                        }
                    }

                    AddToIndex(index, gameTitle, version, installPath);
                    if (!string.Equals(gameTitle, safeTitle, StringComparison.OrdinalIgnoreCase) && !string.IsNullOrWhiteSpace(safeTitle))
                        AddToIndex(index, safeTitle, version, installPath);
                    return;
                }
                catch { /* fall through */ }
            }

            // ── Priority 2: version.txt ──────────────────────────
            string versionFilePath = Path.Combine(folder, "version.txt");
            if (File.Exists(versionFilePath))
            {
                string version = File.ReadAllText(versionFilePath).Trim();
                if (string.IsNullOrWhiteSpace(version)) version = "v1.0";
                if (!version.StartsWith("v", StringComparison.OrdinalIgnoreCase)) version = "v" + version;

                // Derive game title from folder name: strip version suffix like " (v1.0.4)"
                string folderName = Path.GetFileName(folder);
                string gameTitle = System.Text.RegularExpressions.Regex.Replace(
                    folderName, @"\s*[\(\[]\s*v?[\d\.]+\s*[\)\]]\s*$", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase).Trim();
                if (string.IsNullOrWhiteSpace(gameTitle)) gameTitle = folderName;

                string installPath = GameLauncherService.FindMainExecutable(folder) != null ? folder : folder;
                // Try to find exe one level deep too
                if (GameLauncherService.FindMainExecutable(folder) == null)
                {
                    foreach (var sub in Directory.GetDirectories(folder))
                    {
                        if (GameLauncherService.FindMainExecutable(sub) != null)
                        {
                            installPath = sub;
                            break;
                        }
                    }
                }

                AddToIndex(index, gameTitle, version, installPath);
                return;
            }

            // ── Priority 3: folder has an exe directly (legacy, no metadata) ──
            if (GameLauncherService.FindMainExecutable(folder) != null)
            {
                string folderName = Path.GetFileName(folder);
                // Try to extract version from folder name pattern: "Title (v1.0)" or "Title - v1.0"
                var vMatch = System.Text.RegularExpressions.Regex.Match(
                    folderName, @"[\(\[]\s*(v?[\d\.]+)\s*[\)\]]$", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                string version = vMatch.Success ? vMatch.Groups[1].Value : "v1.0";
                if (!version.StartsWith("v", StringComparison.OrdinalIgnoreCase)) version = "v" + version;

                string gameTitle = vMatch.Success
                    ? folderName.Substring(0, vMatch.Index).Trim(' ', '-', '_', '(', ')')
                    : folderName;

                AddToIndex(index, gameTitle, version, folder);
            }
        }

        private static void AddToIndex(
            Dictionary<string, List<(string version, string path)>> index,
            string key, string version, string path)
        {
            if (!index.TryGetValue(key, out var list))
            {
                list = new List<(string, string)>();
                index[key] = list;
            }
            list.Add((version, path));
        }

        /// <summary>Compares two version strings like "v1.0.4" and "v1.0.8"</summary>
        private static int CompareVersionStrings(string a, string b)
        {
            static Version? Parse(string s)
            {
                s = s.TrimStart('v', 'V').Trim();
                return Version.TryParse(s, out var v) ? v : null;
            }
            var va = Parse(a);
            var vb = Parse(b);
            if (va != null && vb != null) return va.CompareTo(vb);
            return string.Compare(a, b, StringComparison.OrdinalIgnoreCase);
        }
    }
}