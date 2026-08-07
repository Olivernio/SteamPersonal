using System;
using System.Net.Http;
using System.Text.Json;
using System.Collections.Generic;

var _httpClient = new HttpClient();
_httpClient.DefaultRequestHeaders.Add(\"User-Agent\", \"Mozilla/5.0\");
string pctUrl = $\"https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=1446780\";
try {
    string pctJson = _httpClient.GetStringAsync(pctUrl).Result;
    using var doc = JsonDocument.Parse(pctJson);
    var rootObj = doc.RootElement.GetProperty(\"achievementpercentages\");
    var achArr = rootObj.GetProperty(\"achievements\");
    int count = 0;
    foreach (var item in achArr.EnumerateArray()) {
        Console.WriteLine($\"Found: {item.GetProperty(\"name\").GetString()}\");
        count++;
        if(count >= 5) break;
    }
} catch (Exception e) {
    Console.WriteLine(\"Error: \" + e.Message);
}
