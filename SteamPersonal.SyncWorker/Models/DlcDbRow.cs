using System.Text.Json.Serialization;

namespace SteamPersonal.SyncWorker.Models;

public class DlcDbRow
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("game_id")]
    public string GameId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("created_at")]
    public string? CreatedAt { get; set; }
}
