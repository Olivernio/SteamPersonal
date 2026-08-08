using System.Text.Json.Serialization;

namespace SteamPersonal.SyncWorker.Models;

public record ActiveGameRow
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = "";

    [JsonPropertyName("steam_appid")]
    public long SteamAppid { get; init; }
}
