# Blueprint Mejorado: Steam Data Synchronization Worker
### Proyecto: SteamPersonal — Revisión Senior

---

> [!IMPORTANT]
> Este blueprint fue adaptado al **estado real del proyecto** tras análisis directo del código fuente en `d:\Proyectos\SteamPersonal`. El original tenía varios desajustes con la arquitectura existente que se corrigen aquí.

---

## 1. Análisis Crítico del Blueprint Original

### Problemas Identificados

| # | Problema | Impacto |
|---|----------|---------|
| 1 | **Namespace incorrecto**: `SteamPersonal.Worker` no existe en el proyecto | El código no compilaría en la solución actual |
| 2 | **Dependencia de Supabase SDK no declarada**: el `.csproj` no incluye el paquete `Supabase` | Build failure inmediato |
| 3 | **`ProcessAppAsync` ignora SteamKit2 PICS**: se menciona en el diseño pero el código solo llama a la Web API | La mitad del algoritmo de 3 capas no se implementa |
| 4 | **`UpdateSupabaseCatalogAsync` es un stub vacío** (`await Task.CompletedTask`) | No actualiza nada en producción |
| 5 | **Sin `steam_appid` en el modelo de datos**: el blueprint usa `appId` genérico pero la tabla `games` usa `steam_appid BIGINT` | Desalineación con schema real de Supabase |
| 6 | **`available_versions` es JSONB, no tabla relacional**: el blueprint sugiere ambas opciones sin aclarar | La arquitectura real ya define JSONB en `games.available_versions` |
| 7 | **Sin manejo de `changelog`**: la tabla ya tiene columna `changelog JSONB` que el worker debería poblar | Feature perdida |
| 8 | **Sin mecanismo de idempotencia**: si el worker corre dos veces, duplica versiones en el array JSONB | Data corruption en producción |
| 9 | **`CleanBbCode` insuficiente**: Steam usa BBCode complejo (`[previewyoutube]`, `[table]`, etc.) | Patch notes con ruido HTML/BBCode en la UI |
| 10 | **Sin rate-limiting contra la Steam Store API** | Posible bloqueo de IP del VPS Oracle |

---

## 2. Contexto & Arquitectura Real del Proyecto

```
SteamPersonal/
├── Program.cs                   ← WinForms host + WebView2 bridge (C# ↔ JS)
├── GameDownloaderService.cs     ← Descarga + extracción en streaming
├── Services/
│   ├── GameLauncherService.cs   ← Lanzador con monitoreo de proceso
│   ├── GameRecipeService.cs     ← Pipeline de instalación por pasos (JSONB)
│   ├── SavegameService.cs       ← Backup/restore de partidas en Oracle Cloud
│   ├── SettingsManager.cs       ← Config local (steamApiKey, showBuildId)
│   ├── Achievements/            ← Monitoreo de logros Goldberg SteamEmu
│   └── Models/
│       ├── DownloadManifest.cs  ← Manifest de archivos descargados
│       └── InstallationRecipe.cs
├── documentation/
│   ├── blueprint.md             ← Blueprint original (este archivo)
│   ├── scripts_de_sql.sql       ← Schema completo de Supabase
│   └── oracle_savegame_server.js
└── wwwroot/ (o Vite dev server en :5173)  ← Frontend React/Vue
```

### Guardrails de Arquitectura (Actualizados)

- **App Cliente (.NET 10 WinForms + WebView2):** Lee Supabase en modo anónimo (`anon` key). Cero llamadas a SteamKit2 en el cliente. La UI es un frontend web servido por WebView2.
- **Worker de Sincronización (.NET 10 Console / Systemd Timer):** Proyecto **separado** que corre en el VPS de Oracle Cloud. Escribe en Supabase con credenciales de `service_role`.
- **Restricción de RAM:** `< 150 MB`. Procesar app por app. GC workstation, no server.
- **Comunicación Frontend↔Backend:** Ya existe un bridge `PostWebMessageAsJson` / `WebMessageReceived` documentado en `Program.cs`. El worker NO interactúa con este bridge; sólo con Supabase.

---

## 3. Schema de Base de Datos Real (Inferido del SQL existente)

### Tabla `games` — Columnas relevantes para el Worker

```sql
-- Columnas ya existentes en Supabase (games table)
steam_appid              BIGINT,          -- AppID de Steam para PICS lookup
latest_official_version  TEXT,            -- Versión más reciente en formato "1.2.4"
available_versions       JSONB DEFAULT '[]'::jsonb,  -- Array de versiones disponibles
changelog                JSONB DEFAULT '[]'::jsonb,  -- Historial de cambios
updated_at               TIMESTAMPTZ,     -- Auto-actualizar en cada sync
is_active                BOOLEAN,         -- Solo sincronizar juegos activos
```

### Estructura JSONB para `available_versions` (Mejorada)

```json
[
  {
    "version": "v1.2.4",
    "build_id": "14259012",
    "release_date": "2026-08-01",
    "url": "https://drive.google.com/file/d/...",
    "notes": "Fixed boss collision bugs in Nexus Core and added performance optimizations.",
    "is_available": true,
    "synced_at": "2026-08-07T22:00:00Z"
  }
]
```

### Estructura JSONB para `changelog` (Nueva — no estaba en el blueprint)

```json
[
  {
    "version": "v1.2.4",
    "build_id": "14259012",
    "date": "2026-08-01",
    "title": "Patch 1.2.4 — Nexus Core Fixes",
    "body": "Fixed boss collision bugs...",
    "source": "steam_event",
    "event_id": "4567890"
  }
]
```

---

## 4. Pipeline Mejorado: Algoritmo de 4 Capas

El pipeline original de 3 capas se expande a **4 capas** para incluir idempotencia.

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 1: PICS Query (SteamKit2 — BuildID + Timestamp)  │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  LAYER 2: Steam Store Events API (Patch Notes + SemVer) │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  LAYER 3: Cross-Reference Resolution (3 Rules)          │
│   Rule 1: Direct build_id match                        │
│   Rule 2: Time-delta < 86400s                          │
│   Rule 3: SemVer regex extraction                      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│  LAYER 4: Idempotent Merge & Supabase Upsert            │
│   - Skip if build_id already exists in JSONB array     │
│   - Merge new entries, preserve existing URLs          │
│   - Update latest_official_version if newer            │
└─────────────────────────────────────────────────────────┘
```

### Reglas de Cross-Reference (Sin cambios, correctas)

1. **Regla 1 (Direct Match):** Si el payload del evento contiene `build_id` no vacío → match directo con PICS `buildid`.
2. **Regla 2 (Time-Delta Match):** Si falta `build_id` → match si `|post_time - timeupdated| < 86400` segundos.
3. **Regla 3 (SemVer Extraction):** Extraer versión de `event_title` o `announcement_body` con regex `v?(\d+\.\d+(\.\d+)?)`. Fallback: `Build {build_id}`.

---

## 5. Implementación C# Completa (.NET 10)

### 5.1 Proyecto separado recomendado

```
SteamPersonal.SyncWorker/         ← Nuevo proyecto Console
├── SteamPersonal.SyncWorker.csproj
├── Program.cs                    ← Entry point + DI
├── SteamSyncWorker.cs            ← Orquestador principal
├── SteamPicsClient.cs            ← SteamKit2 PICS wrapper
├── SteamEventsClient.cs          ← Steam Store API wrapper
├── VersionCrossReferencer.cs     ← Algoritmo de 4 capas
├── SupabaseCatalogService.cs     ← Supabase read/write
└── Models/
    ├── GameVersionEntry.cs
    ├── ChangelogEntry.cs
    └── SteamEventRaw.cs
```

### 5.2 `.csproj` Corregido

```xml
<Project Sdk="Microsoft.NET.Sdk.Worker">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <!-- CRÍTICO: Workstation GC para VPS 1 GB Oracle -->
    <ServerGarbageCollection>false</ServerGarbageCollection>
    <GarbageCollectionAdaptationMode>0</GarbageCollectionAdaptationMode>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="SteamKit2" Version="3.4.0" />
    <!-- Supabase HTTP directo — más liviano que el SDK oficial -->
    <PackageReference Include="Postgrest" Version="4.0.3" />
    <PackageReference Include="Microsoft.Extensions.Http" Version="10.0.0" />
    <PackageReference Include="Microsoft.Extensions.Logging.Console" Version="10.0.0" />
  </ItemGroup>
</Project>
```

> [!TIP]
> Se usa `Postgrest` directamente en lugar del SDK completo de Supabase para mantener el footprint de RAM mínimo. El SDK de Supabase incluye Realtime/Auth que no necesitamos.

### 5.3 Modelos de Datos

```csharp
// Models/GameVersionEntry.cs
namespace SteamPersonal.SyncWorker.Models;

public record GameVersionEntry
{
    [JsonPropertyName("version")]    public string Version { get; init; } = "";
    [JsonPropertyName("build_id")]   public string BuildId { get; init; } = "";
    [JsonPropertyName("release_date")] public string ReleaseDate { get; init; } = "";
    [JsonPropertyName("url")]        public string? Url { get; init; }
    [JsonPropertyName("notes")]      public string Notes { get; init; } = "";
    [JsonPropertyName("is_available")] public bool IsAvailable { get; init; }
    [JsonPropertyName("synced_at")]  public string SyncedAt { get; init; } = DateTime.UtcNow.ToString("o");
}

// Models/ChangelogEntry.cs
public record ChangelogEntry
{
    [JsonPropertyName("version")]   public string Version { get; init; } = "";
    [JsonPropertyName("build_id")]  public string BuildId { get; init; } = "";
    [JsonPropertyName("date")]      public string Date { get; init; } = "";
    [JsonPropertyName("title")]     public string Title { get; init; } = "";
    [JsonPropertyName("body")]      public string Body { get; init; } = "";
    [JsonPropertyName("source")]    public string Source { get; init; } = "steam_event";
    [JsonPropertyName("event_id")]  public string? EventId { get; init; }
}

// Models/SteamEventRaw.cs
public record SteamEventRaw
{
    public string Title { get; init; } = "";
    public string Body { get; init; } = "";
    public long PostTime { get; init; }
    public string? BuildId { get; init; }
    public string? EventId { get; init; }
}
```

### 5.4 SteamPicsClient — PICS real con SteamKit2

```csharp
// SteamPicsClient.cs
namespace SteamPersonal.SyncWorker;

public class SteamPicsClient : IAsyncDisposable
{
    private SteamClient? _steamClient;
    private CallbackManager? _manager;
    private SteamUser? _steamUser;
    private SteamApps? _steamApps;
    private bool _isConnected;

    public async Task<(string BuildId, long TimeUpdated)?> GetPublicBranchInfoAsync(uint appId)
    {
        // Inicializar conexión anónima
        _steamClient = new SteamClient();
        _manager = new CallbackManager(_steamClient);
        _steamUser = _steamClient.GetHandler<SteamUser>()!;
        _steamApps = _steamClient.GetHandler<SteamApps>()!;

        var tcs = new TaskCompletionSource<(string, long)?>();

        _manager.Subscribe<SteamClient.ConnectedCallback>(cb =>
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

        _manager.Subscribe<SteamClient.DisconnectedCallback>(cb =>
            tcs.TrySetResult(null));

        _steamClient.Connect();

        // Pump callbacks en un hilo separado con timeout
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(30));
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
```

### 5.5 SteamEventsClient — Steam Store API con Rate Limiting

```csharp
// SteamEventsClient.cs
namespace SteamPersonal.SyncWorker;

public class SteamEventsClient(HttpClient http, ILogger<SteamEventsClient> logger)
{
    private static readonly Regex SemVerRegex = new(@"v?(\d+\.\d+(\.\d+)?)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex BbCodeRegex = new(@"\[(?:previewyoutube|img|table|tr|td|th|h[1-6]|list|olist|\*|b|i|u|s|strike|url|quote|code|spoiler)[^\]]*\].*?\[/\1\]|\[[^\]]+\]", RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);

    // Rate limiting: máx 1 req/s para no provocar ban de IP en el VPS Oracle
    private readonly SemaphoreSlim _rateLimiter = new(1, 1);
    private DateTime _lastRequest = DateTime.MinValue;

    public async Task<List<SteamEventRaw>> FetchEventsAsync(uint appId, int count = 25)
    {
        await EnforceRateLimitAsync();

        var list = new List<SteamEventRaw>();
        string url = $"https://store.steampowered.com/events/ajaxgeteventdetailscollection?appid={appId}&count={count}&l=english";

        try
        {
            string json = await http.GetStringAsync(url);
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("events", out var eventsArr))
                return list;

            foreach (var item in eventsArr.EnumerateArray())
            {
                // Solo procesar eventos de tipo "patch notes" (type=14) o "update" (type=12)
                int eventType = item.TryGetProperty("event_type", out var et) ? et.GetInt32() : -1;
                if (eventType != -1 && eventType != 12 && eventType != 14)
                    continue;

                string title = item.TryGetProperty("event_name", out var t) ? t.GetString() ?? "" : "";
                string body  = item.TryGetProperty("announcement_body", out var b) ? b.GetString() ?? "" : "";
                long postTime = item.TryGetProperty("post_time", out var pt) ? pt.GetInt64() : 0;
                string? eventId = item.TryGetProperty("gid", out var gid) ? gid.GetString() : null;

                string? buildId = ExtractBuildIdFromJsonData(item);

                list.Add(new SteamEventRaw
                {
                    Title = StripBbCode(title),
                    Body = StripBbCode(body),
                    PostTime = postTime,
                    BuildId = buildId,
                    EventId = eventId
                });
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning("[PICS] Error fetching events for AppID {AppId}: {Message}", appId, ex.Message);
        }

        return list;
    }

    private static string? ExtractBuildIdFromJsonData(JsonElement item)
    {
        if (!item.TryGetProperty("jsondata", out var js) || string.IsNullOrEmpty(js.GetString()))
            return null;
        try
        {
            using var jsDoc = JsonDocument.Parse(js.GetString()!);
            return jsDoc.RootElement.TryGetProperty("build_id", out var bid)
                ? bid.GetString() ?? bid.GetRawText()
                : null;
        }
        catch { return null; }
    }

    private static string StripBbCode(string input)
    {
        if (string.IsNullOrEmpty(input)) return "";
        // Eliminar BBCode con contenido anidado primero, luego tags simples
        string cleaned = BbCodeRegex.Replace(input, "");
        cleaned = Regex.Replace(cleaned, @"\[[^\]]+\]", "");
        return cleaned.Trim();
    }

    private async Task EnforceRateLimitAsync()
    {
        await _rateLimiter.WaitAsync();
        try
        {
            var elapsed = DateTime.UtcNow - _lastRequest;
            if (elapsed.TotalMilliseconds < 1100)
                await Task.Delay(1100 - (int)elapsed.TotalMilliseconds);
            _lastRequest = DateTime.UtcNow;
        }
        finally { _rateLimiter.Release(); }
    }
}
```

### 5.6 VersionCrossReferencer — Motor de 4 Capas

```csharp
// VersionCrossReferencer.cs
namespace SteamPersonal.SyncWorker;

public static class VersionCrossReferencer
{
    private static readonly Regex SemVerRegex = new(@"v?(\d+\.\d+(\.\d+)?)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public static (List<GameVersionEntry> Versions, List<ChangelogEntry> Changelog) Resolve(
        (string BuildId, long TimeUpdated)? picsInfo,
        List<SteamEventRaw> events,
        List<GameVersionEntry> existingVersions)
    {
        var versions = new List<GameVersionEntry>();
        var changelog = new List<ChangelogEntry>();

        // Conjunto de build_ids ya existentes (idempotencia — Capa 4)
        var existingBuildIds = existingVersions
            .Select(v => v.BuildId)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var ev in events)
        {
            string? resolvedBuildId = null;

            // Regla 1: Direct match por build_id en el evento
            if (!string.IsNullOrEmpty(ev.BuildId))
            {
                resolvedBuildId = ev.BuildId;
            }
            // Regla 2: Time-delta match con PICS
            else if (picsInfo.HasValue && Math.Abs(ev.PostTime - picsInfo.Value.TimeUpdated) < 86400)
            {
                resolvedBuildId = picsInfo.Value.BuildId;
            }

            if (resolvedBuildId == null) continue;

            // Idempotencia: skip si ya existe este build_id
            if (existingBuildIds.Contains(resolvedBuildId)) continue;

            // Regla 3: Extracción de SemVer
            string version = ExtractVersion(ev.Title) ?? ExtractVersion(ev.Body)
                             ?? $"Build {resolvedBuildId}";

            string releaseDate = DateTimeOffset.FromUnixTimeSeconds(ev.PostTime)
                                              .ToString("yyyy-MM-dd");

            // Preservar URL existente si la versión ya aparece (sin build_id previo)
            var existingEntry = existingVersions.FirstOrDefault(v =>
                v.Version.Equals(version, StringComparison.OrdinalIgnoreCase));

            versions.Add(new GameVersionEntry
            {
                Version = version,
                BuildId = resolvedBuildId,
                ReleaseDate = releaseDate,
                Url = existingEntry?.Url, // Preservar URL si fue asignada manualmente
                Notes = ev.Body.Length > 500 ? ev.Body[..500] + "…" : ev.Body,
                IsAvailable = existingEntry?.IsAvailable ?? false,
                SyncedAt = DateTime.UtcNow.ToString("o")
            });

            changelog.Add(new ChangelogEntry
            {
                Version = version,
                BuildId = resolvedBuildId,
                Date = releaseDate,
                Title = ev.Title,
                Body = ev.Body,
                Source = "steam_event",
                EventId = ev.EventId
            });

            existingBuildIds.Add(resolvedBuildId); // Evitar duplicados dentro del mismo batch
        }

        return (versions, changelog);
    }

    private static string? ExtractVersion(string text)
    {
        if (string.IsNullOrEmpty(text)) return null;
        var match = SemVerRegex.Match(text);
        return match.Success ? "v" + match.Groups[1].Value : null;
    }
}
```

### 5.7 SupabaseCatalogService — Lectura/Escritura JSONB

```csharp
// SupabaseCatalogService.cs
namespace SteamPersonal.SyncWorker;

public class SupabaseCatalogService(HttpClient http, ILogger<SupabaseCatalogService> logger)
{
    private readonly string _supabaseUrl = Environment.GetEnvironmentVariable("SUPABASE_URL")!;
    private readonly string _serviceKey  = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_KEY")!;

    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public async Task<List<(string Uuid, uint AppId)>> GetActiveGamesAsync()
    {
        string url = $"{_supabaseUrl}/rest/v1/games?select=id,steam_appid&is_active=eq.true&steam_appid=not.is.null";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSupabaseHeaders(req);

        using var res = await http.SendAsync(req);
        res.EnsureSuccessStatusCode();

        string json = await res.Content.ReadAsStringAsync();
        var rows = JsonDocument.Parse(json).RootElement.EnumerateArray();

        return rows
            .Select(r => (
                Uuid: r.GetProperty("id").GetString() ?? "",
                AppId: (uint)(r.TryGetProperty("steam_appid", out var a) ? a.GetInt64() : 0)
            ))
            .Where(x => x.AppId > 0)
            .ToList();
    }

    public async Task<List<GameVersionEntry>> GetExistingVersionsAsync(string gameUuid)
    {
        string url = $"{_supabaseUrl}/rest/v1/games?select=available_versions&id=eq.{gameUuid}";
        using var req = new HttpRequestMessage(HttpMethod.Get, url);
        AddSupabaseHeaders(req);

        using var res = await http.SendAsync(req);
        if (!res.IsSuccessStatusCode) return [];

        string json = await res.Content.ReadAsStringAsync();
        var root = JsonDocument.Parse(json).RootElement;
        if (root.GetArrayLength() == 0) return [];

        var versionsJson = root[0].GetProperty("available_versions").GetRawText();
        return JsonSerializer.Deserialize<List<GameVersionEntry>>(versionsJson, JsonOpts) ?? [];
    }

    public async Task UpsertVersionsAsync(
        string gameUuid,
        List<GameVersionEntry> allVersions,    // Existentes + nuevas
        List<ChangelogEntry> allChangelog,
        string? latestVersion)
    {
        var payload = new Dictionary<string, object?>
        {
            ["id"] = gameUuid,
            ["available_versions"] = allVersions,
            ["changelog"] = allChangelog,
            ["updated_at"] = DateTime.UtcNow.ToString("o")
        };

        if (!string.IsNullOrEmpty(latestVersion))
            payload["latest_official_version"] = latestVersion.TrimStart('v');

        string body = JsonSerializer.Serialize(payload, JsonOpts);
        string url = $"{_supabaseUrl}/rest/v1/games?id=eq.{gameUuid}";

        using var req = new HttpRequestMessage(HttpMethod.Patch, url)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        AddSupabaseHeaders(req);

        using var res = await http.SendAsync(req);
        if (!res.IsSuccessStatusCode)
        {
            string err = await res.Content.ReadAsStringAsync();
            logger.LogError("[Supabase] Error upserting game {Uuid}: {Error}", gameUuid, err);
        }
        else
        {
            logger.LogInformation("[Supabase] ✓ Synced {Count} version(s) for game {Uuid}",
                allVersions.Count, gameUuid);
        }
    }

    private void AddSupabaseHeaders(HttpRequestMessage req)
    {
        req.Headers.Add("apikey", _serviceKey);
        req.Headers.Add("Authorization", $"Bearer {_serviceKey}");
        req.Headers.Add("Prefer", "return=minimal");
    }
}
```

### 5.8 SteamSyncWorker — Orquestador Principal

```csharp
// SteamSyncWorker.cs
namespace SteamPersonal.SyncWorker;

public class SteamSyncWorker(
    SteamEventsClient eventsClient,
    SupabaseCatalogService catalogService,
    ILogger<SteamSyncWorker> logger)
{
    public async Task RunAsync()
    {
        logger.LogInformation("[Worker] === SteamPersonal Sync Start: {Time} ===", DateTime.UtcNow);

        var games = await catalogService.GetActiveGamesAsync();
        logger.LogInformation("[Worker] Processing {Count} active game(s)...", games.Count);

        foreach (var (uuid, appId) in games)
        {
            try
            {
                await ProcessAppAsync(uuid, appId);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "[Worker] Unhandled error processing AppID {AppId}", appId);
            }

            // GC hint entre juegos para mantenerse bajo 150 MB
            GC.Collect(0, GCCollectionMode.Optimized);
            await Task.Delay(2000); // Pausa cortesía entre apps
        }

        logger.LogInformation("[Worker] === Sync Complete ===");
    }

    private async Task ProcessAppAsync(string gameUuid, uint appId)
    {
        logger.LogInformation("[Worker] Processing AppID {AppId} (UUID: {Uuid})", appId, gameUuid);

        // Layer 1: PICS (SteamKit2) — conexión y desconexión limpia por app
        (string BuildId, long TimeUpdated)? picsInfo = null;
        await using var picsClient = new SteamPicsClient();
        try
        {
            picsInfo = await picsClient.GetPublicBranchInfoAsync(appId);
            if (picsInfo.HasValue)
                logger.LogDebug("[PICS] AppID {AppId} → BuildID: {BuildId}", appId, picsInfo.Value.BuildId);
        }
        catch (Exception ex)
        {
            logger.LogWarning("[PICS] Failed for AppID {AppId}: {Message}", appId, ex.Message);
        }

        // Layer 2: Steam Events API
        var events = await eventsClient.FetchEventsAsync(appId);
        logger.LogDebug("[Events] AppID {AppId} → {Count} events fetched", appId, events.Count);

        // Layer 3+4: Cross-reference + Idempotent merge
        var existingVersions = await catalogService.GetExistingVersionsAsync(gameUuid);
        var (newVersions, newChangelog) = VersionCrossReferencer.Resolve(picsInfo, events, existingVersions);

        if (newVersions.Count == 0)
        {
            logger.LogInformation("[Worker] AppID {AppId} → No new versions found.", appId);
            return;
        }

        // Combinar existentes + nuevas (nuevas al frente = más recientes primero)
        var mergedVersions = newVersions.Concat(existingVersions).ToList();

        // Determinar latest_official_version (la primera válida con SemVer real)
        string? latestVersion = mergedVersions
            .Where(v => Regex.IsMatch(v.Version, @"v?\d+\.\d+"))
            .OrderByDescending(v => v.ReleaseDate)
            .FirstOrDefault()?.Version;

        await catalogService.UpsertVersionsAsync(gameUuid, mergedVersions, newChangelog, latestVersion);
        logger.LogInformation("[Worker] AppID {AppId} → {Count} new version(s) synced.", appId, newVersions.Count);
    }
}
```

### 5.9 Program.cs — Entry Point

```csharp
// Program.cs
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using SteamPersonal.SyncWorker;

var services = new ServiceCollection();
services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));
services.AddHttpClient<SteamEventsClient>(c =>
{
    c.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SteamPersonalWorker/1.0");
    c.Timeout = TimeSpan.FromSeconds(30);
});
services.AddHttpClient<SupabaseCatalogService>(c =>
    c.Timeout = TimeSpan.FromSeconds(15));
services.AddTransient<SteamSyncWorker>();

var sp = services.BuildServiceProvider();
var worker = sp.GetRequiredService<SteamSyncWorker>();

await worker.RunAsync();
```

---

## 6. Despliegue en Oracle Cloud Free Tier (VPS)

### Variables de Entorno Requeridas

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR..."  # service_role key
```

> [!CAUTION]
> **Nunca** usar la `anon key` en el worker. El worker necesita `service_role` para hacer PATCH en tablas con RLS. La `anon key` solo permite INSERT en `version_requests` y SELECT en juegos activos (ver SQL existente).

### Systemd Timer (Recomendado sobre Cron)

```ini
# /etc/systemd/system/steampersonal-sync.service
[Unit]
Description=SteamPersonal Sync Worker
After=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/steampersonal-worker
ExecStart=/opt/steampersonal-worker/SteamPersonal.SyncWorker
EnvironmentFile=/opt/steampersonal-worker/.env
# Límite de memoria para el cgroup — mata el proceso si supera 150 MB
MemoryMax=150M
MemorySwapMax=0
StandardOutput=journal
StandardError=journal
Restart=no

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/steampersonal-sync.timer
[Unit]
Description=SteamPersonal Sync — cada 8 horas
Requires=steampersonal-sync.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=8h
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
# Activar
systemctl enable --now steampersonal-sync.timer
systemctl list-timers --all | grep steampersonal
```

### Publicación Self-Contained

```bash
dotnet publish SteamPersonal.SyncWorker \
  -c Release \
  -r linux-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:PublishTrimmed=true \
  -o /opt/steampersonal-worker
```

---

## 7. Puntos de Integración con el Cliente WinForms

El worker es **completamente independiente** del cliente WinForms. Sin embargo, el cliente ya está preparado para consumir los datos que el worker produce:

| Campo Supabase (worker escribe) | Campo consumido en `Program.cs` (cliente lee) |
|---|---|
| `games.available_versions` JSONB | Frontend muestra historial de versiones por juego |
| `games.latest_official_version` TEXT | Comparado contra versión instalada localmente |
| `games.changelog` JSONB | UI de notas de parche |
| `games.updated_at` TIMESTAMPTZ | "Última actualización" en tarjeta de juego |

El cliente en `SettingsManager` ya guarda `SteamApiKey`. Esto sugiere que **en el futuro** podría hacer llamadas directas a la Steam Web API para verificar versiones. El worker evita que eso sea necesario en runtime.

---

## 8. Checklist de Implementación

- [ ] **Crear proyecto** `SteamPersonal.SyncWorker` en la solución (o como directorio hermano)
- [ ] **Añadir `.csproj`** con paquetes `SteamKit2`, `Postgrest`, `Microsoft.Extensions.Http`
- [ ] **Configurar variables de entorno** en VPS Oracle (`.env` file)
- [ ] **Implementar** `SteamPicsClient`, `SteamEventsClient`, `VersionCrossReferencer`, `SupabaseCatalogService`, `SteamSyncWorker`, `Program.cs`
- [ ] **Testear localmente** contra AppID real (ej: `1091500` — Cyberpunk 2077)
- [ ] **Publicar** self-contained para `linux-x64`
- [ ] **Configurar Systemd Timer** en el VPS
- [ ] **Verificar en Supabase** que `available_versions` y `changelog` se populan correctamente
- [ ] **Actualizar RLS policies** si es necesario para `service_role`
