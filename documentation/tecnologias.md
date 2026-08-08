# Tecnologías utilizadas en SteamPersonal

Inventario de lenguajes, frameworks, servicios y herramientas presentes en el repositorio hasta la fecha. Organizado por capa del sistema.

---

## Resumen de arquitectura

| Componente | Ubicación | Rol |
|------------|-----------|-----|
| Cliente de escritorio | Raíz (`SteamPersonal.csproj`) | Shell WinForms + WebView2; lógica nativa (descargas, instalación, logros, partidas) |
| UI del cliente | `wwwroot/` | SPA React servida en WebView2 (dev: Vite `:5173`) |
| Panel de administración | `admin-panel/` | SPA React independiente para gestión del catálogo |
| Worker de sincronización | `SteamPersonal.SyncWorker/` | Servicio .NET en VPS; Steam → Supabase |
| Backend de datos | Supabase | PostgreSQL + Auth + PostgREST + RLS |
| Savegames en la nube | `documentation/oracle_savegame_server.js` | Microservidor Node.js en Oracle Cloud |

---

## Backend / cliente nativo (.NET)

### Plataforma y lenguaje

- **C#** con `Nullable` e `ImplicitUsings` habilitados
- **.NET 10**
  - Cliente: `net10.0-windows` (aplicación Windows)
  - Worker: `net10.0` (consola / servicio en Linux)

### UI y host de escritorio (cliente)

- **Windows Forms** (`OutputType`: WinExe, `UseWindowsForms`)
- **Microsoft Edge WebView2** (`Microsoft.Web.WebView2`) — contenedor de la UI web y puente C# ↔ JavaScript (`PostWebMessageAsJson` / `WebMessageReceived`)
- **Win32** — ventana sin borde estándar, redimensionado y arrastre vía `WndProc` / `WM_NCHITTEST`

### Bibliotecas NuGet (cliente — `SteamPersonal.csproj`)

| Paquete | Versión | Uso |
|---------|---------|-----|
| SharpCompress | 0.50.3 | Extracción en streaming de archivos comprimidos durante la descarga |
| Microsoft.Web.WebView2 | 1.0.4129.50 | WebView2 |
| SteamKit2 | 3.4.0 | Referenciado en el proyecto cliente; uso activo en el Sync Worker (PICS) |

### APIs de .NET usadas en el cliente

- `System.Net.Http` — descargas, APIs REST, savegames, Steam Web API
- `System.Text.Json` — serialización (puente WebView, logros Goldberg, configuración)
- `System.IO.Compression` — ZIP de partidas guardadas (`SavegameService`)
- `System.Diagnostics` — lanzamiento y monitoreo de procesos de juegos

### Servicios de dominio (C# — carpeta `Services/`)

- **GameDownloaderService** — descarga con reintentos, pausa/reanudación, extracción streaming
- **GameRecipeService** — pipeline de instalación por pasos (JSON desde Supabase)
- **GameLauncherService** — ejecución y seguimiento del proceso del juego
- **SavegameService** — backup/restore local + sincronización con el servidor Oracle
- **SettingsManager** — configuración local (p. ej. clave Steam API, opciones de UI)
- **Achievements** — `AchievementService`, `GoldbergAchievementWatcher`, `SteamWebAchievementProvider`

### Worker de sincronización (`SteamPersonal.SyncWorker/`)

| Paquete / tecnología | Versión | Uso |
|----------------------|---------|-----|
| Microsoft.Extensions.Hosting | 10.0.0 | Host mínimo + DI |
| Microsoft.Extensions.Http | 10.0.0 | `HttpClient` tipado |
| Microsoft.Extensions.Logging.Console | 10.0.0 | Logs en consola |
| DotNetEnv | 3.2.0 | Variables desde `.env` en el VPS |
| Supabase.Postgrest | 4.0.3 | Acceso HTTP a PostgREST (sin SDK completo de Supabase) |
| SteamKit2 | 3.4.0 | Consultas **PICS** (Build ID, timestamps) |
| GC workstation | — | Optimizado para VPS ~1 GB RAM (`ServerGarbageCollection=false`) |

---

## Frontend — UI del cliente (`wwwroot/`)

### Core

- **React** 18.3.x (peer dependency del export Figma Make)
- **JSX/TSX** — componentes en TypeScript sin proyecto `tsconfig` dedicado en raíz de `wwwroot` (build vía Vite)
- **Vite** 6.x — bundler y dev server
- **@vitejs/plugin-react** 4.7.0

### Estilos y componentes

- **Tailwind CSS** 4.1.12 + **@tailwindcss/vite**
- **Radix UI** — primitives (accordion, dialog, dropdown, tabs, tooltip, etc.)
- **Material UI (MUI)** 7.3.5 + **@emotion/react** / **@emotion/styled** + **@mui/icons-material**
- Patrón tipo **shadcn/ui**: `class-variance-authority`, `clsx`, `tailwind-merge`, componentes en `src/app/components/ui/`
- **lucide-react** — iconografía
- **motion** — animaciones
- **next-themes** — temas claro/oscuro
- **sonner** — notificaciones toast
- **tw-animate-css** — utilidades de animación CSS

### Datos, routing y formularios

- **@supabase/supabase-js** ^2.112.1 — catálogo y metadatos (clave `anon`)
- **react-router** ^7.11.0 — navegación en la SPA
- **react-hook-form** — formularios
- **date-fns** — fechas
- **recharts** — gráficos
- **canvas-confetti** — efectos de celebración (p. ej. logros)

### Otros (UI)

- **cmdk**, **vaul**, **embla-carousel-react**, **react-dnd**, **react-slick**, **react-resizable-panels**, **react-day-picker**, **input-otp**, **react-popper** / **@popperjs/core**
- Origen de diseño: export **Figma Make** (`package.json`: `@figma/my-make-file`)
- **webview-bridge.ts** — contrato JS con el host WinForms

---

## Frontend — panel de administración (`admin-panel/`)

| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | ^19.2.8 | UI del panel |
| React DOM | ^19.2.8 | Render |
| TypeScript | ~6.0.2 | Tipado estricto (`tsc -b`) |
| Vite | ^8.2.0 | Dev/build (Rolldown en la cadena Vite 8) |
| @vitejs/plugin-react | ^6.0.4 | Fast Refresh / React |
| oxlint | ^1.75.0 | Linter |
| @supabase/supabase-js | ^2.112.1 | Auth de administradores + CRUD |
| lucide-react | ^1.28.0 | Iconos |

Componentes principales: `AuthGuard`, `CatalogManager`, `VisualRecipeBuilder`; servicios `supabaseAdmin.ts`, `steamService.ts`.

---

## Base de datos y backend como servicio

### Supabase

- **PostgreSQL** (gestionado por Supabase)
- **PostgREST** — API REST sobre tablas
- **Supabase Auth** — administradores en el panel (`authenticated`); cliente con rol **`anon`**
- **Row Level Security (RLS)** — lectura pública acotada, escritura restringida
- **JSONB** — recetas de instalación (`installation_recipes.steps`), metadatos (`dlcs`, `requirements`, `screenshots`, etc.)

### Esquema (definido en `documentation/scripts_de_sql.sql`)

| Tabla | Propósito |
|-------|-----------|
| `games` | Catálogo de juegos, metadatos, URLs, contadores |
| `installation_recipes` | Pasos de instalación por juego (JSONB) |
| `version_requests` | Solicitudes de versión de usuarios |
| `game_versions` | Versiones/builds/changelog (modelo relacional; reemplaza arrays JSONB en `games`) |

Extensiones / funciones PostgreSQL usadas en scripts: `gen_random_uuid()`, políticas RLS, restricción `UNIQUE (game_id, version_name)` para upserts del worker.

---

## APIs y servicios externos

### Steam

| API / protocolo | Dónde se usa |
|-----------------|--------------|
| **SteamKit2 PICS** | Sync Worker — `build_id`, `timeupdated` |
| **Steam Store Web API** (`store.steampowered.com/api/appdetails`) | Panel admin (`steamService.ts`), metadatos en español |
| **Steam Store Events** | Sync Worker — patch notes y eventos |
| **Steam Web API** (`ISteamUserStats/GetSchemaForGame/v2/`) | Cliente — definición de logros |
| **Logon anónimo Steam** | PICS vía SteamKit2 |

### Almacenamiento y descargas

- **Google Drive** — URLs de descarga; extracción en streaming desde enlaces `drive.google.com` (`GameDownloaderService`)

### Emulación / integración local

- **Goldberg Steam Emulator** — lectura de `achievements.json` con `FileSystemWatcher` para desbloqueos en tiempo real

### Seguridad del sistema (Windows)

- **Microsoft Defender** — exclusiones de carpeta vía paso `add_defender_exclusion` en recetas (`GameRecipeService`)

### Infraestructura en la nube

- **Oracle Cloud Infrastructure (OCI)** — VPS Always Free (worker + savegame server)
- **systemd** (documentado en blueprint) — timer/servicio para el Sync Worker en Linux
- **PM2** (opcional, documentado) — proceso persistente del servidor de savegames

### Utilidades web (desarrollo)

- **corsproxy.io** — proxy CORS para llamadas a la Steam Store API desde el panel en local

---

## Microservidor de partidas (`documentation/oracle_savegame_server.js`)

- **Node.js**
- **Express** — HTTP API
- **multer** — subida multipart de ZIPs
- **cors** — CORS abierto
- **dotenv** — configuración por entorno (`PORT`, `STORAGE_DIR`, `SECRET_KEY`)
- Autenticación simple por cabecera `x-auth-token`

---

## Herramientas de desarrollo y build

| Herramienta | Proyecto |
|-------------|----------|
| Vite dev server (`npm run dev`, típ. puerto 5173) | `wwwroot`, `admin-panel` |
| `vite build` | Producción UI cliente + copia a salida WinForms (`wwwroot/**` → output directory) |
| oxlint | `admin-panel` |
| NuGet / `dotnet build` | Cliente y Sync Worker |

---

## Código de apoyo (referencia, no producto principal)

- **PlayniteAchievements** (`CodigoDeApoyo/PlayniteAchievements-main/`) — proyecto C# / WPF de referencia para ideas de logros; no forma parte del ejecutable SteamPersonal.

---

## Formatos y protocolos

- **JSON** — puente WebView, recetas, manifest de descarga, APIs Steam/Supabase
- **JSONB** — PostgreSQL (Supabase)
- **ZIP** — empaquetado de savegames
- **Archivos comprimidos varios** — SharpCompress en pipeline de instalación
- **HTTP/HTTPS** — todas las integraciones remotas

---

## Versiones clave (referencia rápida)

```
Cliente:     .NET 10 (windows), WinForms, WebView2 1.0.4129.50, SharpCompress 0.50.3
Worker:      .NET 10, SteamKit2 3.4.0, Supabase.Postgrest 4.0.3, DotNetEnv 3.2.0
wwwroot:     Vite 6, Tailwind 4, MUI 7, Supabase JS 2.112, React Router 7
admin-panel: Vite 8, React 19, TypeScript 6, oxlint, Supabase JS 2.112
Savegames:   Node.js + Express + multer
Datos:       Supabase (PostgreSQL + Auth + RLS)
Despliegue:  Oracle Cloud VPS; systemd / PM2 según componente
```

---

*Documento generado a partir del estado del repositorio `SteamPersonal`. Actualizar cuando se añadan dependencias o servicios nuevos.*
