# Lista de todos tus commits estructurada
$commits = @(
    @{
        Version = "SteamPersonal-01" # Asegúrate de tener la carpeta D:\Proyectos\SteamPersonal-01
        Date    = "2026-08-03 18:31:15"
        Title   = "chore(core): add .gitignore and remove build artifacts."
        Body    = "- Untrack bin/, obj/, dist/, node_modules/ and extracted folders to prevent repository bloat."
    },
    @{
        Version = "SteamPersonal-02"
        Date    = "2026-08-04 23:15:42"
        Title   = "feat(core): initial implementation of Steam Personal desktop client"
        Body    = "- Setup C# WinForms application with Microsoft WebView2 frontend integration.`n- Implement GameDownloaderService supporting Google Drive direct download and confirmation token handling.`n- Add streaming extraction on-the-fly using SharpCompress without saving full archives to disk.`n- Implement live pause, resume, and cancellation mechanics via TrackedStream and ManualResetEventSlim.`n- Setup interop communication bridge between C# backend and Web UI via JSON messages."
    },
    @{
        Version = "SteamPersonal-03"
        Date    = "2026-08-05 00:18:23"
        Title   = "feat(downloader): integrate live download progress and webview bridge"
        Body    = "- Add smoothed speed calculation using exponential moving average in C# download service.`n- Implement bidirectional WebView2 message bridge and React state reducer for live UI updates.`n- Configure dynamic Vite development server detection and virtual host fallback for production bundles."
    },
    @{
        Version = "SteamPersonal-04"
        Date    = "2026-08-05 00:52:11"
        Title   = "feat(launcher): pass dynamic game titles and enable direct downloads from UI"
        Body    = "- Pass `"gameTitle`" payload through the WebView2 bridge when triggering downloads from the React frontend.`n- Update `"Program.cs`" to capture and store the active game title from download requests.`n- Add sample game entry with direct Google Drive download link and wire up download triggers in `"GameDetailView`" and `"LibraryView`"."
    },
    @{
        Version = "SteamPersonal-05"
        Date    = "2026-08-05 01:02:55"
        Title   = "feat(downloader): structure output directories and track extraction file"
        Body    = "- Sanitize game titles to create dedicated destination subfolders under the Juegos directory.`n- Track and emit the current file name being extracted during streaming decompression.`n- Update DownloadsView UI component to cleanly display and truncate extraction file names."
    },
    @{
        Version = "SteamPersonal-06"
        Date    = "2026-08-05 01:26:34"
        Title   = "feat(launcher): implement game execution and playtime tracking"
        Body    = "- Introduce `"GameLauncherService`" to manage process execution, automatic main executable detection, and session time tracking.`n- Wire up WebView2 IPC bridge events (`"GAME_STARTED`", `"GAME_EXITED`", `"LAUNCH_FAILED`") to synchronize frontend state.`n- Enable play buttons in library and detail views to launch installed games and update total playtime dynamically."
    },
    @{
        Version = "SteamPersonal-07"
        Date    = "2026-08-05 09:50:47"
        Title   = "feat(downloader): implement two-phase download/extraction with range resume and retry"
        Body    = "- Separate the download process into two explicit phases: Phase 1 (.part file download with HTTP Range header resume and automatic retry) and Phase 2 (sequential stream extraction).`n- Add robust pause, resume, and cancellation handlers that preserve partial downloads on disk for seamless session recovery.`n- Update frontend UI components to dynamically reflect progress phases (Downloading vs Extracting) with distinct color themes and phase badges."
    },
    @{
        Version = "SteamPersonal-08"
        Date    = "2026-08-05 10:58:19"
        Title   = "feat(downloader): add resume checkpointing and recipe execution"
        Body    = "- Implement unified streaming extraction with `".manifest.json`" tracking to allow persistent file-level resumption after interruptions.`n- Add `"GameRecipeService`" to automate post-extraction installation steps including crack application, Windows Defender exclusions, and desktop shortcut creation.`n- Update frontend communication bridge and UI components to track and display completed file counts during extraction."
    },
    @{
        Version = "SteamPersonal-09"
        Date    = "2026-08-05 14:03:08"
        Title   = "feat(catalog): integrate Supabase client and dynamic game catalog"
        Body    = "- Install `"@supabase/supabase-js`" and implement `"supabaseClient.ts`" service to fetch remote game data and installation recipes.`n- Update `"App.tsx`" and data models to load dynamic game lists from Supabase on startup with local fallback support.`n- Add global runtime error and unhandled promise rejection interceptors in `"index.html`" for improved WebView2 debugging."
    },
    @{
        Version = "SteamPersonal-10"
        Date    = "2026-08-05 18:55:51"
        Title   = "feat(admin): implement full-featured web admin panel and Steam API metadata sync"
        Body    = "- Create an isolated `"admin-panel`" React application with secure Supabase authentication (`"AuthGuard.tsx`").`n- Implement `"CatalogManager.tsx`" and `"VisualRecipeBuilder.tsx`" for publishing, editing, and deleting games and automated installation recipes.`n- Integrate Steam Store API parser (`"steamService.ts`") to automatically fetch game titles, developer info, genres, banners, requirements, and screenshots via Steam AppID.`n- Redesign the user interface (`"GameDetailView.tsx`" and `"WindowHeader.tsx`") to match Steam's immersive store style, including custom logo overlays, transparent branding, and streamlined navigation."
    },
    @{
        Version = "SteamPersonal-11"
        Date    = "2026-08-05 23:01:22"
        Title   = "feat(app): implement borderless window controls and admin panel upgrades"
        Body    = "- Introduce `"CustomMainForm`" in backend to remove native Windows borders while supporting custom resizing and dragging.`n- Integrate interactive Steam store search modal and advanced request sorting filters into the admin panel.`n- Implement sticky navigation headers and custom window control actions via the webview bridge in the frontend.`n- Update database schema to support expanded game metadata, including custom icons and publisher logos."
    },
    @{
        Version = "SteamPersonal-12"
        Date    = "2026-08-06 16:20:13"
        Title   = "feat(app): implement cloud save synchronization and rich dlc management"
        Body    = "- Introduce `"SavegameService`" to compress, back up, and restore local game saves with Oracle Cloud VPS support.`n- Redesign the admin panel catalog manager with a 4-tab layout, live media previews, and bulk DLC import tools.`n- Update frontend data models and UI components to support structured DLC items with custom images and descriptions."
    },
    @{
        Version = "SteamPersonal-13"
        Date    = "2026-08-07 11:07:37"
        Title   = "feat(achievements): add real-time tracking and Steam API settings"
        Body    = "- Implement `"AchievementService`" and Goldberg emulator file watcher to monitor unlocked achievements.`n- Integrate Steam Web API provider for achievement schemas and support personal API key configuration.`n- Add frontend achievements tab, progress tracking, and live unlock notification toasts."
    },
    @{
        Version = "SteamPersonal-14"
        Date    = "2026-08-07 17:44:59"
        Title   = "feat(app): add multi-version support, version requests, and SteamKit2"
        Body    = "- Integrate SteamKit2 dependency and enhance game launch and achievement tracking context.`n- Add database schema updates and frontend UI to support version history, build IDs, and custom version requests.`n- Implement a version request modal and settings toggle for displaying build identifiers."
    },
    @{
        Version = "SteamPersonal-15"
        Date    = "2026-08-08 14:10:04"
        Title   = "feat(sync): add background worker for automated steam game updates"
        Body    = "- Introduce `"SteamPersonal.SyncWorker`" to fetch PICS branch data and Steam store patch notes.`n- Implement 4-layer version cross-referencing and Supabase relational table synchronization.`n- Update database scripts and client configurations for relational game versions."
    }
)

# Configuraciones
$nombreScript = "Reconstruir-Historial.ps1"
$archivosProtegidos = @(".git", ".gitignore", "LICENSE", "README.md", $nombreScript)
$rutaBaseProyectos = "D:\Proyectos"

Write-Host "Iniciando proceso de reconstrucción AUTOMÁTICA del historial de Git..." -ForegroundColor Cyan
Write-Host "Directorio origen de versiones: $rutaBaseProyectos" -ForegroundColor DarkCyan
Write-Host "ADVERTENCIA: Este script eliminará archivos físicos y sobrescribirá datos automáticamente." -ForegroundColor Red
Read-Host "Presiona ENTER para iniciar el piloto automático (asegúrate de estar en la carpeta raíz del repositorio)"

foreach ($commit in $commits) {
    Write-Host "`n==================================================" -ForegroundColor Yellow
    Write-Host "Procesando: $($commit.Version)" -ForegroundColor Green
    Write-Host "Fecha a aplicar: $($commit.Date)"
    Write-Host "==================================================" -ForegroundColor Yellow
    
    $rutaOrigen = Join-Path -Path $rutaBaseProyectos -ChildPath $commit.Version

    if (-not (Test-Path -Path $rutaOrigen)) {
        Write-Host "ERROR: No se encontró la carpeta $rutaOrigen" -ForegroundColor Red
        Write-Host "Pausando el script. Verifica la ruta o copia manualmente los archivos." -ForegroundColor Yellow
        Read-Host "Presiona ENTER para continuar con el commit de todos modos..."
    } else {
        # 1. Limpiar el directorio actual (Repo local)
        Write-Host "1. Limpiando el repositorio (conservando protegidos)..." -ForegroundColor DarkCyan
        Get-ChildItem -Force | Where-Object { $_.Name -notin $archivosProtegidos } | Remove-Item -Recurse -Force
        
        # 2. Copiar archivos desde la versión correspondiente
        Write-Host "2. Copiando archivos desde $rutaOrigen..." -ForegroundColor Cyan
        # Usamos Get-ChildItem para asegurarnos de copiar archivos ocultos como .env también (excluyendo algún .git perdido en el origen)
        Get-ChildItem -Path $rutaOrigen -Force | Where-Object { $_.Name -ne ".git" } | Copy-Item -Destination . -Recurse -Force
    }

    # 3. Establece las fechas en las variables de entorno
    Write-Host "3. Preparando entorno de Git..." -ForegroundColor DarkCyan
    $env:GIT_AUTHOR_DATE = $commit.Date
    $env:GIT_COMMITTER_DATE = $commit.Date

    # 4. Agregar archivos a Git
    git add .

    # 5. Hacer el commit
    Write-Host "4. Ejecutando Commit..." -ForegroundColor Cyan
    git commit -m $commit.Title -m $commit.Body

    # 6. Hacer el push
    Write-Host "5. Subiendo al repositorio remoto (Push)..." -ForegroundColor Cyan
    git push

    Write-Host "¡$($commit.Version) completada exitosamente!" -ForegroundColor Green
}

# Limpieza final de variables
Remove-Item Env:\GIT_AUTHOR_DATE
Remove-Item Env:\GIT_COMMITTER_DATE

Write-Host "`n¡Historial reconstruido y automatizado con éxito!" -ForegroundColor Magenta