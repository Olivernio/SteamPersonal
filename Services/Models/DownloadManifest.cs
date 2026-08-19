using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace SteamPersonal.Services.Models
{
    /// <summary>
    /// Tracks which files have been successfully extracted from a streaming download.
    /// Persisted as .manifest.json in the game's destination directory.
    /// Used by SkipEntry() to resume extraction after interruptions.
    /// </summary>
    public class DownloadManifest
    {
        public string GameTitle { get; set; } = string.Empty;
        public string SourceUrl { get; set; } = string.Empty;
        public string DestinationDir { get; set; } = string.Empty;
        public List<CompletedFileEntry> CompletedFiles { get; set; } = new();
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

        // ── Progreso persistido para reanudación tras reinicio ──
        /// <summary>Tamaño total del archivo comprimido en bytes (0 si desconocido).</summary>
        public long TotalBytesExpected { get; set; }
        /// <summary>Bytes del stream HTTP procesados hasta la última actualización.</summary>
        public long BytesDownloaded { get; set; }
        /// <summary>Estado: "downloading" | "paused" | "completed"</summary>
        public string Status { get; set; } = "downloading";
        /// <summary>Versión del juego que se está descargando (e.g. "v1.0.8").</summary>
        public string Version { get; set; } = string.Empty;
        /// <summary>Token de Gofile (si aplica) para poder reanudar sin pedírselo al usuario.</summary>
        public string? GofileToken { get; set; }
    }

    public class CompletedFileEntry
    {
        /// <summary>Relative path inside the archive (e.g. "Game/Data/level01.pak")</summary>
        public string RelativePath { get; set; } = string.Empty;

        /// <summary>Size in bytes of the completed file on disk</summary>
        public long SizeBytes { get; set; }
    }

    /// <summary>
    /// Helper to load/save the manifest.json file atomically.
    /// </summary>
    public static class ManifestHelper
    {
        private static readonly JsonSerializerOptions _jsonOptions = new()
        {
            WriteIndented = true
        };

        /// <summary>
        /// Returns the path to the manifest file for a given destination directory.
        /// </summary>
        public static string GetManifestPath(string destinationDir)
            => Path.Combine(destinationDir, ".manifest.json");

        /// <summary>
        /// Loads an existing manifest, or returns null if none exists.
        /// </summary>
        public static DownloadManifest? Load(string destinationDir)
        {
            string path = GetManifestPath(destinationDir);
            if (!File.Exists(path)) return null;

            try
            {
                string json = File.ReadAllText(path);
                return JsonSerializer.Deserialize<DownloadManifest>(json, _jsonOptions);
            }
            catch
            {
                return null; // Corrupted manifest — treat as fresh start
            }
        }

        /// <summary>
        /// Saves the manifest atomically (write to .tmp then rename).
        /// </summary>
        public static void Save(DownloadManifest manifest)
        {
            string path = GetManifestPath(manifest.DestinationDir);
            string tmpPath = path + ".tmp";

            manifest.LastUpdated = DateTime.UtcNow;
            string json = JsonSerializer.Serialize(manifest, _jsonOptions);

            File.WriteAllText(tmpPath, json);

            // Atomic rename: delete old, rename tmp → final
            if (File.Exists(path)) File.Delete(path);
            File.Move(tmpPath, path);
        }

        /// <summary>
        /// Deletes the manifest file if it exists.
        /// </summary>
        public static void Delete(string destinationDir)
        {
            string path = GetManifestPath(destinationDir);
            try { if (File.Exists(path)) File.Delete(path); } catch { }
        }

        /// <summary>
        /// Cleans up orphaned .tmp files from a previous interrupted extraction.
        /// </summary>
        public static void CleanOrphanedTmpFiles(string destinationDir)
        {
            if (!Directory.Exists(destinationDir)) return;

            foreach (var tmpFile in Directory.EnumerateFiles(destinationDir, "*.tmp", SearchOption.AllDirectories))
            {
                try { File.Delete(tmpFile); } catch { }
            }
        }

        /// <summary>
        /// Builds a HashSet of completed file paths for O(1) lookup during SkipEntry().
        /// </summary>
        public static HashSet<string> BuildCompletedSet(DownloadManifest? manifest)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (manifest?.CompletedFiles == null) return set;

            foreach (var entry in manifest.CompletedFiles)
            {
                set.Add(NormalizePath(entry.RelativePath));
            }
            return set;
        }

        /// <summary>
        /// Normalizes archive entry paths (forward slashes, no leading slash).
        /// </summary>
        public static string NormalizePath(string path)
            => path.Replace('\\', '/').TrimStart('/');
    }
}
