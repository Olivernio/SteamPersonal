using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace SteamPersonal.Services.Achievements
{
    public class SteamWebAchievementProvider : IAchievementProvider
    {
        public string ProviderKey => "steam_web";

        private readonly HttpClient _httpClient;
        private readonly Dictionary<long, List<AchievementModel>> _cache = new Dictionary<long, List<AchievementModel>>();

        // Public fallback Steam Web API key commonly used by launchers/tools
        private const string PublicApiKey = "F370D70A3438450F460D8F156B136C70";

        public SteamWebAchievementProvider()
        {
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
        }

        public async Task<List<AchievementModel>> GetAchievementsAsync(long appId, string gameKey)
        {
            if (appId <= 0) return new List<AchievementModel>();

            if (_cache.TryGetValue(appId, out var cached) && cached.Count > 0)
            {
                return cached;
            }

            var list = new List<AchievementModel>();

            try
            {
                // Method 1: Steam Official Web API GetSchemaForGame (1-to-1 exact mapping)
                try
                {
                    string apiKey = SettingsManager.Current.SteamApiKey;
                    string schemaUrl = $"https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key={apiKey}&appid={appId}&l=spanish";
                    string schemaJson = await _httpClient.GetStringAsync(schemaUrl);
                    using var doc = JsonDocument.Parse(schemaJson);
                    
                    if (doc.RootElement.TryGetProperty("game", out var gameObj) &&
                        gameObj.TryGetProperty("availableGameStats", out var statsObj) &&
                        statsObj.TryGetProperty("achievements", out var achArr) &&
                        achArr.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in achArr.EnumerateArray())
                        {
                            string name = item.TryGetProperty("name", out var n) ? (n.GetString() ?? "") : "";
                            string title = item.TryGetProperty("displayName", out var t) ? (t.GetString() ?? "") : "";
                            string desc = item.TryGetProperty("description", out var d) ? (d.GetString() ?? "") : "";
                            string icon = item.TryGetProperty("icon", out var i) ? (i.GetString() ?? "") : "";
                            string iconGray = item.TryGetProperty("icongray", out var ig) ? (ig.GetString() ?? "") : "";

                            if (!string.IsNullOrEmpty(name))
                            {
                                list.Add(new AchievementModel
                                {
                                    ApiName = name,
                                    DisplayName = string.IsNullOrEmpty(title) ? name : title,
                                    Description = desc,
                                    IconUrl = icon,
                                    IconGrayUrl = string.IsNullOrEmpty(iconGray) ? icon : iconGray,
                                    Unlocked = false
                                });
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[SteamWebAchievementProvider] Advertencia al obtener esquema vía API oficial: {ex.Message}");
                }

                // Fallback Method 2: HTML Web Scraping if API returned no achievements
                if (list.Count == 0)
                {
                    string htmlUrl = $"https://steamcommunity.com/stats/{appId}/achievements?l=spanish";
                    string html = await _httpClient.GetStringAsync(htmlUrl);

                    if (!string.IsNullOrEmpty(html))
                    {
                        var pattern = new Regex(@"(?s)<div class=""achieveRow[^""]*"">.*?<img src=""([^""]+)"".*?<h3>(.*?)</h3>.*?<h5>(.*?)</h5>", RegexOptions.IgnoreCase);
                        var matches = pattern.Matches(html);

                        for (int i = 0; i < matches.Count; i++)
                        {
                            var match = matches[i];
                            string icon = match.Groups[1].Value.Trim();
                            string title = System.Net.WebUtility.HtmlDecode(match.Groups[2].Value.Trim());
                            string desc = System.Net.WebUtility.HtmlDecode(match.Groups[3].Value.Trim());

                            list.Add(new AchievementModel
                            {
                                ApiName = title,
                                DisplayName = title,
                                Description = desc,
                                IconUrl = icon,
                                IconGrayUrl = icon,
                                Unlocked = false
                            });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SteamWebAchievementProvider] Error al obtener logros para AppID {appId}: {ex.Message}");
            }

            if (list.Count > 0)
            {
                _cache[appId] = list;
            }

            return list;
        }
    }
}
