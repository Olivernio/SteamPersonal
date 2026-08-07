using System;

namespace SteamPersonal.Services.Achievements
{
    public class AchievementModel
    {
        public string ApiName { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string IconUrl { get; set; } = string.Empty;
        public string IconGrayUrl { get; set; } = string.Empty;
        public bool Unlocked { get; set; }
        public DateTime? UnlockTime { get; set; }
    }

    public class AchievementUnlockedEventArgs : EventArgs
    {
        public string GameKey { get; set; } = string.Empty;
        public long AppId { get; set; }
        public AchievementModel Achievement { get; set; } = new AchievementModel();
    }
}
