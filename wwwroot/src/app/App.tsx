import { useState, useCallback } from 'react';
import { WindowHeader } from './components/WindowHeader';
import { Sidebar, View } from './components/Sidebar';
import { LibraryView } from './components/LibraryView';
import { GameDetailView } from './components/GameDetailView';
import { DownloadsView } from './components/DownloadsView';
import { SettingsView } from './components/SettingsView';
import { ExploreView } from './components/ExploreView';
import { Game, GAMES } from './data/games';

export default function App() {
  const [view, setView] = useState<View>('library');
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [games, setGames] = useState<Game[]>(GAMES);
  const [syncing, setSyncing] = useState(false);

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

  const renderContent = () => {
    if (selectedGame) {
      return (
        <GameDetailView
          game={selectedGame}
          onBack={handleBack}
          onRequestUpdate={handleRequestUpdate}
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
          />
        );
      case 'explore':
        return <ExploreView />;
      case 'downloads':
        return <DownloadsView />;
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
          downloadCount={1}
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
