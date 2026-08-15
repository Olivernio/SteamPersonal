using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using SteamPersonal.SyncWorker.Models;

namespace SteamPersonal.SyncWorker;

public class SteamEventsClient(HttpClient http, ILogger<SteamEventsClient> logger)
{
    private static readonly Regex BbCodeRegex = new(
        @"\[(previewyoutube|img|table|tr|td|th|h[1-6]|list|olist|\*|b|i|u|s|strike|url|quote|code|spoiler)[^\]]*\].*?\[/\1\]|\[[^\]]+\]",
        RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);

    private readonly SemaphoreSlim _rateLimiter = new(1, 1);
    private DateTime _lastRequest = DateTime.MinValue;

    private const int MaxRetries = 5;

    public async Task<List<SteamEventRaw>> FetchEventsAsync(uint appId, int count = 25)
    {
        await EnforceRateLimitAsync();

        var list = new List<SteamEventRaw>();
        string url =
            $"https://store.steampowered.com/events/ajaxgetpartnereventspageable/?appid={appId}&offset=0&count={count}&l=english";

        try
        {
            string json = await GetStringWithRetryAsync(url);
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("events", out var eventsArr))
                return list;

            foreach (var item in eventsArr.EnumerateArray())
            {
                int eventType = item.TryGetProperty("event_type", out var et) ? et.GetInt32() : -1;
                string? buildId = ExtractBuildIdFromJsonData(item);

                // Steam Partner Event Types:
                // 28 = k_ECommunityEventGameUpdate / Major Update
                // 34 = k_ECommunityEventSmallUpdate / Minor Update, Patch, Hotfix
                // Exclude general community news (12), dev blog/merch (14), streams, discounts, etc.
                bool isGameUpdate = eventType == 28 || eventType == 34 || !string.IsNullOrEmpty(buildId);
                if (!isGameUpdate)
                    continue;

                string title = item.TryGetProperty("event_name", out var t) ? t.GetString() ?? "" : "";
                
                string body = "";
                if (item.TryGetProperty("announcement_body", out var bObj) && bObj.ValueKind == JsonValueKind.Object)
                {
                    body = bObj.TryGetProperty("body", out var bStr) ? bStr.GetString() ?? "" : "";
                }
                
                long postTime = item.TryGetProperty("rtime32_start_time", out var pt) ? pt.GetInt64() : 0;
                string? eventId = item.TryGetProperty("gid", out var gid) ? gid.GetString() : null;

                list.Add(new SteamEventRaw
                {
                    Title = StripBbCode(title),
                    Body = StripBbCode(body),
                    PostTime = postTime,
                    BuildId = buildId,
                    EventId = eventId
                });
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning("[Events] Error fetching events for AppID {AppId}: {Message}", appId, ex.Message);
        }

        return list;
    }

    private async Task<string> GetStringWithRetryAsync(string url)
    {
        for (int attempt = 0; attempt <= MaxRetries; attempt++)
        {
            using var response = await http.GetAsync(url);

            if (response.IsSuccessStatusCode)
                return await response.Content.ReadAsStringAsync();

            if (response.StatusCode == HttpStatusCode.TooManyRequests)
            {
                if (attempt == MaxRetries)
                {
                    response.EnsureSuccessStatusCode();
                }

                var delay = GetRetryDelay(response, attempt);
                logger.LogWarning(
                    "[Events] HTTP 429 — retry {Attempt}/{Max} after {DelayMs}ms",
                    attempt + 1, MaxRetries, (int)delay.TotalMilliseconds);

                await Task.Delay(delay);
                await EnforceRateLimitAsync();
                continue;
            }

            response.EnsureSuccessStatusCode();
        }

        throw new HttpRequestException("Unexpected retry loop exit.");
    }

    private static TimeSpan GetRetryDelay(HttpResponseMessage response, int attempt)
    {
        if (response.Headers.RetryAfter?.Delta is { } delta)
            return delta;

        if (response.Headers.RetryAfter?.Date is { } date)
        {
            var wait = date - DateTimeOffset.UtcNow;
            return wait > TimeSpan.Zero ? wait : TimeSpan.FromSeconds(1);
        }

        // Exponential backoff: 2s, 4s, 8s, 16s, 32s (capped at 60s)
        var seconds = Math.Min(60, Math.Pow(2, attempt + 1));
        return TimeSpan.FromSeconds(seconds);
    }

    private static string? ExtractBuildIdFromJsonData(JsonElement item)
    {
        // 1. Direct property on event item
        if (item.TryGetProperty("build_id", out var bid1))
        {
            var str = bid1.GetString() ?? bid1.GetRawText();
            if (!string.IsNullOrEmpty(str) && str != "0") return str.Trim('"', ' ');
        }

        if (item.TryGetProperty("buildid", out var bid2))
        {
            var str = bid2.GetString() ?? bid2.GetRawText();
            if (!string.IsNullOrEmpty(str) && str != "0") return str.Trim('"', ' ');
        }

        // 2. jsondata property (object or serialized json string)
        if (item.TryGetProperty("jsondata", out var js))
        {
            try
            {
                if (js.ValueKind == JsonValueKind.Object)
                {
                    if (js.TryGetProperty("build_id", out var b1)) return (b1.GetString() ?? b1.GetRawText()).Trim('"', ' ');
                    if (js.TryGetProperty("buildid", out var b2)) return (b2.GetString() ?? b2.GetRawText()).Trim('"', ' ');
                    if (js.TryGetProperty("published_build_id", out var b3)) return (b3.GetString() ?? b3.GetRawText()).Trim('"', ' ');
                }
                else if (js.ValueKind == JsonValueKind.String && !string.IsNullOrEmpty(js.GetString()))
                {
                    using var jsDoc = JsonDocument.Parse(js.GetString()!);
                    if (jsDoc.RootElement.TryGetProperty("build_id", out var b1)) return (b1.GetString() ?? b1.GetRawText()).Trim('"', ' ');
                    if (jsDoc.RootElement.TryGetProperty("buildid", out var b2)) return (b2.GetString() ?? b2.GetRawText()).Trim('"', ' ');
                    if (jsDoc.RootElement.TryGetProperty("published_build_id", out var b3)) return (b3.GetString() ?? b3.GetRawText()).Trim('"', ' ');
                }
            }
            catch
            {
                // ignore json parsing errors
            }
        }

        return null;
    }

    private static string StripBbCode(string input)
    {
        if (string.IsNullOrEmpty(input))
            return "";

        string cleaned = BbCodeRegex.Replace(input, "");
        cleaned = Regex.Replace(cleaned, @"\[[^\]]+\]", "");
        return cleaned.Trim();
    }

    private async Task EnforceRateLimitAsync()
    {
        await _rateLimiter.WaitAsync();
        try
        {
            var elapsed = DateTime.UtcNow - _lastRequest;
            if (elapsed.TotalMilliseconds < 1100)
                await Task.Delay(1100 - (int)elapsed.TotalMilliseconds);

            _lastRequest = DateTime.UtcNow;
        }
        finally
        {
            _rateLimiter.Release();
        }
    }
}
