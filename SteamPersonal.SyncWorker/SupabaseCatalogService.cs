using System.Text;
using System.Text.Json;
using SteamPersonal.SyncWorker.Models;

namespace SteamPersonal.SyncWorker;

public class SupabaseCatalogService(HttpClient http, ILogger<SupabaseCatalogService> logger)
{
    private readonly string _supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL")
        ?? throw new InvalidOperationException("SUPABASE_URL environment variable is required.");

    private readonly string _serviceKey = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_KEY")
        ?? throw new InvalidOperationException("SUPABASE_SERVICE_KEY environment variable is required.");

    public async Task<List<(string Uuid, uint AppId)>> GetActiveGamesAsync()
    {
        string url = $"{_supabaseUrl}/rest/v1/games?select=id,steam_appid&is_active=eq.true&steam_appid=not.is.null";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSupabaseHeaders(req);

        using var res = await http.SendAsync(req);
        res.EnsureSuccessStatusCode();

        await using var stream = await res.Content.ReadAsStreamAsync();
        var rows = JsonSerializer.Deserialize(stream, SyncWorkerJsonContext.Default.ListActiveGameRow)
            ?? [];

        return rows
            .Select(r => (Uuid: r.Id, AppId: (uint)r.SteamAppid))
            .Where(x => x.AppId > 0 && !string.IsNullOrEmpty(x.Uuid))
            .ToList();
    }

    public async Task<List<GameVersionDbRow>> GetGameVersionsAsync(string gameUuid)
    {
        string url = $"{_supabaseUrl}/rest/v1/game_versions?game_id=eq.{gameUuid}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSupabaseHeaders(req);

        using var res = await http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
            return [];

        await using var stream = await res.Content.ReadAsStreamAsync();
        return JsonSerializer.Deserialize(stream, SyncWorkerJsonContext.Default.ListGameVersionDbRow) ?? [];
    }

    public async Task UpsertVersionsAsync(
        string gameUuid,
        List<GameVersionDbRow> newVersions,
        string? latestVersion)
    {
        // 1. Update the 'games' table with the latest_official_version
        var gamePayload = new GameUpsertPayload
        {
            Id = gameUuid,
            UpdatedAt = DateTime.UtcNow.ToString("o"),
            LatestOfficialVersion = string.IsNullOrEmpty(latestVersion)
                ? null
                : latestVersion.TrimStart('v')
        };

        string gameBody = JsonSerializer.Serialize(gamePayload, SyncWorkerJsonContext.Default.GameUpsertPayload);
        using var gameReq = new HttpRequestMessage(HttpMethod.Patch, $"{_supabaseUrl}/rest/v1/games?id=eq.{gameUuid}")
        {
            Content = new StringContent(gameBody, Encoding.UTF8, "application/json")
        };
        AddSupabaseHeaders(gameReq);
        await http.SendAsync(gameReq);

        // 2. Upsert the new versions into 'game_versions' table
        if (newVersions.Count == 0)
            return;

        string versionsBody = JsonSerializer.Serialize(newVersions, SyncWorkerJsonContext.Default.ListGameVersionDbRow);
        
        // Use POST with resolution=merge-duplicates to upsert via the unique constraint
        using var versionsReq = new HttpRequestMessage(HttpMethod.Post, $"{_supabaseUrl}/rest/v1/game_versions?on_conflict=game_id,version_name")
        {
            Content = new StringContent(versionsBody, Encoding.UTF8, "application/json")
        };
        AddSupabaseHeaders(versionsReq);
        versionsReq.Headers.Remove("Prefer");
        versionsReq.Headers.Add("Prefer", "resolution=merge-duplicates, return=minimal");

        using var res = await http.SendAsync(versionsReq);
        if (!res.IsSuccessStatusCode)
        {
            string err = await res.Content.ReadAsStringAsync();
            logger.LogError("[Supabase] Error upserting game versions for {Uuid}: {Error}", gameUuid, err);
        }
        else
        {
            logger.LogInformation(
                "[Supabase] Synced {Count} version(s) for game {Uuid}",
                newVersions.Count, gameUuid);
        }
    }

    private void AddSupabaseHeaders(HttpRequestMessage req)
    {
        req.Headers.Add("apikey", _serviceKey);
        req.Headers.Add("Authorization", $"Bearer {_serviceKey}");
        req.Headers.Add("Prefer", "return=minimal");
    }
}
