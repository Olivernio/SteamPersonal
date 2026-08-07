using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SteamPersonal.Services.Achievements
{
    public interface IAchievementWatcher
    {
        string ProviderKey { get; }
        event EventHandler<AchievementUnlockedEventArgs>? AchievementUnlocked;
        void StartWatching(long appId, string gameKey, string? customPathPattern = null, string? installDir = null);
        void StopWatching();
    }

    public interface IAchievementProvider
    {
        string ProviderKey { get; }
        Task<List<AchievementModel>> GetAchievementsAsync(long appId, string gameKey);
    }
}
