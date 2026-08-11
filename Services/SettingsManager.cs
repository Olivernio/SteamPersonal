using System;
using System.IO;
using System.Text.Json;

namespace SteamPersonal.Services
{
    public class AppSettings
    {
        public string SteamApiKey { get; set; } = "";
        public bool ShowBuildId { get; set; } = false;
        public bool EnableDynamicBackgrounds { get; set; } = true;
        public int BgImageDurationMs { get; set; } = 10000;
        public int BgFadeDurationMs { get; set; } = 5000;
    }

    public static class SettingsManager
    {
        private static readonly string SettingsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "appsettings.json");
        public static AppSettings Current { get; private set; } = new AppSettings();

        public static void Load()
        {
            try
            {
                if (File.Exists(SettingsPath))
                {
                    string json = File.ReadAllText(SettingsPath);
                    Current = JsonSerializer.Deserialize<AppSettings>(json) ?? new AppSettings();
                }
            }
            catch { }
        }

        public static void Save(AppSettings newSettings)
        {
            Current = newSettings;
            try
            {
                string json = JsonSerializer.Serialize(Current, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(SettingsPath, json);
            }
            catch { }
        }
    }
}
