using System.Text.Json.Serialization;

namespace SteamPersonal.SyncWorker.Models;

public class GameVersionDlcDbRow
{
    [JsonPropertyName("game_version_id")]
    public string GameVersionId { get; set; } = string.Empty;

    [JsonPropertyName("dlc_id")]
    public string DlcId { get; set; } = string.Empty;
}
