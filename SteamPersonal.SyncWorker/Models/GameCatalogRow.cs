using System.Text.Json.Serialization;

namespace SteamPersonal.SyncWorker.Models;

public record GameCatalogRow
{
    [JsonPropertyName("latest_official_version")]
    public string? LatestOfficialVersion { get; set; }
}
