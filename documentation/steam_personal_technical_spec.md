# 🚀 Documento de Contexto y Especificación Técnica: Project "Steam Personal"

> **Instrucciones para la IA receptor (AntiGravity IDE):**
> Actúa como un Arquitecto de Software Senior y Desarrollador C#/.NET experto. Lee la siguiente documentación de arquitectura, los mecanismos técnicos validados y los avances actuales para guiar el desarrollo paso a paso.

---

## 1. Resumen Ejecutivo y Visión del Proyecto

El proyecto **"Steam Personal"** es un lanzador de videojuegos de escritorio para Windows diseñado en **C# (.NET 10)**. Su objetivo es automatizar completamente el ciclo de vida de los juegos (descarga, extracción, aplicación de parches/medicina, configuración de dependencias y ejecución) ofreciendo una experiencia similar a Steam o Epic Games, sin requerir el doble o triple de almacenamiento en disco.

---

## 2. Arquitectura General y Stack Tecnológico

El sistema se basa en una arquitectura desacoplada de **tres capas**:

```
 ┌───────────────────────────┐      ┌───────────────────────────┐
 │   Panel Web de Admin      │      │  Launcher Cliente (Desktop)│
 │   (React/Vue + Tailwind)  │      │  (C# .NET 10 + WebView2)  │
 └─────────────┬─────────────┘      └─────────────┬─────────────┘
               │ (Escritura / Auth)               │ (Solo Lectura)
               ▼                                  ▼
 ┌──────────────────────────────────────────────────────────────┐
 │             Backend Central & Base de Datos                  │
 │          Supabase (PostgreSQL + RLS) + External APIs         │
 └──────────────────────────────────────────────────────────────┘
```

* **Cliente Desktop:** C# (.NET 10) + **WebView2** (Frontend en HTML/Tailwind/JS) + **SQLite/LiteDB** local para metadatos del usuario + **SharpCompress** (v0.50.3+).
* **Base de Datos Remota:** Supabase (PostgreSQL) protegido por **Row Level Security (RLS)**:
  * *Cliente:* Permisos de **Solo Lectura (`SELECT`)** para evitar hackeos o alterations a la base de datos.
  * *Admin Panel:* Permisos de **Escritura (`INSERT/UPDATE`)** mediante sesión autenticada.
* **Panel de Administración:** Aplicación Web separada de la app de usuario (por seguridad) para gestionar el catálogo, resolver metadatos mediante APIs (**Steam Store API, IGDB, SteamGridDB**) y publicar enlaces.

---

## 3. Descarga y Extracción en Vivo (*Streaming Extraction*)

### El Concepto Clave
Para evitar descargar el comprimido (`.rar`/`.zip` de 50 GB) y luego extraerlo (requiriendo 100 GB+ en total), el cliente utiliza **Streaming Extraction**:
1. La red (`HttpClient`) transmite los paquetes directamente a un **buffer circular pequeño en la memoria RAM** (30 MB - 80 MB).
2. **SharpCompress (`ReaderFactory`)** lee el flujo secuencial de la RAM y descompone los archivos directamente en la carpeta de destino final (`C:\Juegos\NombreJuego`).
3. El archivo `.zip`/`.rar` **nunca existe físicamente en el disco duro**.

### Protocolo de Pausa, Reanudación y Anti-Corrupción

#### A. Pausa en Misma Sesión (Memoria)
Mantiene la conexión HTTP suspendiendo el bucle de lectura. Es instantáneo y no pierde la posición en RAM.

#### B. Reanudación Persistente entre Reinicios (Estrategia A: *SkipEntry*)
Si la app o PC se apaga a la mitad de la descarga:
1. Al reiniciar, el cliente reabre el Stream HTTP desde el inicio.
2. Un registro local de control (`manifest.json`) rastrea los archivos extraídos exitosamente.
3. Con `reader.SkipEntry()`, SharpCompress **omite en la RAM a ultra-alta velocidad** los bytes de los archivos que ya están completos en disco, reanudando la escritura real únicamente en el primer archivo pendiente.

#### C. Tolerancia a Fallos y Cortes Eléctricos (Integridad)
* **Regla `.tmp`:** Todo archivo se escribe como `nombre.ext.tmp`. Solo al completar su último byte y validar el archivo, se renombra a `nombre.ext` y se registra en `completed_files`.
* **Archivos Incompletos:** Al reabrir la app tras un apagón, cualquier archivo `.tmp` parcial es eliminado automáticamente.
* **Checkpoints:** Verificación de tamaño de archivo y CRC32 rápido antes de aplicar `SkipEntry()`.

---

## 4. Estado Actual del Proyecto y Prueba de Concepto (PoC) Validada

Ya hemos compilado y validado con éxito el motor central en **.NET 10**:

* **Entorno:** .NET 10.0 SDK con la librería `SharpCompress` (v0.50.3).
* **Google Drive Resolver:** Implementado endpoint directo `https://drive.usercontent.google.com/download?id={ID}&export=download&confirm=t` con soporte para desvío de páginas intermedias y cookies HTTP.
* **Procesador:** Implementación con `ReaderFactory.OpenReader()` en `Program.cs` capaz de extraer secuencialmente flujos no buscables (`CanSeek = false`).
* **Resultado de Prueba:** Se descargó y extrajo exitosamente en tiempo real un juego real de Unreal Engine (~1 GB) desde Google Drive directamente a disco sin crear archivos temporales comprimidos.

---

## 5. Esquema de Datos Básicos (`installation_recipe`)

El cliente interpreta dinámicamente un JSON de receta para automatizar instalaciones complejas:

```json
{
  "game_id": "librarian",
  "steam_appid": 1091500,
  "title": "Librarian: Tidy Up the Arcane Library",
  "latest_official_version": "1.0.0",
  "executable_relative_path": "Librarian/Binaries/Win64/Librarian-Win64-Shipping.exe",
  "installation_recipe": [
    { "action": "stream_extract", "provider": "GoogleDrive" },
    { "action": "apply_crack", "source_folder": "{INSTALL_DIR}/Engine/Binaries/ThirdParty/Steamworks/Steamv157/Win64/steam_settings" },
    { "action": "add_defender_exclusion", "path": "{INSTALL_DIR}" }
  ]
}
```

---

## 6. Próximos Pasos de Ejecución para AntiGravity IDE

Debemos pasar de la aplicación de consola PoC a la arquitectura modular de producción. Las tareas prioritarias son:

1. **Refactorización del Motor de Descargas (`GameDownloaderService.cs`):**
   * Encapsular la lógica de `Program.cs` en un servicio con eventos de progreso en C# (`OnProgressChanged`, `OnStatusChanged`, `OnCompleted`).
   * Implementar el archivo local de persistencia `.json` de progreso (`completed_files` + `.tmp`).

2. **Integración de UI con WebView2:**
   * Configurar WebView2 en la app C# para cargar el frontend web (HTML/CSS/JS con Tailwind CSS).
   * Crear el puente interop (`C# Bridge / HostObject`) para comunicar eventos entre la interfaz de usuario y el `GameDownloaderService`.

3. **Motor de Ejecución y Contador de Horas:**
   * Crear el servicio de monitoreo de procesos con `System.Diagnostics.Process` para rastrear el tiempo jugado cuando se lanza el ejecutable principal.