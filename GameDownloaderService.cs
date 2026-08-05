using System;
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
        public string CurrentFile { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }

    public class GameDownloaderService
    {
        private CancellationTokenSource? _cts;
        private ManualResetEventSlim _pauseEvent = new ManualResetEventSlim(true);

        public event EventHandler<DownloadProgressEventArgs>? ProgressChanged;
        public event EventHandler<string>? DownloadCompleted;
        public event EventHandler<Exception>? DownloadFailed;

        public bool IsPaused => !_pauseEvent.IsSet;

        public async Task StartDownloadAndExtractAsync(string url, string destinationDir)
        {
            _cts = new CancellationTokenSource();
            _pauseEvent.Set();

            try
            {
                Directory.CreateDirectory(destinationDir);
                OnProgressUpdate(0, 0, 0, "", "Conectando al servidor...");

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

                string fileId = ExtractGoogleDriveId(url);
                string downloadUrl = string.IsNullOrEmpty(fileId) 
                    ? url 
                    : $"https://drive.usercontent.google.com/download?id={fileId}&export=download&confirm=t";

                using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead, _cts.Token);
                response.EnsureSuccessStatusCode();

                var contentType = response.Content.Headers.ContentType?.MediaType;
                if (contentType != null && contentType.Contains("text/html"))
                {
                    string htmlContent = await response.Content.ReadAsStringAsync(_cts.Token);
                    var confirmMatch = Regex.Match(htmlContent, @"confirm=([a-zA-Z0-9_-]+)");
                    
                    if (confirmMatch.Success)
                    {
                        string token = confirmMatch.Groups[1].Value;
                        string confirmUrl = $"https://drive.usercontent.google.com/download?id={fileId}&export=download&confirm={token}";
                        
                        using var confirmResponse = await client.GetAsync(confirmUrl, HttpCompletionOption.ResponseHeadersRead, _cts.Token);
                        confirmResponse.EnsureSuccessStatusCode();
                        await ProcessStreamAsync(confirmResponse, destinationDir, _cts.Token);
                        return;
                    }
                    else
                    {
                        throw new Exception("El enlace no es público o requiere autenticación.");
                    }
                }

                await ProcessStreamAsync(response, destinationDir, _cts.Token);
            }
            catch (OperationCanceledException)
            {
                OnProgressUpdate(0, 0, 0, "", "Descarga Cancelada.");
            }
            catch (Exception ex)
            {
                DownloadFailed?.Invoke(this, ex);
            }
        }

        private async Task ProcessStreamAsync(HttpResponseMessage response, string destinationDir, CancellationToken cancellationToken)
        {
            long? totalBytes = response.Content.Headers.ContentLength;

            using var networkStream = await response.Content.ReadAsStreamAsync(cancellationToken);
            using var trackedStream = new TrackedStream(networkStream, totalBytes, _pauseEvent, cancellationToken);

            trackedStream.OnBytesRead += (bytesRead, total) =>
            {
                double percentage = (total.HasValue && total.Value > 0) ? (double)bytesRead / total.Value * 100 : 0;
                OnProgressUpdate(percentage, bytesRead, total ?? 0, "", IsPaused ? "Pausado" : "Descargando y extrayendo...");
            };

            using var reader = ReaderFactory.OpenReader(trackedStream);

            while (reader.MoveToNextEntry())
            {
                if (!reader.Entry.IsDirectory)
                {
                    OnProgressUpdate(0, 0, 0, reader.Entry.Key ?? "", IsPaused ? "Pausado" : "Extrayendo archivo...");
                    
                    reader.WriteEntryToDirectory(destinationDir, new ExtractionOptions
                    {
                        ExtractFullPath = true,
                        Overwrite = true
                    });
                }
            }

            DownloadCompleted?.Invoke(this, destinationDir);
        }

        public void Pause() => _pauseEvent.Reset();
        public void Resume() => _pauseEvent.Set();
        public void Cancel() => _cts?.Cancel();

        private void OnProgressUpdate(double percentage, long downloaded, long total, string currentFile, string status)
        {
            ProgressChanged?.Invoke(this, new DownloadProgressEventArgs
            {
                ProgressPercentage = percentage,
                BytesDownloaded = downloaded,
                TotalBytes = total,
                CurrentFile = currentFile,
                Status = status
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

    public class TrackedStream : Stream
    {
        private readonly Stream _baseStream;
        private readonly long? _totalBytes;
        private readonly ManualResetEventSlim _pauseEvent;
        private readonly CancellationToken _cancellationToken;
        private long _totalBytesRead;

        public event Action<long, long?>? OnBytesRead;

        public TrackedStream(Stream baseStream, long? totalBytes, ManualResetEventSlim pauseEvent, CancellationToken cancellationToken)
        {
            _baseStream = baseStream;
            _totalBytes = totalBytes;
            _pauseEvent = pauseEvent;
            _cancellationToken = cancellationToken;
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            _cancellationToken.ThrowIfCancellationRequested();
            _pauseEvent.Wait(_cancellationToken);

            int bytesRead = _baseStream.Read(buffer, offset, count);
            _totalBytesRead += bytesRead;

            OnBytesRead?.Invoke(_totalBytesRead, _totalBytes);

            return bytesRead;
        }

        public override bool CanRead => _baseStream.CanRead;
        public override bool CanSeek => false;
        public override bool CanWrite => _baseStream.CanWrite;
        public override long Length => _baseStream.Length;
        public override long Position { get => _baseStream.Position; set => _baseStream.Position = value; }
        public override void Flush() => _baseStream.Flush();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => _baseStream.SetLength(value);
        public override void Write(byte[] buffer, int offset, int count) => _baseStream.Write(buffer, offset, count);
    }
}