import { useState } from 'react';
import { ArrowLeft, Play, Download, MessageSquare, Gamepad2, Calendar, HardDrive, ChevronDown, Monitor, Clock, Star, Package } from 'lucide-react';
import { Game } from '../data/games';

interface GameDetailViewProps {
  game: Game;
  onBack: () => void;
  onRequestUpdate: (gameId: number) => void;
  onStartDownload?: (game: Game) => void;
  onLaunchGame?: (gameTitle: string) => void;
}

export function GameDetailView({ game, onBack, onRequestUpdate, onStartDownload, onLaunchGame }: GameDetailViewProps) {
  const [selectedVersion, setSelectedVersion] = useState(game.currentVersion);
  const [versionOpen, setVersionOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestCount, setRequestCount] = useState(game.requestCount);
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  const handleRequestUpdate = () => {
    if (!requestSent) {
      setRequestSent(true);
      setRequestCount((c) => c + 1);
      onRequestUpdate(game.id);
    }
  };

  const versions = [
    { label: `${game.currentVersion} (Instalada)`, value: game.currentVersion },
    { label: `${game.latestVersion} (Más reciente)`, value: game.latestVersion },
    { label: 'v2.0 (Legado)', value: 'v2.0' },
  ];

  const ActionPanel = () => {
    if (game.status === 'updated') {
      return (
        <div className="space-y-3">
          <button
            onClick={() => onLaunchGame?.(game.title)}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl transition-all duration-200 group"
            style={{
              background: 'linear-gradient(135deg, #059669, #10B981)',
              boxShadow: '0 8px 24px rgba(16,185,129,0.4)',
              fontSize: '16px',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            <Play size={20} fill="currentColor" />
            JUGAR
          </button>
          <div
            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              <Clock size={13} />
              <span>Tiempo jugado</span>
            </div>
            <span style={{ color: '#10B981', fontSize: '14px', fontWeight: 700 }}>{game.hoursPlayed.toFixed(1)} hrs</span>
          </div>
        </div>
      );
    }

    if (game.status === 'update_available') {
      return (
        <div className="space-y-3">
          <button
            onClick={() => onStartDownload?.(game)}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl transition-all duration-200"
            style={{
              background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
              boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
              fontSize: '16px',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.04em',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          >
            <Download size={20} />
            ACTUALIZAR A {game.latestVersion}
          </button>
          <button
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <Play size={14} fill="currentColor" />
            Jugar versión actual ({game.currentVersion})
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.2)' }}
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#EAB308' }} />
            <span style={{ color: 'rgba(234,179,8,0.9)', fontSize: '11px' }}>
              Nueva versión disponible: {game.latestVersion}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div
          className="px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#F97316' }} />
            <span style={{ color: '#F97316', fontSize: '12px', fontWeight: 600 }}>
              Existe la {game.latestVersion} oficial
            </span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
            El enlace de descarga aún no ha sido subido al servidor.
          </p>
        </div>
        <button
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl transition-all duration-300"
          style={{
            background: requestSent
              ? 'rgba(99,102,241,0.15)'
              : 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            border: requestSent ? '1px solid rgba(99,102,241,0.3)' : 'none',
            boxShadow: requestSent ? 'none' : '0 8px 24px rgba(99,102,241,0.35)',
            fontSize: '14px',
            fontWeight: 700,
            color: requestSent ? '#A5B4FC' : '#fff',
            letterSpacing: '0.03em',
            cursor: requestSent ? 'default' : 'pointer',
          }}
          onClick={handleRequestUpdate}
          disabled={requestSent}
        >
          <MessageSquare size={17} />
          {requestSent ? '✓ ¡Solicitud enviada!' : `📩 SOLICITAR UPDATE (${requestCount} peticiones)`}
        </button>
        <button
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '13px',
          }}
        >
          <Play size={13} fill="currentColor" />
          Jugar versión desactualizada ({game.currentVersion})
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#0B0E14' }}>
      {/* Hero Banner */}
      <div className="relative shrink-0 overflow-hidden" style={{ height: '280px' }}>
        <img
          src={game.banner}
          alt={game.title}
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.55) saturate(1.2)', transform: 'scale(1.05)' }}
        />
        {/* Overlay gradients */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(11,14,20,0.9) 0%, rgba(11,14,20,0.3) 60%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(11,14,20,1) 0%, transparent 50%)' }}
        />

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200"
          style={{
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)',
            fontSize: '12px',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.7)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.5)'; }}
        >
          <ArrowLeft size={14} />
          Biblioteca
        </button>

        {/* Game title in hero */}
        <div className="absolute bottom-6 left-6">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="px-2 py-0.5 rounded-md"
              style={{ background: 'rgba(99,102,241,0.8)', color: '#fff', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}
            >
              {game.genre.toUpperCase()}
            </span>
            {game.controllerSupport && (
              <span
                className="px-2 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}
              >
                <Gamepad2 size={9} /> Mando
              </span>
            )}
          </div>
          <h1 style={{ color: '#fff', fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', textShadow: '0 2px 20px rgba(0,0,0,0.8)' }}>
            {game.title}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '4px' }}>{game.developer} · {game.publisher}</p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-6 p-6">
          {/* Left column - main content */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Description */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', lineHeight: 1.7 }}>{game.description}</p>
            </div>

            {/* Metadata grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Calendar, label: 'Lanzamiento', value: new Date(game.releaseDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) },
                { icon: HardDrive, label: 'Tamaño', value: game.size },
                { icon: Clock, label: 'Horas jugadas', value: `${game.hoursPlayed.toFixed(1)} hrs` },
                { icon: Package, label: 'DLCs incluidos', value: `${game.dlcs.length} packs` },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(99,102,241,0.15)' }}
                  >
                    <item.icon size={15} style={{ color: '#818CF8' }} />
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 500 }}>{item.label}</div>
                    <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>{item.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* DLC badges */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <h3 style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600, marginBottom: '10px' }}>DLCs Incluidos</h3>
              <div className="flex flex-wrap gap-2">
                {game.dlcs.map((dlc) => (
                  <span
                    key={dlc}
                    className="px-2.5 py-1 rounded-lg"
                    style={{
                      background: 'rgba(99,102,241,0.12)',
                      border: '1px solid rgba(99,102,241,0.25)',
                      color: '#A5B4FC',
                      fontSize: '11px',
                      fontWeight: 500,
                    }}
                  >
                    {dlc}
                  </span>
                ))}
              </div>
            </div>

            {/* System Requirements */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Monitor size={14} style={{ color: '#818CF8' }} />
                <h3 style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>Requisitos del Sistema</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.05em' }}>MÍNIMOS</div>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', lineHeight: 1.7 }}>{game.requirements.min}</p>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '12px' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, marginBottom: '4px', letterSpacing: '0.05em' }}>RECOMENDADOS</div>
                  <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '11px', lineHeight: 1.7 }}>{game.requirements.rec}</p>
                </div>
              </div>
            </div>

            {/* Screenshots */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <h3 style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>Capturas de Pantalla</h3>
              <div className="relative rounded-xl overflow-hidden mb-2" style={{ aspectRatio: '16/9' }}>
                <img
                  src={game.screenshots[activeScreenshot]}
                  alt="screenshot"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                {game.screenshots.map((ss, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveScreenshot(i)}
                    className="rounded-lg overflow-hidden transition-all duration-200"
                    style={{
                      width: '80px',
                      aspectRatio: '16/9',
                      border: i === activeScreenshot ? '2px solid #6366F1' : '2px solid transparent',
                      opacity: i === activeScreenshot ? 1 : 0.5,
                    }}
                  >
                    <img src={ss} alt={`screenshot-${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            {/* Changelog */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} style={{ color: '#818CF8' }} />
                <h3 style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>Notas de Parche</h3>
              </div>
              <div className="space-y-4">
                {game.changelog.map((entry) => (
                  <div key={entry.version}>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', fontSize: '11px', fontWeight: 700 }}
                      >
                        {entry.version}
                      </span>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{entry.date}</span>
                    </div>
                    <ul className="space-y-1.5 pl-3">
                      {entry.notes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <div className="w-1 h-1 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: '#6366F1' }} />
                          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel - actions */}
          <div className="w-72 shrink-0 space-y-4">
            {/* Version selector */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                VERSIÓN SELECCIONADA
              </label>
              <div className="relative">
                <button
                  onClick={() => setVersionOpen(!versionOpen)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    border: versionOpen ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)',
                    color: '#E2E8F0',
                    fontSize: '13px',
                  }}
                >
                  <span>{selectedVersion}</span>
                  <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)', transform: versionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {versionOpen && (
                  <div
                    className="absolute top-full left-0 right-0 mt-1 py-1 rounded-xl z-10"
                    style={{
                      backgroundColor: '#1E2532',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}
                  >
                    {versions.map((v) => (
                      <button
                        key={v.value}
                        className="w-full text-left px-3 py-2 transition-all duration-150"
                        style={{
                          color: selectedVersion === v.value ? '#A5B4FC' : 'rgba(255,255,255,0.6)',
                          fontSize: '12px',
                          backgroundColor: selectedVersion === v.value ? 'rgba(99,102,241,0.15)' : 'transparent',
                        }}
                        onClick={() => { setSelectedVersion(v.value); setVersionOpen(false); }}
                        onMouseEnter={(e) => { if (selectedVersion !== v.value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                        onMouseLeave={(e) => { if (selectedVersion !== v.value) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Action panel */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <ActionPanel />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
