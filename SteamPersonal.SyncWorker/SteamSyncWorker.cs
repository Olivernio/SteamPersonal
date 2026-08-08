using System.Text.RegularExpressions;

namespace SteamPersonal.SyncWorker;

public class SteamSyncWorker(
    SteamEventsClient eventsClient,
    SupabaseCatalogService catalogService,
    ILogger<SteamSyncWorker> logger)
{
    public async Task RunAsync()
    {
        logger.LogInformation("[Worker] === SteamPersonal Sync Start: {Time} ===", DateTime.UtcNow);

        var games = await catalogService.GetActiveGamesAsync();
        logger.LogInformation("[Worker] Processing {Count} active game(s)...", games.Count);

        foreach (var (uuid, appId) in games)
        {
            try
            {
                await ProcessAppAsync(uuid, appId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[Worker] Unhandled error processing AppID {AppId}", appId);
            }

            // GC.Collect completo para entornos de 1 GB RAM (Workstation GC)
            GC.Collect();
            await Task.Delay(2000);
        }

        logger.LogInformation("[Worker] === Sync Complete ===");
    }

    private async Task ProcessAppAsync(string gameUuid, uint appId)
    {
        logger.LogInformation("[Worker] Processing AppID {AppId} (UUID: {Uuid})", appId, gameUuid);

        (string BuildId, long TimeUpdated)? picsInfo = null;
        await using var picsClient = new SteamPicsClient();
        try
        {
            picsInfo = await picsClient.GetPublicBranchInfoAsync(appId);
            if (picsInfo.HasValue)
                logger.LogDebug("[PICS] AppID {AppId} → BuildID: {BuildId}", appId, picsInfo.Value.BuildId);
        }
        catch (Exception ex)
        {
            logger.LogWarning("[PICS] Failed for AppID {AppId}: {Message}", appId, ex.Message);
        }

        var events = await eventsClient.FetchEventsAsync(appId, 200);
        logger.LogDebug("[Events] AppID {AppId} → {Count} events fetched", appId, events.Count);

        var existingVersions = await catalogService.GetGameVersionsAsync(gameUuid);
        var newVersions = VersionCrossReferencer.Resolve(gameUuid, picsInfo, events, existingVersions);

        if (newVersions.Count == 0)
        {
            logger.LogInformation("[Worker] AppID {AppId} → No new versions found.", appId);
            return;
        }

        var allVersions = newVersions.Concat(existingVersions).ToList();

        string? latestVersion = allVersions
            .Where(v => Regex.IsMatch(v.VersionName, @"v?\d+\.\d+"))
            .OrderByDescending(v => v.ReleaseDate)
            .FirstOrDefault()?.VersionName;

        await catalogService.UpsertVersionsAsync(gameUuid, newVersions, latestVersion);
        logger.LogInformation("[Worker] AppID {AppId} → {Count} new version(s) synced.", appId, newVersions.Count);
    }
}
