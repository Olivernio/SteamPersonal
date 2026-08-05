import { useState, useMemo } from 'react';
import { Search, Play, Download, MessageSquare, Clock, ChevronDown, Filter } from 'lucide-react';
import { Game, GAMES, GameStatus } from '../data/games';

type FilterType = 'all' | 'installed' | 'outdated';

interface LibraryViewProps {
  onGameSelect: (game: Game) => void;
  games: Game[];
  onRequestUpdate: (gameId: number) => void;
  onStartDownload?: (game: Game) => void;
}

function StatusBadge({ status, current, latest }: { status: GameStatus; current: string; latest: string }) {
  if (status === 'updated') {
    return (
      <div
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md flex items-center gap-1"
        style={{
          background: 'rgba(16,185,129,0.9)',
          backdropFilter: 'blur(8px)',
          fontSize: '9px',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.02em',
        }}
      >
        <div className="w-1 h-1 rounded-full bg-white opacity-80" />
        {current} · Actualizado
      </div>
    );
  }
  if (status === 'update_available') {
    return (
      <div
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md"
        style={{
          background: 'rgba(234,179,8,0.9)',
          backdropFilter: 'blur(8px)',
          fontSize: '9px',
          fontWeight: 700,
          color: '#000',
          letterSpacing: '0.02em',
        }}
      >
        {current} → {latest}
      </div>
    );
  }
  return (
    <div
      className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md"
      style={{
        background: 'rgba(249,115,22,0.9)',
        backdropFilter: 'blur(8px)',
        fontSize: '9px',
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '0.02em',
      }}
    >
      {current} · Sin update
    </div>
  );
}

function GameCard({ game, onSelect, onRequestUpdate, onStartDownload }: { game: Game; onSelect: () => void; onRequestUpdate: () => void; onStartDownload?: () => void }) {
  const [hovered, setHovered] = useState(false);

  const actionButton = () => {
    if (game.status === 'updated') {
      return (
        <button
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all duration-200"
          style={{ background: 'rgba(16,185,129,0.85)', color: '#fff', fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em' }}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <Play size={12} fill="currentColor" />
          JUGAR
        </button>
      );
    }
    if (game.status === 'update_available') {
      return (
        <button
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all duration-200"
          style={{ background: 'rgba(59,130,246,0.85)', color: '#fff', fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em' }}
          onClick={(e) => { e.stopPropagation(); onStartDownload ? onStartDownload() : onSelect(); }}
        >
          <Download size={12} />
          ACTUALIZAR A {game.latestVersion}
        </button>
      );
    }
    return (
      <button
        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all duration-200"
        style={{ background: 'rgba(249,115,22,0.85)', color: '#fff', fontSize: '12px', fontWeight: 700, letterSpacing: '0.03em' }}
        onClick={(e) => { e.stopPropagation(); onRequestUpdate(); }}
      >
        <MessageSquare size={12} />
        SOLICITAR UPDATE
      </button>
    );
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden cursor-pointer group transition-all duration-300"
      style={{
        backgroundColor: '#151922',
        border: hovered ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)',
        transform: hovered ? 'translateY(-4px) scale(1.02)' : 'translateY(0) scale(1)',
        boxShadow: hovered ? '0 16px 40px rgba(0,0,0,0.6), 0 0 20px rgba(99,102,241,0.15)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      {/* Cover image */}
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={game.cover}
          alt={game.title}
          className="w-full h-full object-cover transition-transform duration-500"
          style={{ transform: hovered ? 'scale(1.08)' : 'scale(1)' }}
        />
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(10,14,20,0.95) 0%, rgba(10,14,20,0.2) 40%, transparent 70%)' }}
        />

        {/* Status badge */}
        <StatusBadge status={game.status} current={game.currentVersion} latest={game.latestVersion} />

        {/* Genre badge */}
        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-md"
          style={{
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '9px',
            fontWeight: 500,
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {game.genre}
        </div>

        {/* Action button overlay on hover */}
        <div
          className="absolute bottom-0 left-0 right-0 p-2 transition-all duration-300"
          style={{
            opacity: hovered ? 1 : 0,
            transform: hovered ? 'translateY(0)' : 'translateY(8px)',
          }}
        >
          {actionButton()}
        </div>
      </div>

      {/* Card footer */}
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-1 mb-1">
          <h3 style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600, lineHeight: 1.3 }}>{game.title}</h3>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>{game.developer}</span>
          <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
            <Clock size={9} />
            <span>{game.hoursPlayed.toFixed(1)} hrs</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LibraryView({ onGameSelect, games, onRequestUpdate, onStartDownload }: LibraryViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortOpen, setSortOpen] = useState(false);

  const filteredGames = useMemo(() => {
    return games.filter((g) => {
      const matchSearch = g.title.toLowerCase().includes(search.toLowerCase()) ||
        g.developer.toLowerCase().includes(search.toLowerCase());
      const matchFilter =
        filter === 'all' ||
        (filter === 'installed' && g.status === 'updated') ||
        (filter === 'outdated' && (g.status === 'update_available' || g.status === 'outdated'));
      return matchSearch && matchFilter;
    });
  }, [games, search, filter]);

  const counts = useMemo(() => ({
    all: games.length,
    installed: games.filter((g) => g.status === 'updated').length,
    outdated: games.filter((g) => g.status !== 'updated').length,
  }), [games]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center gap-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex-1">
          <h1 style={{ color: '#E2E8F0', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Mi Biblioteca
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>{games.length} juegos instalados</p>
        </div>

        {/* Search */}
        <div
          className="relative flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            width: '240px',
          }}
        >
          <Search size={14} style={{ color: 'rgba(255,255,255,0.35)', shrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar juegos..."
            className="bg-transparent border-none outline-none flex-1"
            style={{ color: '#E2E8F0', fontSize: '13px' }}
          />
        </div>

        {/* Sort */}
        <div className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200"
            style={{
              backgroundColor: sortOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '12px',
            }}
          >
            <Filter size={13} />
            Ordenar
            <ChevronDown size={12} style={{ transform: sortOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="px-6 py-3 flex items-center gap-2 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {([
          { key: 'all', label: 'Todos', count: counts.all },
          { key: 'installed', label: 'Instalados', count: counts.installed },
          { key: 'outdated', label: 'Desactualizados', count: counts.outdated },
        ] as { key: FilterType; label: string; count: number }[]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{
              backgroundColor: filter === tab.key ? 'rgba(99,102,241,0.2)' : 'transparent',
              border: filter === tab.key ? '1px solid rgba(99,102,241,0.35)' : '1px solid transparent',
              color: filter === tab.key ? '#A5B4FC' : 'rgba(255,255,255,0.4)',
              fontSize: '12px',
              fontWeight: filter === tab.key ? 600 : 400,
            }}
          >
            {tab.label}
            <span
              className="px-1.5 py-0.5 rounded-md"
              style={{
                backgroundColor: filter === tab.key ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)',
                color: filter === tab.key ? '#C7D2FE' : 'rgba(255,255,255,0.35)',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {tab.count}
            </span>
          </button>
        ))}

        {search && (
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', marginLeft: 'auto' }}>
            {filteredGames.length} resultado{filteredGames.length !== 1 ? 's' : ''} para "{search}"
          </span>
        )}
      </div>

      {/* Game grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '48px' }}>🎮</div>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>No se encontraron juegos</p>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}
          >
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                onSelect={() => onGameSelect(game)}
                onRequestUpdate={() => onRequestUpdate(game.id)}
                onStartDownload={onStartDownload ? () => onStartDownload(game) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.3); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}
