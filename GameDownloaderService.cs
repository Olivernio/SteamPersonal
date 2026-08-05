using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using SharpCompress.Common;
using SharpCompress.Readers;
using SteamPersonal.Services.Models;

namespace SteamPersonal.Services
{
    public class DownloadProgressEventArgs : EventArgs
    {
        public double ProgressPercentage { get; set; }
        public long BytesDownloaded { get; set; }
        public long TotalBytes { get; set; }
        public double Speed { get; set; }
        public string CurrentFile { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public int FilesCompleted { get; set; }
    }

    public class GameDownloaderService
    {
        private CancellationTokenSource? _cts;
        private ManualResetEventSlim _pauseEvent = new ManualResetEventSlim(true);
        private Task? _activeTask;

        // State preserved for display during pause
        private string _activeUrl = "";
        private string _activeDestDir = "";
        private string _activeGameTitle = "";
        private long _lastDownloadedBytes;
        private long _lastTotalBytes;
        private int _lastFilesCompleted;

        private const int MaxRetries = 5;
        private const int RetryDelayMs = 3000;
        private const int BufferSize = 65536; // 64 KB

        public event EventHandler<DownloadProgressEventArgs>? ProgressChanged;
        public event EventHandler<string>? DownloadCompleted;
        public event EventHandler<Exception>? DownloadFailed;

        public bool IsPaused => !_pauseEvent.IsSet;

        // ── Public API ──────────────────────────────────────────

        public async Task StartStreamExtractAsync(string url, string destinationDir, string gameTitle)
        {
            // Cancel and wait for any previous task
            if (_activeTask != null && !_activeTask.IsCompleted)
            {
                _cts?.Cancel();
                _pauseEvent.Set(); // Unblock any paused thread
                try { await _activeTask; } catch { /* swallow */ }
            }

            _activeUrl = url;
            _activeDestDir = destinationDir;
            _activeGameTitle = gameTitle;
            _lastDownloadedBytes = 0;
            _lastTotalBytes = 0;
            _lastFilesCompleted = 0;
            _cts = new CancellationTokenSource();
            _pauseEvent.Set();

            _activeTask = Task.Run(() => ExecuteStreamExtractAsync(url, destinationDir, gameTitle, _cts.Token));
            await _activeTask;
        }

        public void Pause()
        {
            _pauseEvent.Reset(); // Blocks TrackedStream.Read() on next call
            OnProgressUpdate(
                _lastTotalBytes > 0 ? (double)_lastDownloadedBytes / _lastTotalBytes * 100 : 0,
                _lastDownloadedBytes, _lastTotalBytes, 0, "", "Pausado", _lastFilesCompleted);
        }

        public void Resume()
        {
            _pauseEvent.Set(); // Unblocks TrackedStream.Read()
        }

        public void Cancel()
        {
            _cts?.Cancel();
            _pauseEvent.Set(); // Unblock any paused thread so it can observe cancellation

            // Clean up: delete destination directory and manifest
            string destDir = _activeDestDir;
            Task.Run(async () =>
            {
                await Task.Delay(500); // Let file handles close
                try
                {
                    ManifestHelper.Delete(destDir);
                    // Optionally delete extracted files too
                    // if (Directory.Exists(destDir)) Directory.Delete(destDir, true);
                }
                catch { }
            });
        }

        // ── Core: Streaming Extraction with Checkpoints ─────────

        private async Task ExecuteStreamExtractAsync(string url, string destinationDir, string gameTitle, CancellationToken ct)
        {
            int retryCount = 0;

            while (true)
            {
                try
                {
                    Directory.CreateDirectory(destinationDir);

                    // 1. Clean orphaned .tmp files from any previous interrupted run
                    ManifestHelper.CleanOrphanedTmpFiles(destinationDir);

                    // 2. Load manifest to know what's already extracted
                    var manifest = ManifestHelper.Load(destinationDir) ?? new DownloadManifest
                    {
                        GameTitle = gameTitle,
                        SourceUrl = url,
                        DestinationDir = destinationDir,
                        CompletedFiles = new List<CompletedFileEntry>()
                    };
                    var completedSet = ManifestHelper.BuildCompletedSet(manifest);

                    bool isResuming = completedSet.Count > 0;
                    if (isResuming)
                    {
                        OnProgressUpdate(0, 0, 0, 0, "",
                            $"Reanudando... {completedSet.Count} archivos ya extraídos", completedSet.Count);
                    }
                    else
                    {
                        OnProgressUpdate(0, 0, 0, 0, "", "Conectando al servidor...", 0);
                    }

                    // 3. Open HTTP stream
                    var cookieContainer = new CookieContainer();
                    var handler = new HttpClientHandler
                    {
                        AllowAutoRedirect = true,
                        UseCookies = true,
                        CookieContainer = cookieContainer
                    };

                    using var client = new HttpClient(handler);
                    client.Timeout = TimeSpan.FromHours(4);
                    client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

                    // Resolve Google Drive URL (same client preserves cookies)
                    string downloadUrl = await ResolveUrlWithClientAsync(client, url, ct);

                    using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, ct);
                    response.EnsureSuccessStatusCode();

                    long? totalBytes = response.Content.Headers.ContentLength;

                    // 4. Wrap in TrackedStream for progress + pause support
                    using var networkStream = await response.Content.ReadAsStreamAsync(ct);
                    using var trackedStream = new TrackedStream(networkStream, totalBytes, _pauseEvent, ct);

                    trackedStream.OnBytesRead += (bytesRead, total, speed) =>
                    {
                        _lastDownloadedBytes = bytesRead;
                        _lastTotalBytes = total ?? 0;

                        double percentage = (total.HasValue && total.Value > 0)
                            ? (double)bytesRead / total.Value * 100 : 0;

                        OnProgressUpdate(percentage, bytesRead, total ?? 0, speed, "",
                            IsPaused ? "Pausado" : "Descargando y extrayendo...", _lastFilesCompleted);
                    };

                    // 5. Stream directly into SharpCompress
                    using var reader = ReaderFactory.OpenReader(trackedStream);
                    int skippedCount = 0;

                    while (reader.MoveToNextEntry())
                    {
                        ct.ThrowIfCancellationRequested();

                        if (reader.Entry.IsDirectory)
                            continue;

                        string entryKey = reader.Entry.Key ?? "";
                        string normalizedKey = ManifestHelper.NormalizePath(entryKey);

                        // Check if already extracted (from manifest)
                        if (completedSet.Contains(normalizedKey))
                        {
                            // Skip: already extracted in a previous session.
                            // IReader automatically advances past entries that aren't read.
                            skippedCount++;

                            if (skippedCount % 50 == 0)
                            {
                                OnProgressUpdate(0, _lastDownloadedBytes, _lastTotalBytes, 0, "",
                                    $"Omitiendo archivos ya extraídos ({skippedCount}/{completedSet.Count})...",
                                    completedSet.Count);
                            }
                            continue;
                        }

                        string fileName = Path.GetFileName(entryKey);

                        // 6. Extract to .tmp first (anti-corruption)
                        string relativePath = entryKey.Replace('/', Path.DirectorySeparatorChar);
                        string finalPath = Path.Combine(destinationDir, relativePath);
                        string tmpPath = finalPath + ".tmp";

                        // Ensure target directory exists
                        string? targetDir = Path.GetDirectoryName(finalPath);
                        if (targetDir != null) Directory.CreateDirectory(targetDir);

                        // Write entry to .tmp file
                        using (var entryStream = reader.OpenEntryStream())
                        using (var tmpFile = new FileStream(tmpPath, FileMode.Create, FileAccess.Write, FileShare.None, BufferSize))
                        {
                            var buffer = new byte[BufferSize];
                            int bytesRead;
                            while ((bytesRead = entryStream.Read(buffer, 0, buffer.Length)) > 0)
                            {
                                ct.ThrowIfCancellationRequested();
                                _pauseEvent.Wait(ct);
                                tmpFile.Write(buffer, 0, bytesRead);
                            }
                        }

                        // 7. Rename .tmp → final (atomic commit)
                        if (File.Exists(finalPath)) File.Delete(finalPath);
                        File.Move(tmpPath, finalPath);

                        // 8. Register in manifest
                        var fileInfo = new FileInfo(finalPath);
                        manifest.CompletedFiles.Add(new CompletedFileEntry
                        {
                            RelativePath = normalizedKey,
                            SizeBytes = fileInfo.Length
                        });
                        completedSet.Add(normalizedKey);
                        _lastFilesCompleted = manifest.CompletedFiles.Count;

                        // Save manifest periodically (every file)
                        ManifestHelper.Save(manifest);

                        // Update UI with current file name
                        OnProgressUpdate(
                            _lastTotalBytes > 0 ? (double)_lastDownloadedBytes / _lastTotalBytes * 100 : 0,
                            _lastDownloadedBytes, _lastTotalBytes, 0, fileName,
                            "Descargando y extrayendo...", _lastFilesCompleted);
                    }

                    // 9. Done! Clean up manifest
                    ManifestHelper.Delete(destinationDir);
                    DownloadCompleted?.Invoke(this, destinationDir);
                    return; // Success — exit retry loop

                }
                catch (OperationCanceledException)
                {
                    // User-initiated cancel or pause → don't retry
                    OnProgressUpdate(0, 0, 0, 0, "", "Descarga Cancelada.", 0);
                    return;
                }
                catch (Exception ex) when (retryCount < MaxRetries)
                {
                    retryCount++;
                    OnProgressUpdate(0, _lastDownloadedBytes, _lastTotalBytes, 0, "",
                        $"Error de red. Reintento {retryCount}/{MaxRetries} en 3s...", _lastFilesCompleted);

                    Console.WriteLine($"[Retry {retryCount}/{MaxRetries}] {ex.Message}");
                    await Task.Delay(RetryDelayMs, ct);
                    // Next iteration will load manifest and SkipEntry() past completed files
                }
                catch (Exception ex)
                {
                    DownloadFailed?.Invoke(this, ex);
                    return;
                }
            }
        }

        // ── Google Drive URL resolution ─────────────────────────

        private async Task<string> ResolveUrlWithClientAsync(HttpClient client, string url, CancellationToken ct)
        {
            string fileId = ExtractGoogleDriveId(url);
            if (string.IsNullOrEmpty(fileId))
                return url;

            string downloadUrl = $"https://drive.usercontent.google.com/download?id={fileId}&export=download&confirm=t";

            using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, ct);
            response.EnsureSuccessStatusCode();

            var contentType = response.Content.Headers.ContentType?.MediaType;
            if (contentType != null && contentType.Contains("text/html"))
            {
                string htmlContent = await response.Content.ReadAsStringAsync(ct);
                var confirmMatch = Regex.Match(htmlContent, @"confirm=([a-zA-Z0-9_-]+)");

                if (confirmMatch.Success)
                {
                    string token = confirmMatch.Groups[1].Value;
                    return $"https://drive.usercontent.google.com/download?id={fileId}&export=download&confirm={token}";
                }
                else
                {
                    throw new Exception("El enlace de Google Drive no es público o requiere autenticación.");
                }
            }

            return downloadUrl;
        }

        // ── Helpers ─────────────────────────────────────────────

        private void OnProgressUpdate(double percentage, long downloaded, long total, double speed,
            string currentFile, string status, int filesCompleted)
        {
            ProgressChanged?.Invoke(this, new DownloadProgressEventArgs
            {
                ProgressPercentage = percentage,
                BytesDownloaded = downloaded,
                TotalBytes = total,
                Speed = speed,
                CurrentFile = currentFile,
                Status = status,
                FilesCompleted = filesCompleted
            });
        }

        private string ExtractGoogleDriveId(string inputUrl)
        {
            if (inputUrl.Contains("drive.google.com"))
            {
                var match = Regex.Match(inputUrl, @"(?:/file/d/|id=)([\w-]+)");
                if (match.Success) return match.Groups[1].Value;
            }
            return string.Empty;
        }
    }

    // ── TrackedStream: progress + speed + pause support ──────────

    public class TrackedStream : Stream
    {
        private readonly Stream _baseStream;
        private readonly long? _totalBytes;
        private readonly ManualResetEventSlim _pauseEvent;
        private readonly CancellationToken _cancellationToken;
        private long _totalBytesRead;

        private readonly Stopwatch _stopwatch = new Stopwatch();
        private long _lastBytesRead;
        private double _smoothedSpeed;
        private const double SmoothingFactor = 0.3;
        private const int SpeedUpdateIntervalMs = 500;

        /// <summary>
        /// Fired with (totalBytesRead, totalExpected, speedBytesPerSec)
        /// </summary>
        public event Action<long, long?, double>? OnBytesRead;

        public TrackedStream(Stream baseStream, long? totalBytes, ManualResetEventSlim pauseEvent, CancellationToken cancellationToken)
        {
            _baseStream = baseStream;
            _totalBytes = totalBytes;
            _pauseEvent = pauseEvent;
            _cancellationToken = cancellationToken;
            _stopwatch.Start();
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            _cancellationToken.ThrowIfCancellationRequested();
            _pauseEvent.Wait(_cancellationToken); // Blocks here when paused

            int bytesRead = _baseStream.Read(buffer, offset, count);
            _totalBytesRead += bytesRead;

            if (_stopwatch.ElapsedMilliseconds >= SpeedUpdateIntervalMs)
            {
                long deltaBytes = _totalBytesRead - _lastBytesRead;
                double deltaSeconds = _stopwatch.Elapsed.TotalSeconds;
                double instantSpeed = (deltaSeconds > 0) ? deltaBytes / deltaSeconds : 0;

                _smoothedSpeed = (_smoothedSpeed == 0)
                    ? instantSpeed
                    : (SmoothingFactor * instantSpeed) + ((1 - SmoothingFactor) * _smoothedSpeed);

                _lastBytesRead = _totalBytesRead;
                _stopwatch.Restart();

                OnBytesRead?.Invoke(_totalBytesRead, _totalBytes, _smoothedSpeed);
            }

            return bytesRead;
        }

        public override bool CanRead => _baseStream.CanRead;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => _baseStream.Length;
        public override long Position { get => _baseStream.Position; set => throw new NotSupportedException(); }
        public override void Flush() => _baseStream.Flush();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}