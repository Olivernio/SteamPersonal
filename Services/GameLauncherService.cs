using System;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace SteamPersonal.Services
{
    public class GameSessionEventArgs : EventArgs
    {
        public string GameTitle { get; set; } = string.Empty;
        public double SessionMinutes { get; set; }
    }

    public class GameLauncherService
    {
        public event EventHandler<string>? GameStarted;
        public event EventHandler<GameSessionEventArgs>? GameExited;
        public event EventHandler<string>? LaunchFailed;

        public bool IsGameRunning { get; private set; }
        public string ActiveGameTitle { get; private set; } = string.Empty;

        public void LaunchGame(string gameTitle, string gameDirectory)
        {
            if (IsGameRunning)
            {
                LaunchFailed?.Invoke(this, $"Ya hay un juego en ejecución: {ActiveGameTitle}");
                return;
            }

            if (!Directory.Exists(gameDirectory))
            {
                LaunchFailed?.Invoke(this, $"La carpeta del juego no existe: {gameDirectory}");
                return;
            }

            string? exePath = FindMainExecutable(gameDirectory);
            if (string.IsNullOrEmpty(exePath))
            {
                LaunchFailed?.Invoke(this, "No se encontró ningún archivo ejecutable (.exe) válido en la carpeta del juego.");
                return;
            }

            try
            {
                var startInfo = new ProcessStartInfo
                {
                    FileName = exePath,
                    WorkingDirectory = Path.GetDirectoryName(exePath) ?? gameDirectory,
                    UseShellExecute = true
                };

                var process = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
                var stopwatch = new Stopwatch();

                process.Exited += (s, e) =>
                {
                    stopwatch.Stop();
                    IsGameRunning = false;
                    ActiveGameTitle = string.Empty;

                    double elapsedMinutes = stopwatch.Elapsed.TotalMinutes;

                    GameExited?.Invoke(this, new GameSessionEventArgs
                    {
                        GameTitle = gameTitle,
                        SessionMinutes = Math.Round(elapsedMinutes, 2)
                    });

                    process.Dispose();
                };

                process.Start();
                stopwatch.Start();

                IsGameRunning = true;
                ActiveGameTitle = gameTitle;

                GameStarted?.Invoke(this, gameTitle);
            }
            catch (Exception ex)
            {
                IsGameRunning = false;
                ActiveGameTitle = string.Empty;
                LaunchFailed?.Invoke(this, $"Error al iniciar el ejecutable: {ex.Message}");
            }
        }

        public static string? FindMainExecutable(string directory)
        {
            var exeFiles = Directory.GetFiles(directory, "*.exe", SearchOption.AllDirectories);

            if (exeFiles.Length == 0) return null;

            // Blacklist of common helper/installer executables
            string[] blacklist = new[]
            {
                "setup", "unins", "uninstall", "crashhandler", "unitycrashhandler",
                "vc_redist", "vcredist", "dxsetup", "dotnet", "directx", "physx",
                "easyeanticheat", "battleye"
            };

            var validExes = exeFiles.Where(file =>
            {
                string name = Path.GetFileNameWithoutExtension(file).ToLowerInvariant();
                return !blacklist.Any(b => name.Contains(b));
            }).ToList();

            if (validExes.Count == 0)
            {
                // Fallback to first exe if all were blacklisted
                return exeFiles.OrderByDescending(f => new FileInfo(f).Length).FirstOrDefault();
            }

            // Return largest executable file (usually the main game binary)
            return validExes.OrderByDescending(f => new FileInfo(f).Length).FirstOrDefault();
        }
    }
}
