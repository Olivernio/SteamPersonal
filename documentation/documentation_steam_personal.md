# Proyecto: Launcher de Juegos Personal ("Steam Personal")

**Fecha de actualización:** Agosto 2026  
**Versión de la arquitectura:** v1.2 (Prototipo funcional & Frontend integrado)  
**Estado:** Fase 1 en progreso avanzado (Motor de descargas validado + UI Maquetada en React/Tailwind + WinForms/WebView2 configurado)

---

## Índice

1. [Resumen Ejecutivo y Propósito](#1-resumen-ejecutivo-y-propósito)
2. [Arquitectura General del Sistema](#2-arquitectura-general-del-sistema)
3. [Estado Actual de Desarrollo e Hitos Alcanzados (v1.2)](#3-estado-actual-de-desarrollo-e-hitos-alcanzados-v12)
4. [Stack Tecnológico Real Actualizado](#4-stack-tecnológico-real-actualizado)
5. [Decisiones de Arquitectura Relevantes](#5-decisiones-de-arquitectura-relevantes)
6. [Estructura de Datos (Manifest / Game Schema)](#6-estructura-de-datos-manifest--game-schema)
7. [Metodología de Automatización e Instalación](#7-metodología-de-automatización-e-instalación)
8. [Estrategia de Almacenamiento y Enlaces (Multi-Host Fallback)](#8-estrategia-de-almacenamiento-y-enlaces-multi-host-fallback)
9. [Gestión de Versiones y Sistema de Solicitudes (Requests)](#9-gestión-de-versiones-y-sistema-de-solicitudes-requests)
10. [Seguridad y Control de Accesos (RLS)](#10-seguridad-y-control-de-accesos-rls)
11. [Backlog Técnico y Puntos Pendientes](#11-backlog-técnico-y-puntos-pendientes)
12. [Estructura del Repositorio](#12-estructura-del-repositorio)
13. [Roadmap Global](#13-roadmap-global)

---

## 1. Resumen Ejecutivo y Propósito

El proyecto consiste en la creación de una plataforma distribuida para la gestión, distribución, instalación automatizada y ejecución de videojuegos en sistemas operativos Windows. El sistema automatiza las tareas manuales asociadas al despliegue de juegos (descompresión de partes, montaje de imágenes ISO, ejecuciones silenciosas, aplicación de parches/medicina e instalación de dependencias), emulando la experiencia de usuario de plataformas comerciales como Steam.

---

## 2. Arquitectura General del Sistema

El sistema utiliza una arquitectura desacoplada Cliente-Servidor para garantizar la actualización en tiempo real de metadatos y enlaces sin requerir re-compilaciones constantes de la aplicación cliente.

El sistema se compone de tres capas principales:

- **Panel de Administración (Web App):** Interfaz para gestión de catálogo, metadatos, versiones y enlaces de descarga.
- **Base de Datos Remota y APIs (Backend Central):** Almacenamiento centralizado (ej. Supabase) que gestiona permisos de acceso mediante Row Level Security (RLS) e integraciones con APIs externas (Steam, IGDB, SteamGridDB).
- **Cliente Launcher (Desktop App C#):** Aplicación ejecutable local enfocada exclusivamente en la experiencia del usuario (descarga, extracción, instalación local, actualización y ejecución).

---

## 3. Estado Actual de Desarrollo e Hitos Alcanzados (v1.2)

### ⚡ Motor de Descargas y Streaming Extraction (C# .NET 10)

- **Ahorro masivo de disco:** Se implementó y validó la técnica de _Streaming Extraction / On-the-fly Decompression_. El cliente no guarda el archivo comprimido (`.zip`/`.rar`) en el almacenamiento local, sino que canaliza la red a la RAM a través de un Buffer circular, escribiendo únicamente los archivos extraídos del juego en el disco final.
- **Resolución dinámica para Google Drive:** Se creó una rutina en C# que detecta automáticamente enlaces de Google Drive, extrae el `FILE_ID`, maneja cookies/redirecciones y salta el aviso de virus de archivos pesados.
- **Controles de flujo en tiempo real:** El `TrackedStream` desarrollado permite Pausar, Reanudar y Cancelar el flujo de datos, además de reportar el progreso (%) y los megabytes procesados.
- **Prueba de Fuego Exitosa:** Descarga directa de un juego real de Unreal Engine de ~1 GB desde Google Drive, completando la descompresión sin fallos y sin guardar comprimidos en disco.
- **Encapsulamiento del servicio:** Código migrado a una clase modular limpia (`GameDownloaderService.cs`) guiada por eventos (`ProgressChanged`, `DownloadCompleted`, `DownloadFailed`).

### 🎨 Interfaz de Usuario (UI - WebView2 + React + Tailwind CSS)

- **Estructura Web integrada:** La carpeta `wwwroot` contiene la maquetación UI avanzada exportada desde Figma, con React 18, Tailwind CSS v4, Lucide Icons y componentes Shadcn/UI.
- **Vistas creadas e interactivas:**
  - **`LibraryView`:** Malla de juegos instalados, filtros por estado (Ready to play, Updates Available), buscador e información de horas jugadas.
  - **`GameDetailView`:** Pantalla de detalle con carátulas, capturas, requisitos de sistema, parches y selector de versiones.
  - **`DownloadsView`:** Monitor de descarga en tiempo real con barras de progreso animadas, estado por pasos y métricas de velocidad.
  - **`ExploreView` / Store:** Catálogo de exploración con etiquetas Hot, Featured y filtros por género.
  - **`SettingsView`:** Panel de ajustes para rutas de instalación, límites de velocidad, comportamientos de bandeja y temas.
- **Hibridación C# / WinForms:** Configurado `SteamPersonal.csproj` en .NET 10 (windows) usando `Microsoft.Web.WebView2` para abrir la interfaz en una ventana nativa.

---

## 4. Stack Tecnológico Real Actualizado

### Aplicación Cliente (Desktop)

- **Runtime & Lenguaje:** C# (.NET 10 para Windows).
- **Contenedor UI:** WinForms con `Microsoft.Web.WebView2`.
- **Frontend Web:** React 18, Tailwind CSS v4, Vite, Lucide Icons, Shadcn/UI.
- **Gestión de Procesos:** `System.Diagnostics.Process` y `Microsoft.Win32.Registry`.
- **Almacenamiento Local:** SQLite / LiteDB.
- **Librerías Auxiliares:** `SharpCompress` (descompresión secuencial en streaming), `HttpClient`.

### Backend Central y Base de Datos

- **Plataforma BaaS:** Supabase (PostgreSQL + Auth + RLS).
- **Integraciones Externas:** Steam Store API, SteamCMD, IGDB / RAWG API, SteamGridDB API.

---

## 5. Decisiones de Arquitectura Relevantes

1. **Uso de `ReaderFactory` sobre `ArchiveFactory`:** Dado que las descargas HTTP son flujos no buscables (`CanSeek = false`), se optó por `ReaderFactory` de SharpCompress.
2. **Entorno de Desarrollo Ligero:** Se aprobó continuar sobre Antigravity IDE / VS Code utilizando la CLI de .NET 10 y Node.js/Vite.
3. **Capa de Comunicación (WebView2 Bridge):** Comunicación mediante mensajes JSON bidireccionales vía `window.chrome.webview.postMessage` (Frontend $\rightarrow$ C#) y `PostWebMessageAsJson` (C# $\rightarrow$ Frontend).

---

## 6. Estructura de Datos (Manifest / Game Schema)

```json
{
  "game_id": "cyberpunk_2077",
  "steam_appid": 1091500,
  "title": "Cyberpunk 2077",
  "latest_official_version": "2.13",
  "executable_relative_path": "bin/x64/Cyberpunk2077.exe",
  "available_versions": [
    {
      "version": "2.12",
      "is_available": true,
      "release_notes": "Soporte para DLSS 3.5 y parches de rendimiento.",
      "install_type": "iso",
      "downloads": [
        { "priority": 1, "provider": "MediaFire", "url": "https://..." },
        { "priority": 2, "provider": "DirectHTTP", "url": "https://..." }
      ]
    },
    {
      "version": "2.13",
      "is_available": false,
      "release_notes": "Versión oficial más reciente (Pendiente de subida)."
    }
  ],
  "installation_recipe": [
    {
      "action": "mount_iso",
      "target": "Cyberpunk2077.iso"
    },
    {
      "action": "run_silent_installer",
      "installer_path": "setup.exe",
      "args": "/VERYSILENT /SUPPRESSMSGBOXES /DIR=\"{INSTALL_DIR}\""
    },
    {
      "action": "unmount_iso"
    },
    {
      "action": "apply_crack",
      "source_folder": "MNT:\\Empress",
      "destination_folder": "{INSTALL_DIR}"
    },
    {
      "action": "add_defender_exclusion",
      "path": "{INSTALL_DIR}"
    },
    {
      "action": "clean_temp_files"
    }
  ]
}
```

---

### 7. Metodología de Automatización e Instalación

| Formato                   | Origen Estrategia de Automatización                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Partes RAR / ZIP / 7z     | Descarga en streaming mediante ReaderFactory → Extracción directa en disco → Sin temporales guardados.                                      |
| Imágenes ISO (`.iso`)     | Montaje nativo en Windows (`Mount-DiskImage`) → Ejecución silenciosa del `setup.exe` → Desmontaje y eliminación de la imagen.               |
| Ejecutables (`setup.exe`) | Inyección de argumentos de línea de comandos (`/VERYSILENT`, `/S`, `/DIR=...`) según el empaquetador (Inno Setup, NSIS).                    |
| Juegos Portables          | Descompresión directa en el directorio definitivo y creación de acceso directo.                                                             |
| Medicina / Cracks         | Copia con sobreescritura de la carpeta origen (`/Crack`, `/CODEX`) al directorio de instalación + Exclusión automática en Windows Defender. |

---

### 8. Estrategia de Almacenamiento y Enlaces (Multi-Host Fallback)

- **Servidores de Terceros:** Uso de MediaFire, Mega, Google Drive, 1fichier o Direct HTTP.

- **Estructura de Respaldo (Fallback):** Cada versión almacena un arreglo ordenado por prioridad.

- **Resolución de Links:** Resolvers en C# para extraer enlaces directos desde hosts con páginas intermedias (ej. Google Drive `FILE_ID` y bypass de advertencia de virus).

---

### 9. Gestión de Versiones y Sistema de Solicitudes (Requests)

- **Estado de Disponibilidad (`is_available`): **Permite mostrar cuándo la versión oficial es superior a la alojada en el servidor.
- **Estados en UI:** Actualizado, Update Disponible, Desactualizado (Solicitar Update).
- **Sistema de Priorización**: Incremento atómico (requests_count + 1) en la base de datos al presionar "Solicitar Update".

---

### 10. Seguridad y Control de Accesos (RLS)

- **Permisos del Cliente (App C#):** Clave pública con permisos `SELECT` en las tablas de juegos e inserción controlada (`INSERT`/`UPDATE`) para peticiones y métricas.

- **Permisos del Administrador (Web App):** Clave privada y token JWT con acceso completo (`ALL PRIVILEGES`).

---

### 11. Backlog Técnico y Puntos Pendientes

#### ⚠️ Correcciones en Frontend (Inmediato)

- **Template Literals en JSX: **Corregir las secuencias de escape en `ExploreView.tsx`, `GameDetailView.tsx`, `LibraryView.tsx` y `Sidebar.tsx` que bloquean Vite (`npm run dev`).
- **Sustitución de Mocks: **Reemplazar la constante `ACTIVE_DOWNLOAD` en `DownloadsView.tsx` por el estado dinámico recibido de C# vía `window.chrome.webview`.

#### 🛠️ Refuerzo del Motor de Descargas

- **Soporte para .7z y Compresión Sólida:** Implementar mecanismo de caché o compatibilidad con DiscUtils / extractor secundario para formatos no secuenciales.
- **Archivos divididos (`.part1.rar`, `.part2.rar`):** Crear un `Stream` encadenado secuencial que una automáticamente las conexiones HTTP entre partes.
- **Resiliencia de enlaces:** Añadir Retry Policy con cabeceras `Range` para reanudar el flujo ante cortes de red.

#### 🛡️ Módulos Próximos

- **Monitoreo de Horas Jugadas: **Detección de lanzamiento del `.exe` e inspección del árbol de procesos (`Process Tree`).
- **Motor de Recetas (`installation_recipe`):** Desarrollar el intérprete JSON para montaje ISO, instaladores silenciosos y parches.
- **Integración Supabase: **Conectar `games.ts` a la base de datos remota.

---

### 12. Estructura del Repositorio

```Plaintext
SteamPersonal/
├── bin/                        <-- Compilados de C# (.NET 10)
├── Services/
│   └── GameDownloaderService.cs <-- Motor de descarga y extracción en RAM
├── wwwroot/                    <-- Frontend (React + Tailwind + Vite)
│   ├── index.html
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx         <-- Listener WebView2 y estado global
│   │   │   └── components/     <-- Vistas (Library, Downloads, Store, Settings)
│   └── package.json
├── Program.cs                  <-- Ventana WinForms + Inicializador WebView2
└── SteamPersonal.csproj        <-- Configurado con SharpCompress y WebView2
```

---

### 13. Roadmap Global

**Fase 1 (En curso avanzado):** Motor Local, Streaming Extraction, UI React/Tailwind + WinForms WebView2.
**Fase 2: **Conexión Remota con Supabase, APIs (Steam/IGDB/SteamGridDB).
**Fase 3: **Panel de Administración Web.
**Fase 4: **Intérprete del `installation_recipe`, Exclusiones en Defender y limpieza de temporales.
