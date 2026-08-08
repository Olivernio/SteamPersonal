namespace SteamPersonal.SyncWorker.Models;

public record SteamEventRaw
{
    public string Title { get; init; } = "";
    public string Body { get; init; } = "";
    public long PostTime { get; init; }
    public string? BuildId { get; init; }
    public string? EventId { get; init; }
}
