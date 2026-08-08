using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SteamPersonal.SyncWorker;

// Cargar variables de entorno desde el archivo .env (si existe)
DotNetEnv.Env.Load();

var services = new ServiceCollection();
services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));
services.AddHttpClient<SteamEventsClient>(c =>
{
    c.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamPersonalWorker/1.0");
    c.DefaultRequestHeaders.Add("Cookie", "birthtime=283993201; lastagecheckage=1-January-1979; wants_mature_content=1");
    c.Timeout = TimeSpan.FromSeconds(30);
});
services.AddHttpClient<SupabaseCatalogService>(c =>
    c.Timeout = TimeSpan.FromSeconds(15));
services.AddTransient<SteamSyncWorker>();

var sp = services.BuildServiceProvider();
var worker = sp.GetRequiredService<SteamSyncWorker>();

await worker.RunAsync();
