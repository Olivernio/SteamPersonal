using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SteamPersonal.Services.Achievements
{
    public class AchievementService
    {
        public event EventHandler<AchievementUnlockedEventArgs>? AchievementUnlocked;

        private readonly Dictionary<string, IAchievementWatcher> _watchers = new Dictionary<string, IAchievementWatcher>(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, IAchievementProvider> _providers = new Dictionary<string, IAchievementProvider>(StringComparer.OrdinalIgnoreCase);

        private IAchievementWatcher? _activeWatcher;
        private readonly SteamWebAchievementProvider _steamWebProvider;

        public AchievementService()
        {
            // Register default Goldberg watcher and Steam Web schema provider
            var goldberg = new GoldbergAchievementWatcher();
            _watchers[goldberg.ProviderKey] = goldberg;

            _steamWebProvider = new SteamWebAchievementProvider();
            _providers[_steamWebProvider.ProviderKey] = _steamWebProvider;
        }

        public void RegisterWatcher(IAchievementWatcher watcher)
        {
            _watchers[watcher.ProviderKey] = watcher;
        }

        public void RegisterProvider(IAchievementProvider provider)
        {
            _providers[provider.ProviderKey] = provider;
        }

        public async Task StartMonitoringGameAsync(long appId, string gameKey, string? providerKey = "goldberg", string? customSavePattern = null, string? installDir = null)
        {
            StopMonitoring();

            string selectedProvider = string.IsNullOrWhiteSpace(providerKey) ? "goldberg" : providerKey.ToLowerInvariant();

            if (!_watchers.TryGetValue(selectedProvider, out var watcher))
            {
                Console.WriteLine($"[AchievementService] Proveedor de logros '{selectedProvider}' no registrado. Usando 'goldberg' por defecto.");
                watcher = _watchers["goldberg"];
            }

            _activeWatcher = watcher;
            _activeWatcher.AchievementUnlocked += HandleWatcherAchievementUnlocked;

            // Fetch Steam achievement schema in background
            List<AchievementModel> schemaList = new List<AchievementModel>();
            if (appId > 0)
            {
                schemaList = await _steamWebProvider.GetAchievementsAsync(appId, gameKey);
                Console.WriteLine($"[AchievementService] Esquema de logros cargado para AppID {appId}: {schemaList.Count} logros encontrados.");
            }

            _activeWatcher.StartWatching(appId, gameKey, customSavePattern, installDir);
        }

        public void StopMonitoring()
        {
            if (_activeWatcher != null)
            {
                _activeWatcher.AchievementUnlocked -= HandleWatcherAchievementUnlocked;
                _activeWatcher.StopWatching();
                _activeWatcher = null;
            }
        }

        private async void HandleWatcherAchievementUnlocked(object? sender, AchievementUnlockedEventArgs e)
        {
            // Enrich with DisplayName, Description, and IconUrl from Steam Web Provider schema
            var schema = await _steamWebProvider.GetAchievementsAsync(e.AppId, e.GameKey);
            var match = schema.FirstOrDefault(a => string.Equals(a.ApiName, e.Achievement.ApiName, StringComparison.OrdinalIgnoreCase));

            if (match != null)
            {
                e.Achievement.DisplayName = match.DisplayName;
                e.Achievement.Description = match.Description;
                e.Achievement.IconUrl = match.IconUrl;
                e.Achievement.IconGrayUrl = match.IconGrayUrl;
            }
            else
            {
                e.Achievement.DisplayName = e.Achievement.ApiName;
            }

            Console.WriteLine($"[AchievementService] Notificando desbloqueo al Frontend: {e.Achievement.DisplayName} ({e.Achievement.ApiName})");
            AchievementUnlocked?.Invoke(this, e);
        }

        public async Task<(bool found, int unlockedCount, int totalCount, List<AchievementModel> achievements)> GetGameAchievementsAsync(long appId, string gameKey, string? customSavePattern = null, string? installDir = null)
        {
            if (appId <= 0) return (false, 0, 0, new List<AchievementModel>());

            var schemaList = await _steamWebProvider.GetAchievementsAsync(appId, gameKey);
            var goldberg = _watchers["goldberg"] as GoldbergAchievementWatcher;
            var unlockedMap = goldberg?.GetUnlockedState(appId, customSavePattern, installDir) ?? new Dictionary<string, DateTime?>();

            if (schemaList.Count == 0 && unlockedMap.Count == 0)
            {
                return (false, 0, 0, new List<AchievementModel>());
            }

            var resultList = new List<AchievementModel>();
            int unlockedCount = 0;

            foreach (var item in schemaList)
            {
                bool isUnlocked = unlockedMap.TryGetValue(item.ApiName, out var time);
                if (isUnlocked) unlockedCount++;

                resultList.Add(new AchievementModel
                {
                    ApiName = item.ApiName,
                    DisplayName = item.DisplayName,
                    Description = item.Description,
                    IconUrl = item.IconUrl,
                    IconGrayUrl = item.IconGrayUrl,
                    Unlocked = isUnlocked,
                    UnlockTime = time
                });
            }

            return (true, unlockedCount, resultList.Count, resultList);
        }
    }
}
