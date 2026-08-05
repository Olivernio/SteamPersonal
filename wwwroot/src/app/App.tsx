import { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import { WindowHeader } from './components/WindowHeader';
import { Sidebar, View } from './components/Sidebar';
import { LibraryView } from './components/LibraryView';
import { GameDetailView } from './components/GameDetailView';
import { DownloadsView, DownloadState } from './components/DownloadsView';
import { SettingsView } from './components/SettingsView';
import { ExploreView } from './components/ExploreView';
import { Game, GAMES } from './data/games';
import { onWebViewMessage, WebViewMessage, startDownload, launchGame } from './webview-bridge';

// ── Download state reducer ─────────────────────────────────────

type DownloadAction =
  | { type: 'PROGRESS'; payload: { progress: number; downloaded: number; total: number; speed: number; file: string; status: string; filesCompleted: number; gameTitle?: string } }
  | { type: 'COMPLETED' }
  | { type: 'FAILED'; error: string }
  | { type: 'SET_CANCELLED'; value: boolean }
  | { type: 'RESET' };

function downloadReducer(state: DownloadState | null, action: DownloadAction): DownloadState | null {
  switch (action.type) {
    case 'PROGRESS':
      return {
        progress: action.payload.progress,
        downloadedBytes: action.payload.downloaded,
        totalBytes: action.payload.total,
        speed: action.payload.speed,
        currentFile: action.payload.file,
        status: action.payload.status,
        filesCompleted: action.payload.filesCompleted,
        gameTitle: action.payload.gameTitle ?? state?.gameTitle ?? 'Descarga Activa',
        completed: false,
        cancelled: false,
      };
    case 'COMPLETED':
      return state ? { ...state, completed: true, status: 'Completado', speed: 0 } : null;
    case 'FAILED':
      return state ? { ...state, status: `Error: ${action.error}`, speed: 0 } : null;
    case 'SET_CANCELLED':
      return state ? { ...state, cancelled: action.value, speed: 0 } : null;
    case 'RESET':
      return null;
    default:
      return state;
  }
}

// ── Main App Component ─────────────────────────────────────────

export default function App() {
  const [view, setView] = useState<View>('library');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [games, setGames] = useState<Game[]>(GAMES);
  const [syncing, setSyncing] = useState(false);
  const [downloadState, dispatchDownload] = useReducer(downloadReducer, null);

  const downloadStateRef = useRef(downloadState);
  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  // ── WebView2 message listener ──────────────────────────────
  useEffect(() => {
    const unsubscribe = onWebViewMessage((msg: WebViewMessage) => {
      switch (msg.type) {
        case 'DOWNLOAD_PROGRESS':
          dispatchDownload({
            type: 'PROGRESS',
            payload: {
              progress: msg.progress,
              downloaded: msg.downloaded,
              total: msg.total,
              speed: msg.speed,
              file: msg.file,
              status: msg.status,
              filesCompleted: msg.filesCompleted ?? 0,
              gameTitle: msg.gameTitle,
            },
          });
          break;
        case 'DOWNLOAD_COMPLETED':
          dispatchDownload({ type: 'COMPLETED' });
          const currentTitle = downloadStateRef.current?.gameTitle;
          if (currentTitle) {
            setGames((prev) =>
              prev.map((g) => (g.title === currentTitle ? { ...g, status: 'updated' } : g))
            );
          }
          break;
        case 'DOWNLOAD_FAILED':
          dispatchDownload({ type: 'FAILED', error: msg.error });
          break;
        case 'GAME_EXITED':
          if (msg.sessionMinutes > 0) {
            const addedHours = msg.sessionMinutes / 60;
            setGames((prev) =>
              prev.map((g) =>
                g.title === msg.gameTitle ? { ...g, hoursPlayed: g.hoursPlayed + addedHours } : g
              )
            );
          }
          break;
        case 'LAUNCH_FAILED':
          alert(`No se pudo iniciar el juego: ${msg.error}`);
          break;
      }
    });

    return unsubscribe;
  }, []);

  const handleSync = useCallback(() => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2200);
  }, []);

  const handleViewChange = useCallback((v: View) => {
    setView(v);
    setSelectedGame(null);
  }, []);

  const handleGameSelect = useCallback((game: Game) => {
    setSelectedGame(game);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedGame(null);
  }, []);

  const handleRequestUpdate = useCallback((gameId: number) => {
    setGames((prev) =>
      prev.map((g) => (g.id === gameId ? { ...g, requestCount: g.requestCount + 1 } : g))
    );
  }, []);

  const handleStartDownload = useCallback((game: Game, customUrl?: string) => {
    const targetUrl = customUrl || game.downloadUrl || 'https://drive.google.com/file/d/1BziDPAqWT5N5jV-5A2nB3d2Z5g7_wKk3/view';
    
    // Trigger C# download via WebView2 bridge
    startDownload(targetUrl, game.title);

    // Initialize state immediately in UI for instant responsiveness
    dispatchDownload({
      type: 'PROGRESS',
      payload: {
        progress: 0,
        downloaded: 0,
        total: 0,
        speed: 0,
        file: '',
        status: 'Conectando al servidor...',
        filesCompleted: 0,
        gameTitle: game.title,
      },
    });

    // Switch to active downloads tab
    setView('downloads');
    setSelectedGame(null);
  }, []);

  const handleLaunchGame = useCallback((gameTitle: string) => {
    launchGame(gameTitle);
  }, []);

  // Active download count for the sidebar badge
  const activeDownloadCount = downloadState && !downloadState.completed && !downloadState.cancelled ? 1 : 0;

  const renderContent = () => {
    if (selectedGame) {
      return (
        <GameDetailView
          game={selectedGame}
          onBack={handleBack}
          onRequestUpdate={handleRequestUpdate}
          onStartDownload={handleStartDownload}
          onLaunchGame={handleLaunchGame}
        />
      );
    }
    switch (view) {
      case 'library':
        return (
          <LibraryView
            games={games}
            onGameSelect={handleGameSelect}
            onRequestUpdate={handleRequestUpdate}
            onStartDownload={handleStartDownload}
            onLaunchGame={handleLaunchGame}
          />
        );
      case 'explore':
        return <ExploreView />;
      case 'downloads':
        return (
          <DownloadsView
            download={downloadState}
            onCancel={() => dispatchDownload({ type: 'SET_CANCELLED', value: true })}
            onReset={() => dispatchDownload({ type: 'RESET' })}
            onLaunchGame={handleLaunchGame}
          />
        );
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div
      className="flex flex-col size-full overflow-hidden"
      style={{
        backgroundColor: '#0B0E14',
        fontFamily: '"Inter", "system-ui", -apple-system, sans-serif',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      {/* Custom title bar */}
      <WindowHeader onSync={handleSync} syncing={syncing} />

      {/* App body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <Sidebar
          activeView={view}
          onViewChange={handleViewChange}
          downloadCount={activeDownloadCount}
          onSync={handleSync}
          syncing={syncing}
        />

        {/* Main content */}
        <main className="flex-1 min-w-0 overflow-hidden" style={{ backgroundColor: '#0B0E14' }}>
          {renderContent()}
        </main>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
        }
        ::selection {
          background: rgba(99,102,241,0.3);
          color: #E2E8F0;
        }
      `}</style>
    </div>
  );
}
