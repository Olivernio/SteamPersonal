using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using SteamPersonal.Services.Models;

namespace SteamPersonal.Services
{
    public class GameRecipeService
    {
        private readonly GameDownloaderService _downloader;

        public event EventHandler<RecipeStepProgressEventArgs>? StepProgressChanged;
        public event EventHandler<string>? RecipeCompleted;
        public event EventHandler<Exception>? RecipeFailed;

        public GameRecipeService(GameDownloaderService downloader)
        {
            _downloader = downloader;
        }

        public async Task ExecuteRecipeAsync(InstallationRecipe recipe, string defaultDownloadUrl)
        {
            try
            {
                string safeTitle = string.Concat(recipe.Title.Split(Path.GetInvalidFileNameChars())).Trim();
                if (string.IsNullOrWhiteSpace(safeTitle)) safeTitle = "JuegoDescargado";

                string installDir = Path.Combine(Directory.GetCurrentDirectory(), "Juegos", safeTitle);
                Directory.CreateDirectory(installDir);

                int totalSteps = recipe.Steps.Count;

                // Fallback: If recipe has no steps, build a default stream_extract step
                if (totalSteps == 0)
                {
                    recipe.Steps.Add(new RecipeStep
                    {
                        Action = "stream_extract",
                        Url = defaultDownloadUrl,
                        Provider = "GoogleDrive"
                    });
                    recipe.Steps.Add(new RecipeStep
                    {
                        Action = "add_defender_exclusion",
                        Path = "{INSTALL_DIR}"
                    });
                    recipe.Steps.Add(new RecipeStep
                    {
                        Action = "create_shortcut",
                        ShortcutName = recipe.Title
                    });
                    totalSteps = recipe.Steps.Count;
                }

                for (int i = 0; i < totalSteps; i++)
                {
                    var step = recipe.Steps[i];
                    string desc = GetStepDescription(step, recipe.Title);

                    OnStepProgress(i + 1, totalSteps, step.Action, desc, "running");

                    switch (step.Action.ToLower())
                    {
                        case "stream_extract":
                            string url = !string.IsNullOrWhiteSpace(step.Url) ? step.Url : defaultDownloadUrl;
                            await _downloader.StartStreamExtractAsync(url, installDir, recipe.Title);
                            break;

                        case "apply_crack":
                        case "apply_patch":
                            await ExecuteApplyCrackAsync(step, installDir);
                            break;

                        case "add_defender_exclusion":
                            await ExecuteAddDefenderExclusionAsync(step, installDir);
                            break;

                        case "create_shortcut":
                            await ExecuteCreateShortcutAsync(step, installDir, recipe);
                            break;

                        default:
                            Console.WriteLine($"[Recipe] Acción desconocida omitida: {step.Action}");
                            break;
                    }

                    OnStepProgress(i + 1, totalSteps, step.Action, desc, "completed");
                }

                RecipeCompleted?.Invoke(this, installDir);
            }
            catch (Exception ex)
            {
                RecipeFailed?.Invoke(this, ex);
            }
        }

        // ── Action Handlers ─────────────────────────────────────

        private async Task ExecuteApplyCrackAsync(RecipeStep step, string installDir)
        {
            await Task.Run(() =>
            {
                string source = ResolvePath(step.SourceFolder, installDir);
                string target = ResolvePath(step.TargetFolder, installDir);

                if (Directory.Exists(source))
                {
                    CopyDirectoryRecursive(source, target);
                }
                else if (File.Exists(source))
                {
                    string destFile = Path.Combine(target, Path.GetFileName(source));
                    Directory.CreateDirectory(Path.GetDirectoryName(destFile)!);
                    File.Copy(source, destFile, true);
                }
            });
        }

        private async Task ExecuteAddDefenderExclusionAsync(RecipeStep step, string installDir)
        {
            await Task.Run(() =>
            {
                string targetPath = ResolvePath(step.Path, installDir);

                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = "powershell.exe",
                        Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"Add-MpPreference -ExclusionPath '{targetPath}'\"",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        Verb = "runas" // Request elevated privileges if needed
                    };

                    using var proc = Process.Start(psi);
                    proc?.WaitForExit(5000);
                }
                catch (Exception ex)
                {
                    // Non-fatal: user might be non-admin or Defender disabled
                    Console.WriteLine($"[Defender Exclusion] Aviso: {ex.Message}");
                }
            });
        }

        private async Task ExecuteCreateShortcutAsync(RecipeStep step, string installDir, InstallationRecipe recipe)
        {
            await Task.Run(() =>
            {
                try
                {
                    string shortcutName = !string.IsNullOrWhiteSpace(step.ShortcutName)
                        ? step.ShortcutName
                        : recipe.Title;

                    string desktopPath = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                    string shortcutLocation = Path.Combine(desktopPath, $"{shortcutName}.lnk");

                    // Locate executable relative path or fallback to auto-finder
                    string targetExe = !string.IsNullOrWhiteSpace(recipe.ExecutableRelativePath)
                        ? Path.Combine(installDir, recipe.ExecutableRelativePath.Replace('/', Path.DirectorySeparatorChar))
                        : FindBestExecutable(installDir);

                    if (File.Exists(targetExe))
                    {
                        CreateShortcutWindows(targetExe, installDir, shortcutLocation);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Shortcut] Aviso: {ex.Message}");
                }
            });
        }

        // ── Windows Shell Shortcut Creator ─────────────────────

        private static void CreateShortcutWindows(string targetExe, string workingDir, string shortcutLocation)
        {
            try
            {
                Type? shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType)!;
                    var shortcut = shell.CreateShortcut(shortcutLocation);
                    shortcut.TargetPath = targetExe;
                    shortcut.WorkingDirectory = workingDir;
                    shortcut.Description = $"Lanzar desde Steam Personal";
                    shortcut.Save();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error al crear acceso directo: {ex.Message}");
            }
        }

        // ── Helpers ─────────────────────────────────────────────

        private static string ResolvePath(string? pathTemplate, string installDir)
        {
            if (string.IsNullOrWhiteSpace(pathTemplate))
                return installDir;

            return pathTemplate.Replace("{INSTALL_DIR}", installDir)
                               .Replace('/', Path.DirectorySeparatorChar);
        }

        private static string FindBestExecutable(string folder)
        {
            if (!Directory.Exists(folder)) return string.Empty;

            var exeFiles = Directory.GetFiles(folder, "*.exe", SearchOption.AllDirectories);
            foreach (var exe in exeFiles)
            {
                string name = Path.GetFileName(exe).ToLower();
                if (name.Contains("unins") || name.Contains("setup") || name.Contains("crash")) continue;
                return exe;
            }
            return exeFiles.Length > 0 ? exeFiles[0] : string.Empty;
        }

        private static void CopyDirectoryRecursive(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            foreach (var file in Directory.GetFiles(sourceDir))
            {
                string dest = Path.Combine(targetDir, Path.GetFileName(file));
                File.Copy(file, dest, true);
            }
            foreach (var subDir in Directory.GetDirectories(sourceDir))
            {
                string destSub = Path.Combine(targetDir, Path.GetFileName(subDir));
                CopyDirectoryRecursive(subDir, destSub);
            }
        }

        private void OnStepProgress(int stepIndex, int totalSteps, string action, string description, string status)
        {
            StepProgressChanged?.Invoke(this, new RecipeStepProgressEventArgs
            {
                StepIndex = stepIndex,
                TotalSteps = totalSteps,
                Action = action,
                Description = description,
                Status = status
            });
        }

        private static string GetStepDescription(RecipeStep step, string title) => step.Action.ToLower() switch
        {
            "stream_extract" => $"Descargando y extrayendo en vivo: {title}",
            "apply_crack" or "apply_patch" => "Aplicando parches y medicina del juego...",
            "add_defender_exclusion" => "Agregando exclusión en Windows Defender...",
            "create_shortcut" => "Creando acceso directo en el Escritorio...",
            _ => $"Ejecutando paso: {step.Action}"
        };
    }
}
