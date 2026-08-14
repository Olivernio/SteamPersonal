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
  filesCompleted: number; // number of files fully extracted so far
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

export interface SavegameBackupResultMessage {
  type: 'SAVEGAME_BACKUP_RESULT';
  gameKey: string;
  success: boolean;
  message: string;
  sizeBytes: number;
  timestamp: string;
  uploadedToCloud: boolean;
}

export interface SavegameRestoreResultMessage {
  type: 'SAVEGAME_RESTORE_RESULT';
  gameKey: string;
  success: boolean;
  message: string;
}

export interface SavegameInfoResultMessage {
  type: 'SAVEGAME_INFO_RESULT';
  gameKey: string;
  exists: boolean;
  sizeBytes: number;
  updatedAt: string;
  resolvedPath: string;
}

export interface AchievementUnlockedMessage {
  type: 'ACHIEVEMENT_UNLOCKED';
  gameKey: string;
  appId: number;
  achievement: {
    apiName: string;
    displayName: string;
    description: string;
    iconUrl: string;
    iconGrayUrl: string;
    unlocked: boolean;
    unlockTime?: string;
  };
}

export interface AchievementsDataResultMessage {
  type: 'ACHIEVEMENTS_DATA_RESULT';
  gameKey: string;
  appId: number;
  found: boolean;
  unlockedCount: number;
  totalCount: number;
  achievements: {
    apiName: string;
    displayName: string;
    description: string;
    iconUrl: string;
    iconGrayUrl: string;
    unlocked: boolean;
    unlockTime?: string;
  }[];
}

export interface InstallationInfo {
  isInstalled: boolean;
  installedVersions: string[];
  primaryVersion: string;
  paths?: Record<string, string>;
}

export interface InstallationStatusMessage {
  type: 'INSTALLATION_STATUS';
  installedMap: Record<string, string>;
  installations?: Record<string, InstallationInfo>;
}

export type WebViewMessage =
  | DownloadProgressMessage
  | DownloadCompletedMessage
  | DownloadFailedMessage
  | GameStartedMessage
  | GameExitedMessage
  | LaunchFailedMessage
  | SavegameBackupResultMessage
  | SavegameRestoreResultMessage
  | SavegameInfoResultMessage
  | AchievementUnlockedMessage
  | AchievementsDataResultMessage
  | InstallationStatusMessage;

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
export const startDownload  = (url: string, gameTitle?: string, version?: string) => sendCommand('START_DOWNLOAD', { url, gameTitle, version });
export const launchGame     = (gameTitle: string, version?: string, gamePath?: string, appId?: number, gameKey?: string, savePattern?: string) => sendCommand('LAUNCH_GAME', { gameTitle, version, gamePath, appId, gameKey, savePattern });
export const pauseDownload  = () => sendCommand('PAUSE_DOWNLOAD');
export const resumeDownload = () => sendCommand('RESUME_DOWNLOAD');
export const cancelDownload = () => sendCommand('CANCEL_DOWNLOAD');
export const getAchievements = (appId?: number, gameKey?: string, gameTitle?: string, savePattern?: string, gamePath?: string) => sendCommand('GET_ACHIEVEMENTS', { appId, gameKey, gameTitle, savePattern, gamePath });

export const minimizeWindow = () => sendCommand('MINIMIZE_WINDOW');
export const maximizeWindow = () => sendCommand('MAXIMIZE_WINDOW');
export const closeWindow    = () => sendCommand('CLOSE_WINDOW');
export const dragWindow     = () => sendCommand('DRAG_WINDOW');

export const backupSavegame  = (gameTitle: string, gameKey: string, savePattern: string) => sendCommand('BACKUP_SAVEGAME', { gameTitle, gameKey, savePattern });
export const restoreSavegame = (gameTitle: string, gameKey: string, savePattern: string) => sendCommand('RESTORE_SAVEGAME', { gameTitle, gameKey, savePattern });
export const getSavegameInfo = (gameKey: string, savePattern: string) => sendCommand('GET_SAVEGAME_INFO', { gameKey, savePattern });

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
