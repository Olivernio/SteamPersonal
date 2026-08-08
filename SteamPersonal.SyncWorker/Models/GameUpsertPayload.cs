using System.Text.Json.Serialization;

namespace SteamPersonal.SyncWorker.Models;

public record GameUpsertPayload
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = "";



    [JsonPropertyName("updated_at")]
    public string UpdatedAt { get; init; } = "";

    [JsonPropertyName("latest_official_version")]
    public string? LatestOfficialVersion { get; init; }
}
