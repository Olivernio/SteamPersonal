using System.Text.RegularExpressions;
using SteamPersonal.SyncWorker.Models;

namespace SteamPersonal.SyncWorker;

public static class VersionCrossReferencer
{
    private static readonly Regex StrictSemVerRegex = new(
        @"\bv?\.?\s*(\d+\.\d+(\.\d+)*([a-z]|\-rc\d+|\-beta\d+|\-hotfix\d*|\.hotfix\d*)?)\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex PatchNameRegex = new(
        @"\b(Patch|Hotfix|Update|Build|Version|Ver)\s*#?\s*(\d+(\.\d+)*([a-z]|\-rc\d+|\-beta\d+)?)\b",
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
            else
            {
                // Try extracting BuildId from Title or Body text (e.g. "Patch Notes (Build 23066429)")
                resolvedBuildId = ExtractBuildIdFromText(ev.Title) ?? ExtractBuildIdFromText(ev.Body);

                if (string.IsNullOrEmpty(resolvedBuildId) && picsInfo.HasValue && Math.Abs(ev.PostTime - picsInfo.Value.TimeUpdated) < 86400)
                {
                    resolvedBuildId = picsInfo.Value.BuildId;
                }
            }

            if (resolvedBuildId != null && existingBuildIds.Contains(resolvedBuildId))
                continue;

            string releaseDate = DateTimeOffset.FromUnixTimeSeconds(ev.PostTime)
                .ToString("yyyy-MM-dd");

            // Extract genuine version from Title first, then from Body
            string? extractedVersion = ExtractVersion(ev.Title) ?? ExtractVersion(ev.Body);

            string? version = null;
            if (!string.IsNullOrEmpty(extractedVersion))
            {
                version = extractedVersion;
            }
            else if (!string.IsNullOrEmpty(resolvedBuildId))
            {
                version = $"Build {resolvedBuildId}";
            }

            // CRITICAL: If no real version or build ID was found, skip this event (do NOT create fake 'Update YYYY-MM-DD')
            if (string.IsNullOrEmpty(version))
                continue;

            // Deduplicate against existing DB versions
            var existingEntry = existingVersions.FirstOrDefault(v =>
                v.VersionName.Equals(version, StringComparison.OrdinalIgnoreCase) ||
                (v.BuildId != null && v.BuildId == resolvedBuildId));

            if (existingEntry != null)
            {
                // Already exists in DB
                continue;
            }

            // Deduplicate against versions generated in this run
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

    private static readonly Regex BuildIdRegex = new(
        @"\b(?:Build|BuildId|Build-ID|Build_ID)\s*[:#\s]?\s*(\d{5,12})\b",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static string? ExtractBuildIdFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        var m = BuildIdRegex.Match(text);
        return m.Success ? m.Groups[1].Value : null;
    }

    public static string? ExtractVersion(string text)
    {
        if (string.IsNullOrWhiteSpace(text))
            return null;

        // 1. Check for explicit Patch/Hotfix/Update (e.g. "Patch 1.2", "Hotfix 3", "Update 4", "Version 2.1")
        var patchMatch = PatchNameRegex.Match(text);
        if (patchMatch.Success)
        {
            string kind = patchMatch.Groups[1].Value;
            string num = patchMatch.Groups[2].Value;
            if (kind.Equals("ver", StringComparison.OrdinalIgnoreCase) || kind.Equals("version", StringComparison.OrdinalIgnoreCase))
            {
                return "v" + num;
            }
            return $"{kind} {num}";
        }

        // 2. Check for SemVer (e.g. "v1.0.13", "v.1.0.13", "1.0.13", "v0.9b")
        var semVerMatch = StrictSemVerRegex.Match(text);
        if (semVerMatch.Success)
        {
            string val = semVerMatch.Groups[1].Value.TrimStart('.', 'v', 'V', ' ');
            return "v" + val;
        }

        return null;
    }
}
