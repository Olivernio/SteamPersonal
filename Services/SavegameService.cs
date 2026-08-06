using System;
using System.IO;
using System.IO.Compression;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;

namespace SteamPersonal.Services
{
    public class SavegameBackupResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public long SizeBytes { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.Now;
        public string LocalZipPath { get; set; } = string.Empty;
        public bool UploadedToCloud { get; set; }
    }

    public class SavegameInfoResult
    {
        public bool Exists { get; set; }
        public long SizeBytes { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string LocalPathResolved { get; set; } = string.Empty;
    }

    public class SavegameService
    {
        private readonly HttpClient _httpClient;
        private readonly string _serverBaseUrl;
        private readonly string _userId;
        private readonly string _secretKey;

        public SavegameService(string serverBaseUrl = "http://159.112.149.227:3001", string userId = "default_user", string secretKey = "steam_personal_secret_2026")
        {
            _httpClient = new HttpClient();
            _serverBaseUrl = serverBaseUrl.TrimEnd('/');
            _userId = userId;
            _secretKey = secretKey;
        }

        /// <summary>
        /// Resuelve variables de entorno del sistema operativo Windows y rutas relativas.
        /// Ejemplo: %APPDATA%/Capcom/MonsterHunterRise -> C:/Users/.../AppData/Roaming/Capcom/MonsterHunterRise
        /// </summary>
        public string ResolvePath(string rawPath, string installDir = "")
        {
            if (string.IsNullOrWhiteSpace(rawPath)) return string.Empty;

            string resolved = rawPath;

            // Reemplazar {INSTALL_DIR}
            if (!string.IsNullOrEmpty(installDir))
            {
                resolved = resolved.Replace("{INSTALL_DIR}", installDir, StringComparison.OrdinalIgnoreCase);
            }

            // Reemplazar variables de entorno de Windows
            resolved = Environment.ExpandEnvironmentVariables(resolved);

            // Reemplazar %DOCUMENTS% si se usó
            if (resolved.Contains("%DOCUMENTS%", StringComparison.OrdinalIgnoreCase))
            {
                string docsPath = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
                resolved = resolved.Replace("%DOCUMENTS%", docsPath, StringComparison.OrdinalIgnoreCase);
            }

            return Path.GetFullPath(resolved);
        }

        /// <summary>
        /// Realiza copia de seguridad comprimiendo la carpeta de guardado a ZIP local y sincronizándolo con Oracle Cloud.
        /// </summary>
        public async Task<SavegameBackupResult> BackupSavegameAsync(string gameTitle, string gameKey, string rawSavePattern, string installDir = "")
        {
            var result = new SavegameBackupResult();
            try
            {
                string targetFolder = ResolvePath(rawSavePattern, installDir);
                if (string.IsNullOrEmpty(targetFolder) || !Directory.Exists(targetFolder))
                {
                    result.Success = false;
                    result.Message = $"La carpeta de partida guardada no existe: {targetFolder}";
                    return result;
                }

                // Crear carpeta de respaldos en AppData local del usuario
                string localBackupDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SteamPersonal",
                    "Savegames",
                    gameKey
                );
                Directory.CreateDirectory(localBackupDir);

                string localZipPath = Path.Combine(localBackupDir, "latest.zip");
                if (File.Exists(localZipPath))
                {
                    File.Delete(localZipPath);
                }

                // Generar ZIP comprimido
                ZipFile.CreateFromDirectory(targetFolder, localZipPath, CompressionLevel.Optimal, false);

                var fileInfo = new FileInfo(localZipPath);
                result.SizeBytes = fileInfo.Length;
                result.LocalZipPath = localZipPath;
                result.Timestamp = DateTime.Now;

                // Subir archivo ZIP a la API de Oracle Cloud
                bool cloudSuccess = await UploadToOracleCloudAsync(gameKey, localZipPath);
                result.UploadedToCloud = cloudSuccess;
                result.Success = true;
                result.Message = cloudSuccess
                    ? "Partida guardada respaldada localmente y sincronizada con Oracle Cloud."
                    : "Partida guardada respaldada localmente (Oracle Cloud fuera de línea).";

                return result;
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = $"Error al respaldar partida guardada: {ex.Message}";
                return result;
            }
        }

        /// <summary>
        /// Descarga la partida guardada desde Oracle Cloud (o usa la copia local) y la restaura en la ruta original del juego.
        /// </summary>
        public async Task<bool> RestoreSavegameAsync(string gameTitle, string gameKey, string rawSavePattern, string installDir = "")
        {
            try
            {
                string targetFolder = ResolvePath(rawSavePattern, installDir);
                if (string.IsNullOrEmpty(targetFolder)) return false;

                string localBackupDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "SteamPersonal",
                    "Savegames",
                    gameKey
                );
                Directory.CreateDirectory(localBackupDir);
                string tempZipPath = Path.Combine(localBackupDir, "latest.zip");

                // Intentar descargar desde Oracle Cloud primero
                bool downloaded = await DownloadFromOracleCloudAsync(gameKey, tempZipPath);

                if (!downloaded && !File.Exists(tempZipPath))
                {
                    Console.WriteLine($"[SavegameService] No existe copia en la nube ni copia local para {gameKey}.");
                    return false;
                }

                // Asegurar directorio destino
                Directory.CreateDirectory(targetFolder);

                // Descomprimir sobreescribiendo archivos
                ZipFile.ExtractToDirectory(tempZipPath, targetFolder, overwriteFiles: true);

                Console.WriteLine($"[SavegameService] Partida guardada de {gameTitle} restaurada en {targetFolder}");
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SavegameService] Error al restaurar partida guardada: {ex.Message}");
                return false;
            }
        }

        /// <summary>
        /// Consulta metadatos e información de la partida guardada en la nube/local.
        /// </summary>
        public async Task<SavegameInfoResult> GetSavegameInfoAsync(string gameKey, string rawSavePattern, string installDir = "")
        {
            var info = new SavegameInfoResult
            {
                LocalPathResolved = ResolvePath(rawSavePattern, installDir)
            };

            try
            {
                string url = $"{_serverBaseUrl}/api/savegames/info/{_userId}/{gameKey}?secretKey={_secretKey}";
                var response = await _httpClient.GetAsync(url);
                if (response.IsSuccessStatusCode)
                {
                    string json = await response.Content.ReadAsStringAsync();
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    if (root.GetProperty("exists").GetBoolean())
                    {
                        info.Exists = true;
                        info.SizeBytes = root.GetProperty("sizeBytes").GetInt64();
                        info.UpdatedAt = DateTime.Parse(root.GetProperty("updatedAt").GetString() ?? DateTime.Now.ToString());
                        return info;
                    }
                }
            }
            catch
            {
                // Fallback a info de copia local si no hay conexión a la nube
            }

            string localZipPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SteamPersonal",
                "Savegames",
                gameKey,
                "latest.zip"
            );

            if (File.Exists(localZipPath))
            {
                var fInfo = new FileInfo(localZipPath);
                info.Exists = true;
                info.SizeBytes = fInfo.Length;
                info.UpdatedAt = fInfo.LastWriteTime;
            }

            return info;
        }

        private async Task<bool> UploadToOracleCloudAsync(string gameKey, string zipPath)
        {
            try
            {
                string url = $"{_serverBaseUrl}/api/savegames/upload";
                using var form = new MultipartFormDataContent();
                using var fileStream = File.OpenRead(zipPath);
                using var streamContent = new StreamContent(fileStream);

                form.Add(streamContent, "file", Path.GetFileName(zipPath));
                form.Add(new StringContent(_userId), "userId");
                form.Add(new StringContent(gameKey), "gameKey");
                form.Add(new StringContent(_secretKey), "secretKey");

                var response = await _httpClient.PostAsync(url, form);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SavegameService] Advertencia al subir a Oracle Cloud: {ex.Message}");
                return false;
            }
        }

        private async Task<bool> DownloadFromOracleCloudAsync(string gameKey, string targetZipPath)
        {
            try
            {
                string url = $"{_serverBaseUrl}/api/savegames/download/{_userId}/{gameKey}?secretKey={_secretKey}";
                var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return false;

                byte[] data = await response.Content.ReadAsByteArrayAsync();
                await File.WriteAllBytesAsync(targetZipPath, data);
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SavegameService] Advertencia al descargar de Oracle Cloud: {ex.Message}");
                return false;
            }
        }
    }
}
