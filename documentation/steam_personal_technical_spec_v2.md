# 🚀 Especificación Técnica y Documento de Arquitectura: "Steam Personal" (v2.0)

> **Documento Maestro de Arquitectura y Estado de Proyecto**
> **Fecha:** Agosto 2026 | **Plataforma:** Windows (.NET 10 x64)

---

## 1. Resumen Ejecutivo y Visión

**"Steam Personal"** es un lanzador de videojuegos de escritorio para Windows construido en **C# (.NET 10)** y **WebView2 (React / TypeScript / TailwindCSS)**. Su propósito es automatizar completamente la experiencia del usuario (descarga, extracción en vivo, aplicación de parches/medicina, exclusión de antivirus, creación de accesos directos y contador de horas jugadas) ofreciendo una interfaz gráfica idéntica a Steam, sin requerir el doble ni el triple de almacenamiento en disco.

```
 ┌───────────────────────────┐      ┌───────────────────────────┐
 │   Panel Web de Admin      │      │  Launcher Cliente (Desktop)│
 │   (React + Vite + Auth)   │      │  (C# .NET 10 + WebView2)  │
 └─────────────┬─────────────┘      └─────────────┬─────────────┘
               │ (Escritura / Auth)               │ (Solo Lectura - RLS)
               ▼                                  ▼
 ┌──────────────────────────────────────────────────────────────┐
 │             Backend Central & Base de Datos                  │
 │          Supabase (PostgreSQL + RLS) + Steam API             │
 └──────────────────────────────────────────────────────────────┘
```

---

## 2. Decisiones Arquitectónicas Fundamentales y Conclusiones

### 2.1. ¿Por qué "Streaming Extraction" en lugar de "Descargar y Extraer"?

#### El Problema del Enfoque Tradicional (2 Fases)
En el enfoque tradicional en 2 fases, el sistema descarga primero un archivo comprimido de 50 GB (`.rar`/`.zip` o `.part`) a disco y luego ejecuta la extracción:

$$\text{Espacio Pico Necesario} = \text{Espacio}(.rar) + \text{Espacio}(\text{Juego Descomprimido}) \approx 50\text{ GB} + 60\text{ GB} = 110\text{ GB}$$

Esto causaba que usuarios con almacenamiento SSD ajustado no pudieran instalar juegos pesados aun teniendo espacio suficiente para el juego final.

#### La Solución Adoptada: Streaming Extraction (Extracción en Vivo)
En **Steam Personal**, el archivo comprimido **nunca toca ni existe en el disco duro**:

```
Network Stream (HTTP) ──► RAM Circular Buffer (64 KB) ──► SharpCompress ──► Archivos Finales (.tmp ➔ .ext)
```

1. `HttpClient` recibe los bytes de red y los entrega a un flujo en memoria (`TrackedStream`).
2. `SharpCompress.ReaderFactory.OpenReader()` lee secuencialmente la memoria RAM.
3. Los archivos descomprimidos se escriben **directamente en su ubicación final** (`C:\Juegos\NombreJuego\...`).

$$\text{Espacio Pico Necesario} = \text{Espacio}(\text{Juego Descomprimido}) + 1\text{ archivo } .tmp \text{ parcial}$$

---

### 2.2. Protocolo Anti-Corrupción y Checkpoints (`.tmp` + `.manifest.json`)

Para solucionar el inconveniente histórico del streaming (perder el avance ante un apagón o corte de luz), se diseñó un protocolo de **Checkpoints Atómicos**:

1. **Regla de Extensión `.tmp`:** Cada archivo extraído se escribe como `nombre.ext.tmp`.
2. **Commit Atómico:** Únicamente al verificar el último byte del archivo, este se renombra atómicamente a `nombre.ext`.
3. **Registro Local `.manifest.json`:** Se guarda un manifiesto en el directorio del juego con la lista de archivos extraídos exitosamente.
4. **Limpieza al Iniciar:** Si ocurrió un corte eléctrico a mitad de escritura, al reabrir la app se escanean y eliminan automáticamente los `.tmp` huérfanos.
5. **Reanudación por Omisión (`continue`):** Al reabrir, el stream HTTP se inicia desde el primer byte, pero `SharpCompress` omite a alta velocidad en RAM los archivos ya registrados en `.manifest.json`, reanudando la escritura física únicamente en el archivo donde ocurrió la interrupción.

---

### 2.3. Aislamiento de Hilos en C# (`Task.Run`)

Para evitar que la descompresión sincrónica y la escritura intensiva de disco congelen la interfaz gráfica de usuario en Windows (marcando la ventana como *"No responde"*):
* El motor `ExecuteStreamExtractAsync` se ejecuta obligatoriamente envuelto en `Task.Run()` en un hilo de fondo (*ThreadPool thread*).
* La pausa en memoria se gestiona con `ManualResetEventSlim` en la lectura de `TrackedStream`, permitiendo congelar el flujo de datos sin matar la conexión TCP ni bloquear el loop de mensajes de la UI.

---

## 3. Modelo de Seguridad y Separación de Capas

| Capa | Proyecto | Permisos Supabase | Descripción |
| :--- | :--- | :--- | :--- |
| **Cliente Desktop** | `SteamPersonal` (C# .NET 10 + WebView2) | **Solo Lectura (`SELECT`)** | App de usuario final. No contiene credenciales de admin ni código de escritura. Interpreta recetas. |
| **Panel de Administración** | `admin-panel/` (React + Vite) | **Escritura Controlada (`INSERT`, `UPDATE`, `DELETE`)** | App Web aislada para administradores autenticados mediante Supabase Auth. |
| **Base de Datos** | Supabase PostgreSQL | **Row Level Security (RLS)** | Políticas estrictas donde `anon` sólo consulta datos activos (`is_active = true`). |

---

## 4. Estado Actual: Módulos e Funcionalidades Implementadas (Fase Completada)

### 4.1. Motor de Descargas y Extracción en Vivo (`GameDownloaderService.cs`)
* Extracción en vivo sin archivo comprimido intermedio.
* Medición de velocidad en MB/s con filtro de suavizado Exponential Smoothing.
* Eventos en C# (`ProgressChanged`, `DownloadCompleted`, `DownloadFailed`).

### 4.2. Manifiesto y Checkpoints (`DownloadManifest.cs` / `ManifestHelper.cs`)
* Guardado atómico de `.manifest.json`.
* Limpieza automática de `.tmp` parciales al arrancar.

### 4.3. Intérprete de Recetas (`GameRecipeService.cs`)
Ejecuta secuencias de instalación automatizadas definidas en JSON:
- `stream_extract`: Descarga y extracción en RAM.
- `apply_crack` / `apply_patch`: Copia recursiva de archivos de medicinas o fix.
- `add_defender_exclusion`: Ejecución silenciosa de PowerShell (`Add-MpPreference -ExclusionPath`) para evitar falsos positivos antivirus.
- `create_shortcut`: Creación automática del acceso directo `.lnk` en el Escritorio mediante `WScript.Shell`.

### 4.4. Lanzador de Juegos y Tiempo Jugado (`GameLauncherService.cs`)
- Búsqueda dinámica del ejecutable principal si no está definido.
- Monitoreo del proceso en segundo plano con `Process.OnExited`.
- Conteo y acumulación de tiempo jugado en horas.

### 4.5. Panel Web de Administración (`admin-panel/`)
- **Autenticación:** Login seguro para administradores (`AuthGuard.tsx`).
- **CRUD del Catálogo:** Publicación, edición y eliminación de juegos (`CatalogManager.tsx`).
- **Editor Visual de Recetas (`VisualRecipeBuilder.tsx`):** Constructor por bloques drag-and-drop/interactivo para definir recetas sin escribir código JSON.
- **Importación Automática con Steam Store API (`steamService.ts`):** Escribiendo el `Steam AppID` y presionando `⚡ Steam`, autocompleta título, desarrollador, género, portada, banner y descripción desde la API pública de Steam en español.

### 4.6. Rediseño Estético Fiel a Steam
- **Soporte para Personalización Visual:**
  - `cover_image_url`: Portada vertical (ratio 2:3) para las tarjetas de la biblioteca.
  - `header_banner_url`: Fondo panorámico Hero HD (420px de alto).
  - `logo_image_url`: Logo gráfico en formato PNG transparente con filtro de sombra profunda (`drop-shadow`), sustituyendo al texto plano.
- **Efecto Viñeta:** Sombras radiales y degradados multicapa estilo Steam.
- **Barra de Acción Flotante de Steam:**
  - Botón principal desplegable verde `▶ JUGAR ▾` o azul `ACTUALIZAR ▾`.
  - Métrica `☁️ ESTADO DE CLOUD` (`Actualizado`).
  - Métrica `📅 ÚLTIMA SESIÓN` (`Reciente` / `Nunca`).
  - Métrica `⏱️ TIEMPO DE JUEGO` (`35.4 horas`).
  - Métrica `🏆 LOGROS` (`20/101` con mini barra de progreso azul).
  - Acciones rápidas flotantes (Ajustes ⚙️, Mando 🎮, Información ℹ️, Favorito ❤️).

---

## 5. Roadmap de Próximas Fases

```
  [FASE 1: MOTOR & STREAMING] ──────► [FASE 2: ADMIN PANEL & STEAM API] ──────► [FASE 3: FUTURO Y RESILIENCIA]
           (COMPLETADO ✅)                           (COMPLETADO ✅)                         (PENDIENTE ⏳)
```

### 5.1. Conmutación por Error y Servidores Espejo (Multi-Mirror Fallback)
* **Objetivo:** Si un enlace de Google Drive falla por límite de cuota o cae, el motor C# cambiará automáticamente al enlace de respaldo (MediaFire / Direct HTTP).

### 5.2. Sistema de Notificación de Solicitudes de Actualización
* **Objetivo:** Al presionar "Solicitar Update" en el cliente, registrar la petición en Supabase y mostrar alertas en rojo/naranja en el Admin Panel para priorizar actualizaciones del catálogo.

### 5.3. Sincronización de Partidas Guardadas en la Nube (Cloud Saves)
* **Objetivo:** Copia de seguridad automática de la carpeta de guardado del juego hacia Supabase Storage al cerrar el juego.

### 5.4. Automatización Masiva de Importación de Juegos
* **Objetivo:** Scraping/Importación por lotes para popular el catálogo automáticamente.
