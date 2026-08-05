using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using SharpCompress.Common;
using SharpCompress.Readers;

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
        public string Phase { get; set; } = "downloading";
    }

    public class GameDownloaderService
    {
        private CancellationTokenSource? _cts;
        private Task? _activeTask;
        private bool _isPaused;

        // State preserved for pause/resume
        private string _activeUrl = "";
        private string _activeDestDir = "";
        private long _lastDownloadedBytes;
        private long _lastTotalBytes;

        private const int MaxRetries = 5;
        private const int RetryDelayMs = 3000;
        private const int BufferSize = 65536; // 64 KB

        public event EventHandler<DownloadProgressEventArgs>? ProgressChanged;
        public event EventHandler<string>? DownloadCompleted;
        public event EventHandler<Exception>? DownloadFailed;

        public bool IsPaused => _isPaused;

        // ── Public API ──────────────────────────────────────────

        public async Task StartDownloadAndExtractAsync(string url, string destinationDir)
        {
            // Cancel and wait for any previous task
            if (_activeTask != null && !_activeTask.IsCompleted)
            {
                _cts?.Cancel();
                try { await _activeTask; } catch { /* swallow */ }
            }

            _activeUrl = url;
            _activeDestDir = destinationDir;
            _isPaused = false;
            _lastDownloadedBytes = 0;
            _lastTotalBytes = 0;
            _cts = new CancellationTokenSource();

            _activeTask = ExecuteAsync(url, destinationDir, _cts.Token);
            await _activeTask;
        }

        public void Pause()
        {
            _isPaused = true;
            _cts?.Cancel(); // Stops the HTTP connection cleanly
            // .part file stays on disk for resume
        }

        public void Resume()
        {
            if (_isPaused && !string.IsNullOrEmpty(_activeUrl))
            {
                _isPaused = false;
                // Fire-and-forget: starts new download from .part using Range
                _ = StartResumeAsync();
            }
        }

        public void Cancel()
        {
            _isPaused = false;
            _cts?.Cancel();

            // Delete .part file so next download starts fresh
            string partFile = _activeDestDir + ".part";
            Task.Run(async () =>
            {
                await Task.Delay(500); // Small delay to let file handles close
                try { if (File.Exists(partFile)) File.Delete(partFile); } catch { }
            });
        }

        // ── Core execution ──────────────────────────────────────

        private async Task StartResumeAsync()
        {
            // Wait for previous task to finish (it was cancelled by Pause)
            if (_activeTask != null && !_activeTask.IsCompleted)
            {
                try { await _activeTask; } catch { /* swallow */ }
            }

            _cts = new CancellationTokenSource();
            _activeTask = ExecuteAsync(_activeUrl, _activeDestDir, _cts.Token);
            await _activeTask;
        }

        private async Task ExecuteAsync(string url, string destinationDir, CancellationToken ct)
        {
            try
            {
                Directory.CreateDirectory(destinationDir);
                string partFilePath = destinationDir + ".part";

                // ── Phase 1: Download to .part file ──────────────
                OnProgressUpdate(0, 0, 0, 0, "", "Conectando al servidor...", "downloading");
                await DownloadToFileAsync(url, partFilePath, ct);

                // Rename .part → .archive
                string archivePath = Path.ChangeExtension(partFilePath, ".archive");
                if (File.Exists(archivePath)) File.Delete(archivePath);
                File.Move(partFilePath, archivePath);

                // ── Phase 2: Extract archive ─────────────────────
                OnProgressUpdate(0, 0, 0, 0, "", "Iniciando extracción...", "extracting");
                await ExtractFileAsync(archivePath, destinationDir, ct);

                // Cleanup archive
                try { File.Delete(archivePath); } catch { }

                DownloadCompleted?.Invoke(this, destinationDir);
            }
            catch (OperationCanceledException)
            {
                if (_isPaused)
                {
                    double pct = _lastTotalBytes > 0
                        ? (double)_lastDownloadedBytes / _lastTotalBytes * 100 : 0;
                    OnProgressUpdate(pct, _lastDownloadedBytes, _lastTotalBytes, 0, "", "Pausado", "downloading");
                }
                else
                {
                    OnProgressUpdate(0, 0, 0, 0, "", "Descarga Cancelada.", "downloading");
                }
            }
            catch (Exception ex)
            {
                DownloadFailed?.Invoke(this, ex);
            }
        }

        // ── Phase 1: Download with Range resume + retry ─────────

        private async Task DownloadToFileAsync(string url, string partFilePath, CancellationToken ct)
        {
            int retryCount = 0;

            while (true)
            {
                try
                {
                    long existingBytes = File.Exists(partFilePath) ? new FileInfo(partFilePath).Length : 0;

                    // Create HttpClient with cookies (needed for Google Drive)
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

                    // Resolve Google Drive URL using same client (preserves cookies)
                    string downloadUrl = await ResolveUrlWithClientAsync(client, url, ct);

                    // Build request with Range header if resuming
                    var request = new HttpRequestMessage(HttpMethod.Get, downloadUrl);

                    if (existingBytes > 0)
                    {
                        request.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(existingBytes, null);
                        OnProgressUpdate(0, existingBytes, 0, 0, "", "Reanudando descarga...", "downloading");
                    }

                    using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);

                    bool isPartial = response.StatusCode == HttpStatusCode.PartialContent;
                    bool isFull = response.StatusCode == HttpStatusCode.OK;

                    if (!isPartial && !isFull)
                    {
                        response.EnsureSuccessStatusCode();
                    }

                    long contentLength = response.Content.Headers.ContentLength ?? 0;
                    long totalBytes;
                    FileMode fileMode;

                    if (isPartial && existingBytes > 0)
                    {
                        totalBytes = existingBytes + contentLength;
                        fileMode = FileMode.Append;
                    }
                    else
                    {
                        totalBytes = contentLength;
                        existingBytes = 0;
                        fileMode = FileMode.Create;
                    }

                    using var networkStream = await response.Content.ReadAsStreamAsync(ct);
                    using var fileStream = new FileStream(partFilePath, fileMode, FileAccess.Write, FileShare.None, BufferSize);

                    var buffer = new byte[BufferSize];
                    long downloadedBytes = existingBytes;
                    var stopwatch = Stopwatch.StartNew();
                    long lastSpeedBytes = downloadedBytes;
                    double smoothedSpeed = 0;
                    const double alpha = 0.3;

                    int bytesRead;
                    while ((bytesRead = await networkStream.ReadAsync(buffer, 0, buffer.Length, ct)) > 0)
                    {
                        ct.ThrowIfCancellationRequested();

                        await fileStream.WriteAsync(buffer, 0, bytesRead, ct);
                        downloadedBytes += bytesRead;

                        // Track for pause/resume display
                        _lastDownloadedBytes = downloadedBytes;
                        _lastTotalBytes = totalBytes;

                        // Update speed every 500ms
                        if (stopwatch.ElapsedMilliseconds >= 500)
                        {
                            long deltaBytes = downloadedBytes - lastSpeedBytes;
                            double deltaSecs = stopwatch.Elapsed.TotalSeconds;
                            double instantSpeed = deltaSecs > 0 ? deltaBytes / deltaSecs : 0;

                            smoothedSpeed = smoothedSpeed == 0
                                ? instantSpeed
                                : (alpha * instantSpeed) + ((1 - alpha) * smoothedSpeed);

                            lastSpeedBytes = downloadedBytes;
                            stopwatch.Restart();

                            double percentage = totalBytes > 0 ? (double)downloadedBytes / totalBytes * 100 : 0;
                            OnProgressUpdate(percentage, downloadedBytes, totalBytes, smoothedSpeed, "",
                                "Descargando...", "downloading");
                        }
                    }

                    // Final 100% update
                    OnProgressUpdate(100, downloadedBytes, totalBytes, smoothedSpeed, "",
                        "Descarga completada", "downloading");

                    return; // Success
                }
                catch (OperationCanceledException)
                {
                    throw; // Don't retry on user-initiated cancel/pause
                }
                catch (Exception ex) when (retryCount < MaxRetries)
                {
                    retryCount++;
                    OnProgressUpdate(0, _lastDownloadedBytes, _lastTotalBytes, 0, "",
                        $"Error de red. Reintento {retryCount}/{MaxRetries} en 3s...", "downloading");

                    Console.WriteLine($"[Retry {retryCount}/{MaxRetries}] {ex.Message}");
                    await Task.Delay(RetryDelayMs, ct);
                    // Next loop iteration will re-read .part size and use Range
                }
            }
        }

        // ── Phase 2: Extract from completed archive ─────────────

        private async Task ExtractFileAsync(string archivePath, string destinationDir, CancellationToken ct)
        {
            await Task.Run(() =>
            {
                using var fileStream = File.OpenRead(archivePath);
                long totalArchiveBytes = fileStream.Length;
                string currentFile = string.Empty;

                var trackedStream = new TrackedStream(fileStream, totalArchiveBytes, ct);

                trackedStream.OnBytesRead += (read, total, speed) =>
                {
                    double percentage = total.HasValue && total.Value > 0
                        ? (double)read / total.Value * 100 : 0;
                    OnProgressUpdate(percentage, read, total ?? 0, speed, currentFile,
                        "Extrayendo...", "extracting");
                };

                using var reader = ReaderFactory.OpenReader(trackedStream);

                while (reader.MoveToNextEntry())
                {
                    ct.ThrowIfCancellationRequested();

                    if (!reader.Entry.IsDirectory)
                    {
                        currentFile = Path.GetFileName(reader.Entry.Key ?? "");

                        reader.WriteEntryToDirectory(destinationDir, new ExtractionOptions
                        {
                            ExtractFullPath = true,
                            Overwrite = true
                        });
                    }
                }
            }, ct);
        }

        // ── Google Drive URL resolution (same HttpClient for cookies) ──

        private async Task<string> ResolveUrlWithClientAsync(HttpClient client, string url, CancellationToken ct)
        {
            string fileId = ExtractGoogleDriveId(url);
            if (string.IsNullOrEmpty(fileId))
                return url; // Direct URL

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

        private void OnProgressUpdate(double percentage, long downloaded, long total, double speed, string currentFile, string status, string phase)
        {
            ProgressChanged?.Invoke(this, new DownloadProgressEventArgs
            {
                ProgressPercentage = percentage,
                BytesDownloaded = downloaded,
                TotalBytes = total,
                Speed = speed,
                CurrentFile = currentFile,
                Status = status,
                Phase = phase
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

    // ── TrackedStream (extraction progress only, no pause) ───────

    public class TrackedStream : Stream
    {
        private readonly Stream _baseStream;
        private readonly long? _totalBytes;
        private readonly CancellationToken _cancellationToken;
        private long _totalBytesRead;

        private readonly Stopwatch _stopwatch = new Stopwatch();
        private long _lastBytesRead;
        private double _smoothedSpeed;
        private const double SmoothingFactor = 0.3;
        private const int SpeedUpdateIntervalMs = 500;

        public event Action<long, long?, double>? OnBytesRead;

        public TrackedStream(Stream baseStream, long? totalBytes, CancellationToken cancellationToken)
        {
            _baseStream = baseStream;
            _totalBytes = totalBytes;
            _cancellationToken = cancellationToken;
            _stopwatch.Start();
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            _cancellationToken.ThrowIfCancellationRequested();

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