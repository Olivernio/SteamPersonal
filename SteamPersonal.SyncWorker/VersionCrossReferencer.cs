using System.Text.RegularExpressions;
using SteamPersonal.SyncWorker.Models;

namespace SteamPersonal.SyncWorker;

public static class VersionCrossReferencer
{
    private static readonly Regex SemVerRegex = new(
        @"v?(\d+\.\d+(\.\d+)?)",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static List<GameVersionDbRow> Resolve(
        string gameId,
        (string BuildId, long TimeUpdated)? picsInfo,
        List<SteamEventRaw> events,
        List<GameVersionDbRow> existingVersions)
    {
        var newVersions = new List<GameVersionDbRow>();

        var existingBuildIds = existingVersions
            .Where(v => !string.IsNullOrEmpty(v.BuildId))
            .Select(v => v.BuildId!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var existingEventIds = existingVersions
            .Where(v => !string.IsNullOrEmpty(v.EventId))
            .Select(v => v.EventId!)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var addedVersionNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var ev in events)
        {
            if (!string.IsNullOrEmpty(ev.EventId) && existingEventIds.Contains(ev.EventId))
                continue;

            string? resolvedBuildId = null;

            if (!string.IsNullOrEmpty(ev.BuildId))
            {
                resolvedBuildId = ev.BuildId;
            }
            else if (picsInfo.HasValue && Math.Abs(ev.PostTime - picsInfo.Value.TimeUpdated) < 86400)
            {
                resolvedBuildId = picsInfo.Value.BuildId;
            }

            if (resolvedBuildId != null && existingBuildIds.Contains(resolvedBuildId))
                continue;

            string releaseDate = DateTimeOffset.FromUnixTimeSeconds(ev.PostTime)
                .ToString("yyyy-MM-dd");

            string version = ExtractVersion(ev.Title) ?? ExtractVersion(ev.Body)
                             ?? (resolvedBuildId != null ? $"Build {resolvedBuildId}" : $"Update {releaseDate}");

            // Deduplicate against existing DB versions
            var existingEntry = existingVersions.FirstOrDefault(v =>
                v.VersionName.Equals(version, StringComparison.OrdinalIgnoreCase) ||
                (v.BuildId != null && v.BuildId == resolvedBuildId));

            if (existingEntry != null)
            {
                // We already have this version in DB. We skip it to avoid overwriting manual changes.
                continue;
            }

            // Deduplicate against versions we ALREADY generated in this loop
            if (addedVersionNames.Contains(version))
                continue;

            addedVersionNames.Add(version);

            newVersions.Add(new GameVersionDbRow
            {
                GameId = gameId,
                VersionName = version,
                BuildId = resolvedBuildId,
                ReleaseDate = releaseDate,
                ChangelogTitle = ev.Title,
                ChangelogBody = ev.Body,
                Source = "steam_event",
                EventId = ev.EventId,
                UpdatedAt = DateTime.UtcNow.ToString("o")
            });

            if (resolvedBuildId != null)
                existingBuildIds.Add(resolvedBuildId);
            
            if (ev.EventId != null)
                existingEventIds.Add(ev.EventId);
        }

        return newVersions;
    }

    private static string? ExtractVersion(string text)
    {
        if (string.IsNullOrEmpty(text))
            return null;

        var match = SemVerRegex.Match(text);
        return match.Success ? "v" + match.Groups[1].Value : null;
    }
}
