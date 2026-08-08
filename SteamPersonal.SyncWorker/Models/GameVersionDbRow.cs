using System.Text.Json.Serialization;

namespace SteamPersonal.SyncWorker.Models;

public class GameVersionDbRow
{
    [JsonPropertyName("game_id")]
    public string GameId { get; set; } = string.Empty;

    [JsonPropertyName("version_name")]
    public string VersionName { get; set; } = string.Empty;

    [JsonPropertyName("build_id")]
    public string? BuildId { get; set; }

    [JsonPropertyName("release_date")]
    public string ReleaseDate { get; set; } = string.Empty;

    [JsonPropertyName("download_url")]
    public string? DownloadUrl { get; set; }

    [JsonPropertyName("is_available")]
    public bool IsAvailable { get; set; }

    [JsonPropertyName("changelog_title")]
    public string? ChangelogTitle { get; set; }

    [JsonPropertyName("changelog_body")]
    public string? ChangelogBody { get; set; }

    [JsonPropertyName("source")]
    public string Source { get; set; } = "steam_event";

    [JsonPropertyName("event_id")]
    public string? EventId { get; set; }

    [JsonPropertyName("updated_at")]
    public string UpdatedAt { get; set; } = string.Empty;
}
