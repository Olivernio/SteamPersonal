using SteamKit2;

namespace SteamPersonal.SyncWorker;

public class SteamPicsClient : IAsyncDisposable
{
    private SteamClient? _steamClient;
    private CallbackManager? _manager;
    private SteamUser? _steamUser;
    private SteamApps? _steamApps;

    public async Task<(string BuildId, long TimeUpdated)?> GetPublicBranchInfoAsync(uint appId)
    {
        _steamClient = new SteamClient();
        _manager = new CallbackManager(_steamClient);
        _steamUser = _steamClient.GetHandler<SteamUser>()!;
        _steamApps = _steamClient.GetHandler<SteamApps>()!;

        var tcs = new TaskCompletionSource<(string, long)?>(TaskCreationOptions.RunContinuationsAsynchronously);

        _manager.Subscribe<SteamClient.ConnectedCallback>(_ =>
            _steamUser!.LogOnAnonymous());

        _manager.Subscribe<SteamUser.LoggedOnCallback>(async cb =>
        {
            if (cb.Result != EResult.OK)
            {
                tcs.TrySetResult(null);
                return;
            }

            try
            {
                var request = new SteamApps.PICSRequest(appId);
                var result = await _steamApps!.PICSGetProductInfo(request, null);

                if (result.Results?.FirstOrDefault()?.Apps.TryGetValue(appId, out var productInfo) == true)
                {
                    var branches = productInfo.KeyValues["depots"]["branches"]["public"];
                    string buildId = branches["buildid"].Value ?? "";
                    long timeUpdated = long.TryParse(branches["timeupdated"].Value, out var t) ? t : 0;
                    tcs.TrySetResult((buildId, timeUpdated));
                }
                else
                {
                    tcs.TrySetResult(null);
                }
            }
            catch
            {
                tcs.TrySetResult(null);
            }
            finally
            {
                _steamUser!.LogOff();
            }
        });

        _manager.Subscribe<SteamClient.DisconnectedCallback>(_ =>
            tcs.TrySetResult(null));

        _steamClient.Connect();

        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));

        // Si el timeout expira antes de que PICS responda, desbloquear el await
        cts.Token.Register(() => tcs.TrySetResult(null));

        _ = Task.Run(() =>
        {
            while (!tcs.Task.IsCompleted && !cts.Token.IsCancellationRequested)
                _manager.RunWaitCallbacks(TimeSpan.FromSeconds(1));
        }, cts.Token);

        return await tcs.Task;
    }

    public ValueTask DisposeAsync()
    {
        _steamClient?.Disconnect();
        return ValueTask.CompletedTask;
    }
}
