using System.Text.Json.Serialization;

namespace SteamPersonal.SyncWorker.Models;

[JsonSerializable(typeof(ActiveGameRow))]
[JsonSerializable(typeof(List<ActiveGameRow>))]
[JsonSerializable(typeof(GameCatalogRow))]
[JsonSerializable(typeof(List<GameCatalogRow>))]
[JsonSerializable(typeof(GameVersionDbRow))]
[JsonSerializable(typeof(List<GameVersionDbRow>))]
[JsonSerializable(typeof(GameUpsertPayload))]
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
public partial class SyncWorkerJsonContext : JsonSerializerContext;
