// ─────────────────────────────────────────────────────────────
// WebView2 Bridge — Bidirectional communication layer
// Frontend (React) ↔ Backend (C# / WinForms / WebView2)
// ─────────────────────────────────────────────────────────────

// ── Messages from C# → Frontend ──────────────────────────────

export interface DownloadProgressMessage {
  type: 'DOWNLOAD_PROGRESS';
  progress: number;       // 0–100
  downloaded: number;     // bytes downloaded so far
  total: number;          // total bytes (0 if unknown)
  speed: number;          // bytes per second (calculated in C#)
  file: string;           // current file being extracted
  status: string;         // "Conectando...", "Descargando y extrayendo...", "Pausado", etc.
  gameTitle?: string;     // optional game title from backend
}

export interface DownloadCompletedMessage {
  type: 'DOWNLOAD_COMPLETED';
  destination: string;
}

export interface DownloadFailedMessage {
  type: 'DOWNLOAD_FAILED';
  error: string;
}

export interface GameStartedMessage {
  type: 'GAME_STARTED';
  gameTitle: string;
}

export interface GameExitedMessage {
  type: 'GAME_EXITED';
  gameTitle: string;
  sessionMinutes: number;
}

export interface LaunchFailedMessage {
  type: 'LAUNCH_FAILED';
  error: string;
}

export type WebViewMessage =
  | DownloadProgressMessage
  | DownloadCompletedMessage
  | DownloadFailedMessage
  | GameStartedMessage
  | GameExitedMessage
  | LaunchFailedMessage;

// ── Send commands to C# backend ──────────────────────────────

export function sendCommand(action: string, payload?: Record<string, unknown>): void {
  const msg = { action, ...payload };
  if (window.chrome?.webview?.postMessage) {
    window.chrome.webview.postMessage(msg);
  } else {
    console.warn('[WebView Bridge] No WebView2 environment, command ignored:', msg);
  }
}

// Convenience functions matching the C# OnWebMessageReceived handler
export const startDownload  = (url: string, gameTitle?: string) => sendCommand('START_DOWNLOAD', { url, gameTitle });
export const launchGame     = (gameTitle: string) => sendCommand('LAUNCH_GAME', { gameTitle });
export const pauseDownload  = () => sendCommand('PAUSE_DOWNLOAD');
export const resumeDownload = () => sendCommand('RESUME_DOWNLOAD');
export const cancelDownload = () => sendCommand('CANCEL_DOWNLOAD');

// ── Listen for messages from C# ──────────────────────────────

/**
 * Subscribes to messages sent from C# via PostWebMessageAsJson.
 * Returns an unsubscribe function for cleanup in useEffect.
 */
export function onWebViewMessage(callback: (msg: WebViewMessage) => void): () => void {
  const handler = (event: MessageEvent) => {
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data?.type) {
        callback(data as WebViewMessage);
      }
    } catch {
      // Ignore non-JSON messages (e.g. from browser extensions)
    }
  };

  window.chrome?.webview?.addEventListener('message', handler);

  // Return cleanup function
  return () => {
    window.chrome?.webview?.removeEventListener('message', handler);
  };
}

// ── Utility: format bytes to human-readable string ───────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '— MB/s';
  return `${formatBytes(bytesPerSecond)}/s`;
}
