using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace SteamPersonal.Services.Achievements
{
    public class GoldbergAchievementWatcher : IAchievementWatcher
    {
        public string ProviderKey => "goldberg";

        public event EventHandler<AchievementUnlockedEventArgs>? AchievementUnlocked;

        private FileSystemWatcher? _watcher;
        private System.Threading.Timer? _debounceTimer;
        private readonly object _lock = new object();

        private long _currentAppId;
        private string _currentGameKey = string.Empty;
        private string _targetFilePath = string.Empty;
        private readonly HashSet<string> _knownUnlockedApiNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        public void StartWatching(long appId, string gameKey, string? customPathPattern = null, string? installDir = null)
        {
            StopWatching();

            _currentAppId = appId;
            _currentGameKey = gameKey;
            _knownUnlockedApiNames.Clear();

            // Resolve target achievements.json path
            _targetFilePath = ResolveGoldbergAchievementsPath(appId, customPathPattern, installDir);

            if (string.IsNullOrEmpty(_targetFilePath))
            {
                Console.WriteLine($"[GoldbergWatcher] No se encontró ruta válida de logros para AppID {appId}.");
                return;
            }

            string targetDir = Path.GetDirectoryName(_targetFilePath) ?? string.Empty;
            string fileName = Path.GetFileName(_targetFilePath);

            if (!Directory.Exists(targetDir))
            {
                try
                {
                    Directory.CreateDirectory(targetDir);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[GoldbergWatcher] Error al crear directorio objetivo '{targetDir}': {ex.Message}");
                    return;
                }
            }

            // Populate initial unlocked state
            ReadUnlockedAchievements(isInitialLoad: true);

            // Initialize FileSystemWatcher
            try
            {
                _watcher = new FileSystemWatcher
                {
                    Path = targetDir,
                    Filter = fileName,
                    NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName | NotifyFilters.Size,
                    EnableRaisingEvents = true
                };

                _watcher.Changed += OnFileChanged;
                _watcher.Created += OnFileChanged;

                Console.WriteLine($"[GoldbergWatcher] Monitoreando logros en tiempo real: {_targetFilePath}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GoldbergWatcher] Error al iniciar FileSystemWatcher: {ex.Message}");
            }
        }

        public void StopWatching()
        {
            lock (_lock)
            {
                if (_watcher != null)
                {
                    _watcher.EnableRaisingEvents = false;
                    _watcher.Changed -= OnFileChanged;
                    _watcher.Created -= OnFileChanged;
                    _watcher.Dispose();
                    _watcher = null;
                }

                _debounceTimer?.Dispose();
                _debounceTimer = null;
            }

            Console.WriteLine("[GoldbergWatcher] Monitoreo de logros detenido.");
        }

        private void OnFileChanged(object sender, FileSystemEventArgs e)
        {
            // Debounce FileSystemWatcher events (300ms)
            lock (_lock)
            {
                _debounceTimer?.Dispose();
                _debounceTimer = new System.Threading.Timer(_ =>
                {
                    ReadUnlockedAchievements(isInitialLoad: false);
                }, null, 300, System.Threading.Timeout.Infinite);
            }
        }

        private void ReadUnlockedAchievements(bool isInitialLoad)
        {
            if (string.IsNullOrEmpty(_targetFilePath) || !File.Exists(_targetFilePath))
                return;

            try
            {
                // Attempt to read file with FileShare.ReadWrite to avoid locking collisions with Goldberg
                string json;
                using (var fs = new FileStream(_targetFilePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var reader = new StreamReader(fs))
                {
                    json = reader.ReadToEnd();
                }

                if (string.IsNullOrWhiteSpace(json)) return;

                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var newlyUnlocked = new List<(string ApiName, DateTime? UnlockTime)>();

                if (root.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in root.EnumerateObject())
                    {
                        string apiName = prop.Name;
                        bool earned = false;
                        DateTime? unlockTime = null;

                        if (prop.Value.ValueKind == JsonValueKind.Object)
                        {
                            if (prop.Value.TryGetProperty("earned", out var earnedProp))
                            {
                                earned = earnedProp.ValueKind == JsonValueKind.True || (earnedProp.ValueKind == JsonValueKind.Number && earnedProp.GetInt32() == 1);
                            }

                            if (prop.Value.TryGetProperty("earned_time", out var timeProp) && timeProp.TryGetInt64(out long epochSec) && epochSec > 0)
                            {
                                unlockTime = DateTimeOffset.FromUnixTimeSeconds(epochSec).LocalDateTime;
                            }
                        }
                        else if (prop.Value.ValueKind == JsonValueKind.True)
                        {
                            earned = true;
                        }

                        if (earned)
                        {
                            lock (_lock)
                            {
                                if (_knownUnlockedApiNames.Add(apiName) && !isInitialLoad)
                                {
                                    newlyUnlocked.Add((apiName, unlockTime));
                                }
                            }
                        }
                    }
                }
                else if (root.ValueKind == JsonValueKind.Array)
                {
                    foreach (var elem in root.EnumerateArray())
                    {
                        if (elem.ValueKind == JsonValueKind.Object && elem.TryGetProperty("name", out var nameProp))
                        {
                            string apiName = nameProp.GetString() ?? "";
                            bool earned = elem.TryGetProperty("earned", out var eProp) && eProp.GetBoolean();
                            DateTime? unlockTime = null;

                            if (elem.TryGetProperty("earned_time", out var tProp) && tProp.TryGetInt64(out long epochSec) && epochSec > 0)
                            {
                                unlockTime = DateTimeOffset.FromUnixTimeSeconds(epochSec).LocalDateTime;
                            }

                            if (earned && !string.IsNullOrEmpty(apiName))
                            {
                                lock (_lock)
                                {
                                    if (_knownUnlockedApiNames.Add(apiName) && !isInitialLoad)
                                    {
                                        newlyUnlocked.Add((apiName, unlockTime));
                                    }
                                }
                            }
                        }
                    }
                }

                // Dispatch event for newly unlocked achievements during live gameplay
                foreach (var (apiName, time) in newlyUnlocked)
                {
                    Console.WriteLine($"[GoldbergWatcher] ¡LOGRO DESBLOQUEADO EN VIVO! -> {apiName}");
                    AchievementUnlocked?.Invoke(this, new AchievementUnlockedEventArgs
                    {
                        GameKey = _currentGameKey,
                        AppId = _currentAppId,
                        Achievement = new AchievementModel
                        {
                            ApiName = apiName,
                            Unlocked = true,
                            UnlockTime = time ?? DateTime.Now
                        }
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[GoldbergWatcher] Error al leer achievements.json: {ex.Message}");
            }
        }

        public Dictionary<string, DateTime?> GetUnlockedState(long appId, string? customPathPattern = null, string? installDir = null)
        {
            var result = new Dictionary<string, DateTime?>(StringComparer.OrdinalIgnoreCase);
            string targetPath = ResolveGoldbergAchievementsPath(appId, customPathPattern, installDir);
            if (string.IsNullOrEmpty(targetPath) || !File.Exists(targetPath)) return result;

            try
            {
                string json;
                using (var fs = new FileStream(targetPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                using (var reader = new StreamReader(fs))
                {
                    json = reader.ReadToEnd();
                }

                if (string.IsNullOrWhiteSpace(json)) return result;
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.ValueKind == JsonValueKind.Object)
                {
                    foreach (var prop in root.EnumerateObject())
                    {
                        bool earned = false;
                        DateTime? unlockTime = null;

                        if (prop.Value.ValueKind == JsonValueKind.Object)
                        {
                            if (prop.Value.TryGetProperty("earned", out var earnedProp))
                            {
                                earned = earnedProp.ValueKind == JsonValueKind.True || (earnedProp.ValueKind == JsonValueKind.Number && earnedProp.GetInt32() == 1);
                            }
                            if (prop.Value.TryGetProperty("earned_time", out var timeProp) && timeProp.TryGetInt64(out long epochSec) && epochSec > 0)
                            {
                                unlockTime = DateTimeOffset.FromUnixTimeSeconds(epochSec).LocalDateTime;
                            }
                        }
                        else if (prop.Value.ValueKind == JsonValueKind.True)
                        {
                            earned = true;
                        }

                        if (earned)
                        {
                            result[prop.Name] = unlockTime;
                        }
                    }
                }
            }
            catch { }

            return result;
        }

        private string ResolveGoldbergAchievementsPath(long appId, string? customPathPattern, string? installDir)
        {
            // 1. Custom path configured in Admin Panel
            if (!string.IsNullOrWhiteSpace(customPathPattern))
            {
                string expanded = Environment.ExpandEnvironmentVariables(customPathPattern);
                if (!string.IsNullOrEmpty(installDir))
                    expanded = expanded.Replace("{INSTALL_DIR}", installDir, StringComparison.OrdinalIgnoreCase);
                if (appId > 0)
                    expanded = expanded.Replace("{APP_ID}", appId.ToString(), StringComparison.OrdinalIgnoreCase);

                if (File.Exists(expanded)) return expanded;
            }

            if (appId > 0)
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

                // 2. Check GSE Saves (newer Goldberg SteamEmu forks)
                string gsePath = Path.Combine(appData, "GSE Saves", appId.ToString(), "achievements.json");
                if (File.Exists(gsePath)) return gsePath;

                // 3. Check Goldberg SteamEmu Saves (standard Goldberg SteamEmu)
                string goldbergPath = Path.Combine(appData, "Goldberg SteamEmu Saves", appId.ToString(), "achievements.json");
                if (File.Exists(goldbergPath)) return goldbergPath;

                // 4. Check subfolder remote/win64_save or steam_settings
                string goldbergSubPath = Path.Combine(appData, "Goldberg SteamEmu Saves", appId.ToString(), "remote", "achievements.json");
                if (File.Exists(goldbergSubPath)) return goldbergSubPath;

                return gsePath;
            }

            // 5. Fallback: Local install directory steam_settings
            if (!string.IsNullOrEmpty(installDir))
            {
                string localPath = Path.Combine(installDir, "steam_settings", "achievements.json");
                if (File.Exists(localPath)) return localPath;
            }

            return string.Empty;
        }
    }
}
