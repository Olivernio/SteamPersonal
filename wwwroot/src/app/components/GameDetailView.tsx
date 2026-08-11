import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Download, MessageSquare, Gamepad2, Calendar, HardDrive, ChevronDown, Monitor, Clock, Star, Package, Cloud, Settings, Info, Heart, Award, Building2, Megaphone, Upload, RefreshCw, X, FolderCheck } from 'lucide-react';
import { Game } from '../data/games';
import { backupSavegame, restoreSavegame, getSavegameInfo, getAchievements, onWebViewMessage, formatBytes, WebViewMessage } from '../webview-bridge';
import { requestGameUpdate, requestSpecificVersion } from '../services/supabaseClient';
import { DynamicBackground } from './DynamicBackground';

interface GameDetailViewProps {
  game: Game;
  onBack: () => void;
  onRequestUpdate: (gameId: number) => void;
  onStartDownload?: (game: Game) => void;
  onLaunchGame?: (gameTitle: string) => void;
}

const ExpandableText = ({ text, lines = 3 }: { text: string, lines?: number }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  if (text.length <= 150) {
    return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</div>;
  }
  return (
    <div className="flex flex-col items-start gap-1 w-full">
      <div 
        style={{ 
          display: expanded ? 'block' : '-webkit-box',
          WebkitLineClamp: expanded ? 'unset' : lines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {text}
      </div>
      <button 
        onClick={() => setExpanded(!expanded)}
        className="text-xs font-semibold hover:underline mt-1"
        style={{ color: '#818CF8' }}
      >
        {expanded ? 'Mostrar menos' : 'Leer más...'}
      </button>
    </div>
  );
};

export function GameDetailView({ game, onBack, onRequestUpdate, onStartDownload, onLaunchGame }: GameDetailViewProps) {
  const [selectedVersion, setSelectedVersion] = useState(game.currentVersion);
  const [versionOpen, setVersionOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestCount, setRequestCount] = useState(game.requestCount);
  const [activeScreenshot, setActiveScreenshot] = useState(0);
  const [subTab, setSubTab] = useState<'details' | 'dlcs' | 'achievements' | 'mods' | 'versions'>('details');
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [cloudModalOpen, setCloudModalOpen] = useState(false);
  const [savegameInfo, setSavegameInfo] = useState<{ exists: boolean; sizeBytes: number; updatedAt: string; resolvedPath: string } | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [savegameStatusMsg, setSavegameStatusMsg] = useState<string | null>(null);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [requestVersionTarget, setRequestVersionTarget] = useState<string>('');
  const [requestCustomMessage, setRequestCustomMessage] = useState<string>('');
  const [submittingVersionReq, setSubmittingVersionReq] = useState(false);
  const [requestedVersionsMap, setRequestedVersionsMap] = useState<Record<string, boolean>>({});

  const [showBuildId, setShowBuildId] = useState(false);
  const [enableDynamicBackgrounds, setEnableDynamicBackgrounds] = useState(true);
  const [bgImageDurationMs, setBgImageDurationMs] = useState(10000);
  const [bgFadeDurationMs, setBgFadeDurationMs] = useState(5000);
  const [bgSettingsModalOpen, setBgSettingsModalOpen] = useState(false);

  const [achievementsState, setAchievementsState] = useState<{
    loading: boolean;
    found: boolean;
    unlockedCount: number;
    totalCount: number;
    list: Array<{
      apiName: string;
      displayName: string;
      description: string;
      iconUrl: string;
      iconGrayUrl: string;
      unlocked: boolean;
      unlockTime?: string;
    }>;
  }>({
    loading: true,
    found: false,
    unlockedCount: 0,
    totalCount: 0,
    list: []
  });

  const gameKey = game.gameKey || game.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  const savePattern = game.savePathPattern || `%APPDATA%/${game.title}`;

  useEffect(() => {
    const appIdToUse = game.steamAppId || (game as any).appId || 0;
    // Initial fetch of savegame info and achievements from C#
    getSavegameInfo(gameKey, savePattern);
    getAchievements(appIdToUse, gameKey, game.title, undefined, (game as any).gamePath);

    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({ action: "GET_SETTINGS" });
    }

    const unsubscribe = onWebViewMessage((msg: WebViewMessage) => {
      if (msg.type === 'SETTINGS_LOADED') {
        setShowBuildId(msg.settings?.showBuildId || false);
        setEnableDynamicBackgrounds(msg.settings?.enableDynamicBackgrounds ?? true);
        setBgImageDurationMs(msg.settings?.bgImageDurationMs ?? 10000);
        setBgFadeDurationMs(msg.settings?.bgFadeDurationMs ?? 5000);
      } else if (msg.type === 'ACHIEVEMENTS_DATA_RESULT' && (msg.gameKey === gameKey || msg.appId === appIdToUse)) {
        setAchievementsState({
          loading: false,
          found: msg.found,
          unlockedCount: msg.unlockedCount,
          totalCount: msg.totalCount,
          list: msg.achievements || []
        });
      } else if (msg.type === 'ACHIEVEMENT_UNLOCKED' && (msg.gameKey === gameKey || msg.appId === game.appId)) {
        setAchievementsState((prev) => {
          const updatedList = prev.list.map((ach) =>
            ach.apiName.toLowerCase() === msg.achievement.apiName.toLowerCase()
              ? { ...ach, unlocked: true, unlockTime: msg.achievement.unlockTime }
              : ach
          );
          const isNewUnlock = !prev.list.some((a) => a.apiName.toLowerCase() === msg.achievement.apiName.toLowerCase() && a.unlocked);
          return {
            ...prev,
            unlockedCount: isNewUnlock ? prev.unlockedCount + 1 : prev.unlockedCount,
            list: updatedList
          };
        });
      } else if (msg.type === 'SAVEGAME_INFO_RESULT' && msg.gameKey === gameKey) {
        setSavegameInfo({
          exists: msg.exists,
          sizeBytes: msg.sizeBytes,
          updatedAt: msg.updatedAt,
          resolvedPath: msg.resolvedPath
        });
      } else if (msg.type === 'SAVEGAME_BACKUP_RESULT' && msg.gameKey === gameKey) {
        setBackingUp(false);
        setSavegameStatusMsg(msg.message);
        if (msg.success) {
          setSavegameInfo((prev) => ({
            exists: true,
            sizeBytes: msg.sizeBytes,
            updatedAt: msg.timestamp,
            resolvedPath: prev?.resolvedPath || ''
          }));
        }
      } else if (msg.type === 'SAVEGAME_RESTORE_RESULT' && msg.gameKey === gameKey) {
        setRestoring(false);
        setSavegameStatusMsg(msg.message);
      }
    });

    return () => unsubscribe();
  }, [gameKey, savePattern, game.appId, game.title]);

  const handleBackup = () => {
    setBackingUp(true);
    setSavegameStatusMsg('Comprimiendo y respaldando partida en Oracle Cloud...');
    backupSavegame(game.title, gameKey, savePattern);
  };

  const handleRestore = () => {
    setRestoring(true);
    setSavegameStatusMsg('Descargando y desempacando última partida desde Oracle Cloud...');
    restoreSavegame(game.title, gameKey, savePattern);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setIsScrolled(e.currentTarget.scrollTop >= 400);
  };

  const handleRequestUpdate = async () => {
    if (!requestSent) {
      setRequestSent(true);
      setRequestCount((c) => c + 1);
      onRequestUpdate(game.id);
      if (game.uuid) {
        await requestGameUpdate(game.uuid, requestCount);
      }
    }
  };

  const handleSendVersionRequest = async () => {
    if (!requestVersionTarget || !game.uuid) return;
    setSubmittingVersionReq(true);
    const success = await requestSpecificVersion(game.uuid, requestVersionTarget, requestCustomMessage);
    setSubmittingVersionReq(false);
    if (success) {
      setRequestedVersionsMap(prev => ({ ...prev, [requestVersionTarget]: true }));
      setRequestModalOpen(false);
      setRequestCustomMessage('');
    }
  };

  const availableVersionsList = game.availableVersions && game.availableVersions.length > 0
    ? game.availableVersions.map(v => {
        const buildStr = showBuildId && v.notes ? ` (Build ${v.notes})` : '';
        return {
          label: `${v.version}${buildStr}${v.releaseDate ? ` - ${v.releaseDate}` : ''}`,
          value: v.version,
          url: v.url
        };
      })
    : [
        { label: `${game.currentVersion} (Instalada)`, value: game.currentVersion, url: game.downloadUrl },
        { label: `${game.latestVersion} (Servidor)`, value: game.latestVersion, url: game.downloadUrl },
      ];

  const unifiedVersionsList = (() => {
    const map = new Map<string, {
      version: string;
      date?: string;
      notes?: string[];
      downloadUrl?: string;
      isAvailable: boolean;
      buildId?: string;
    }>();

    // Opcionalmente agregar eventos históricos (noticias) a la lista, pero filtrando publicaciones genéricas
    if (showAllVersions && game.changelog && game.changelog.length > 0) {
      game.changelog.forEach(c => {
        // Heurística mejorada: solo versiones reales basadas en el nombre de versión o el TÍTULO de la nota.
        // Evitamos buscar en el cuerpo para no falsos positivos con menciones de otros juegos.
        const versionRegex = /^(v|build|patch|ver)\.*\s*\d/i;
        const titleRegex = /(patch notes|release notes|hotfix|update \d|version \d|ver\.*\s*\d|patch \d)/i;
        
        const isVersionLike = versionRegex.test(c.version) || 
                              (c.notes && c.notes.length > 0 && titleRegex.test(c.notes[0]));
                              
        if (isVersionLike) {
          const vKey = c.version.replace(/^(v|Build\s*)/i, '').trim();
          map.set(vKey, {
            version: c.version,
            date: c.date,
            notes: c.notes,
            isAvailable: false
          });
        }
      });
    }

    // Merge downloadable versions
    if (game.availableVersions && game.availableVersions.length > 0) {
      game.availableVersions.forEach(av => {
        const vKey = av.version.replace(/^(v|Build\s*)/i, '').trim();
        const existing = map.get(vKey);
        map.set(vKey, {
          version: av.version,
          date: av.releaseDate || existing?.date,
          notes: existing?.notes,
          downloadUrl: av.url,
          isAvailable: true,
          buildId: av.notes
        });
      });
    }

    if (map.size === 0) {
      map.set(game.latestVersion, {
        version: game.latestVersion,
        isAvailable: true,
        downloadUrl: game.downloadUrl
      });
    }

    return Array.from(map.values());
  })();

  const versions = availableVersionsList;

  const renderActionPanel = () => {
    return (
      <div className="space-y-4">
        {/* Main Action Area */}
        {game.status === 'updated' ? (
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
          </div>
        ) : game.status === 'update_available' ? (
          <div className="space-y-3">
            <button
              onClick={() => onStartDownload?.(game)}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
                boxShadow: '0 8px 24px rgba(59,130,246,0.4)',
                fontSize: '15px',
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '0.04em',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.02)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            >
              <Download size={18} />
              ACTUALIZAR A {game.latestVersion}
            </button>
            <button
              onClick={() => onLaunchGame?.(game.title)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors hover:bg-white/10"
              style={{
                backgroundColor: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              <Play size={14} fill="currentColor" />
              Jugar versión instalada
            </button>
          </div>
        ) : (
          <div className="space-y-3">
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
              {requestSent ? '✓ Solicitud enviada' : `📩 SOLICITAR UPDATE`}
            </button>
          </div>
        )}

        <div className="h-px w-full my-4" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />

        {/* Versions Info Area */}
        <div className="space-y-2">
          <div className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Versión Instalada</div>
              <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>{game.currentVersion || 'Ninguna'}</div>
            </div>
            {game.status === 'updated' && (
               <div className="px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: '10px', fontWeight: 700 }}>Al Día</div>
            )}
            {game.status === 'update_available' && (
               <div className="px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#EAB308', fontSize: '10px', fontWeight: 700 }}>Desactualizado</div>
            )}
          </div>

          <div className="flex justify-between items-center p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Última de Steam</div>
              <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>{game.latestVersion || 'No disponible'}</div>
            </div>
            <RefreshCw size={12} className="text-gray-500" />
          </div>
        </div>

        {/* Change Version Dropdown */}
        <div className="mt-4 pt-2">
          <label style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
            SELECCIONAR PARA DESCARGAR
          </label>
          <div className="relative">
            <button
              onClick={() => setVersionOpen(!versionOpen)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: versionOpen ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: '#E2E8F0',
                fontSize: '13px',
              }}
            >
              <span className="truncate pr-2 font-medium">{selectedVersion}</span>
              <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.4)', transform: versionOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>
            {versionOpen && (
              <div
                className="absolute top-full left-0 right-0 mt-2 py-1.5 rounded-xl z-20"
                style={{
                  backgroundColor: '#1E2532',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}
              >
                {versions.map((v) => (
                  <button
                    key={v.value}
                    className="w-full text-left px-3 py-2.5 transition-all duration-150 truncate"
                    style={{
                      color: selectedVersion === v.value ? '#A5B4FC' : 'rgba(255,255,255,0.7)',
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
      </div>
    );
  };

  return (
    <div
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto h-full relative"
      style={{ backgroundColor: '#0B0E14' }}
    >
      {/* Hero Banner (Steam Style) */}
      <div className="relative overflow-hidden" style={{ height: '440px' }}>
        <DynamicBackground 
          images={[game.banner, ...(game.screenshots || [])]} 
          enabled={enableDynamicBackgrounds}
          intervalMs={bgImageDurationMs}
          fadeMs={bgFadeDurationMs}
          altText={game.title} 
        />
        {/* Vignette Overlay (Reduced Intensity) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 55%, rgba(11,14,20,0.5) 100%)',
          }}
        />
        {/* Left Dark Gradient (Subtle) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, rgba(11,14,20,0.7) 0%, rgba(11,14,20,0.3) 40%, transparent 75%)',
          }}
        />
        {/* Bottom Fade Gradient */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, #0B0E14 0%, rgba(11,14,20,0.5) 25%, transparent 60%)' }}
        />

        {/* Game title / Logo overlay in Hero (Bigger Logo) */}
        <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between z-10">
          <div className="space-y-2 max-w-3xl">
            {game.logoUrl ? (
              <img
                src={game.logoUrl}
                alt={game.title}
                style={{
                  maxHeight: '230px',
                  maxWidth: '680px',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.95))',
                  display: 'block'
                }}
              />
            ) : (
              <h1 style={{ color: '#fff', fontSize: '44px', fontWeight: 900, letterSpacing: '-0.02em', textShadow: '0 6px 30px rgba(0,0,0,0.95)', margin: 0 }}>
                {game.title}
              </h1>
            )}
          </div>
        </div>
      </div>

      {/* Single Steam Action Bar (Sticky top-0: Transforms on scroll with constant height) */}
      <div
        className="sticky top-0 z-30 px-8 flex items-center justify-between transition-all duration-300 select-none"
        style={{
          height: '64px',
          backgroundColor: isScrolled ? 'rgba(16, 19, 28, 0.95)' : '#161922',
          backdropFilter: isScrolled ? 'blur(12px)' : 'none',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: isScrolled ? '0 8px 32px rgba(0,0,0,0.6)' : '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {isScrolled ? (
          /* Transformed Sticky Layout: [ Button | Larger Icon | Title ] */
          <div className="flex items-center gap-4 min-w-0">
            {/* Primary Action Button */}
            <div className="flex items-center rounded-lg overflow-hidden shrink-0">
              {game.status === 'updated' ? (
                <button
                  onClick={() => onLaunchGame?.(game.title)}
                  className="flex items-center gap-2.5 px-6 py-2.5 transition-all duration-200 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  JUGAR
                </button>
              ) : game.status === 'update_available' ? (
                <button
                  onClick={() => onStartDownload?.(game)}
                  className="flex items-center gap-2.5 px-6 py-2.5 transition-all duration-200 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                  }}
                >
                  <Download size={16} />
                  ACTUALIZAR
                </button>
              ) : (
                <button
                  onClick={handleRequestUpdate}
                  disabled={requestSent}
                  className="flex items-center gap-2.5 px-6 py-2.5 transition-all duration-200 cursor-pointer"
                  style={{
                    background: requestSent ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366F1, #4F46E5)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <MessageSquare size={16} />
                  {requestSent ? 'SOLICITADO' : 'SOLICITAR UPDATE'}
                </button>
              )}

              <button
                className="px-2.5 py-2.5 flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: game.status === 'updated' ? '#047857' : game.status === 'update_available' ? '#1E40AF' : '#4338CA',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer'
                }}
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Larger Game Icon */}
            <img
              src={game.iconUrl || game.cover}
              alt={game.title}
              className="w-11 h-11 rounded-xl object-cover shadow-lg shrink-0"
            />

            {/* Game Title */}
            <span className="text-white text-base font-extrabold tracking-tight truncate max-w-lg">
              {game.title}
            </span>
          </div>
        ) : (
          /* Full Original Layout: [ Button | Cloud | Last Session | Playtime | Achievements ] */
          <div className="flex items-center gap-6">
            {/* Main Action Button (Play / Download / Update) */}
            <div className="flex items-center rounded-lg overflow-hidden shrink-0">
              {game.status === 'updated' ? (
                <button
                  onClick={() => onLaunchGame?.(game.title)}
                  className="flex items-center gap-2.5 px-6 py-2.5 transition-all duration-200 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                  }}
                >
                  <Play size={16} fill="currentColor" />
                  JUGAR
                </button>
              ) : game.status === 'update_available' ? (
                <button
                  onClick={() => onStartDownload?.(game)}
                  className="flex items-center gap-2.5 px-6 py-2.5 transition-all duration-200 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                    color: '#fff',
                    fontSize: '14px',
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                  }}
                >
                  <Download size={16} />
                  ACTUALIZAR
                </button>
              ) : (
                <button
                  onClick={handleRequestUpdate}
                  disabled={requestSent}
                  className="flex items-center gap-2.5 px-6 py-2.5 transition-all duration-200 cursor-pointer"
                  style={{
                    background: requestSent ? 'rgba(99,102,241,0.2)' : 'linear-gradient(135deg, #6366F1, #4F46E5)',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                  }}
                >
                  <MessageSquare size={16} />
                  {requestSent ? 'SOLICITADO' : 'SOLICITAR UPDATE'}
                </button>
              )}

              <button
                className="px-2.5 py-2.5 flex items-center justify-center transition-colors"
                style={{
                  backgroundColor: game.status === 'updated' ? '#047857' : game.status === 'update_available' ? '#1E40AF' : '#4338CA',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer'
                }}
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Metric 1: Estado Cloud (Interactive Modal Trigger) */}
            <button
              onClick={() => setCloudModalOpen(true)}
              className="flex items-center gap-2.5 px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(99,102,241,0.15)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.04)';
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
              }}
              title="Abrir gestión de partidas guardadas en la nube"
            >
              <Cloud size={18} style={{ color: savegameInfo?.exists ? '#10B981' : '#60A5FA' }} />
              <div className="text-left">
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  ESTADO DE CLOUD
                </div>
                <div style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: 600 }}>
                  {savegameInfo?.exists ? 'Sincronizado' : 'Configurar'}
                </div>
              </div>
            </button>

            {/* Metric 2: Última Sesión */}
            <div className="flex items-center gap-2.5">
              <Calendar size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
              <div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  ÚLTIMA SESIÓN
                </div>
                <div style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: 600 }}>
                  {game.hoursPlayed > 0 ? 'Reciente' : 'Nunca'}
                </div>
              </div>
            </div>

            {/* Metric 3: Tiempo de Juego */}
            <div className="flex items-center gap-2.5">
              <Clock size={18} style={{ color: 'rgba(255,255,255,0.5)' }} />
              <div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  TIEMPO DE JUEGO
                </div>
                <div style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: 600 }}>
                  {game.hoursPlayed.toFixed(1)} horas
                </div>
              </div>
            </div>

            {/* Metric 4: Logros */}
            <div className="flex items-center gap-2.5">
              <Award size={18} style={{ color: achievementsState.found && achievementsState.totalCount > 0 ? '#F59E0B' : 'rgba(255,255,255,0.4)' }} />
              <div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  LOGROS
                </div>
                {achievementsState.loading ? (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 500 }}>
                    Buscando...
                  </span>
                ) : !achievementsState.found || achievementsState.totalCount === 0 ? (
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 500 }}>
                    Sin logros
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#E2E8F0', fontSize: '11px', fontWeight: 700 }}>
                      {achievementsState.unlockedCount}/{achievementsState.totalCount}
                    </span>
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.round((achievementsState.unlockedCount / achievementsState.totalCount) * 100))}%`,
                          backgroundColor: '#F59E0B'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right side quick actions */}
        <div className="flex items-center gap-2">
          {isScrolled && (
            <div className="flex items-center gap-1.5 mr-2 text-xs font-semibold" style={{ color: '#10B981' }}>
              <Clock size={13} />
              <span>{game.hoursPlayed.toFixed(1)} hrs</span>
            </div>
          )}
          <button onClick={() => setBgSettingsModalOpen(true)} className="p-2 rounded-lg transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <Settings size={15} />
          </button>
          <button className="p-2 rounded-lg transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <Gamepad2 size={15} />
          </button>
          <button className="p-2 rounded-lg transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <Info size={15} />
          </button>
          <button className="p-2 rounded-lg transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
            <Heart size={15} />
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar (Steam Style: Detalles | DLCs | Mods) */}
      <div
        className="px-8 flex items-center gap-2 select-none"
        style={{
          backgroundColor: '#0F131C',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Tab 1: Detalles (Default) */}
        <button
          onClick={() => setSubTab('details')}
          className="flex items-center gap-2 px-4 py-3 relative transition-colors"
          style={{
            color: subTab === 'details' ? '#FFF' : 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            fontWeight: subTab === 'details' ? 700 : 500,
            cursor: 'pointer',
            border: 'none',
            background: 'transparent',
          }}
        >
          <span>Detalles</span>
          {subTab === 'details' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: '#6366F1', boxShadow: '0 0 10px #6366F1' }}
            />
          )}
        </button>

        {/* Tab 2: Logros */}
        <button
          disabled={!achievementsState.found || achievementsState.totalCount === 0}
          onClick={() => setSubTab('achievements')}
          className="flex items-center gap-2 px-4 py-3 relative transition-colors"
          style={{
            color: (!achievementsState.found || achievementsState.totalCount === 0)
              ? 'rgba(255,255,255,0.2)'
              : subTab === 'achievements'
              ? '#FFF'
              : 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            fontWeight: subTab === 'achievements' ? 700 : 500,
            cursor: (!achievementsState.found || achievementsState.totalCount === 0) ? 'not-allowed' : 'pointer',
            border: 'none',
            background: 'transparent',
            opacity: (!achievementsState.found || achievementsState.totalCount === 0) ? 0.4 : 1,
          }}
        >
          <span>Logros</span>
          {achievementsState.found && achievementsState.totalCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-md text-xs"
              style={{
                backgroundColor: 'rgba(245,158,11,0.2)',
                color: '#FDE047',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {achievementsState.unlockedCount}/{achievementsState.totalCount}
            </span>
          )}
          {subTab === 'achievements' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: '#F59E0B', boxShadow: '0 0 10px #F59E0B' }}
            />
          )}
        </button>

        {/* Tab 3: DLCs (Active if game.dlcs?.length > 0, else Off) */}
        <button
          disabled={!(game.dlcs && game.dlcs.length > 0)}
          onClick={() => setSubTab('dlcs')}
          className="flex items-center gap-2 px-4 py-3 relative transition-colors"
          style={{
            color: !(game.dlcs && game.dlcs.length > 0)
              ? 'rgba(255,255,255,0.2)'
              : subTab === 'dlcs'
              ? '#FFF'
              : 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            fontWeight: subTab === 'dlcs' ? 700 : 500,
            cursor: !(game.dlcs && game.dlcs.length > 0) ? 'not-allowed' : 'pointer',
            border: 'none',
            background: 'transparent',
            opacity: !(game.dlcs && game.dlcs.length > 0) ? 0.4 : 1,
          }}
        >
          <span>DLCs</span>
          {game.dlcs && game.dlcs.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-md text-xs"
              style={{
                backgroundColor: subTab === 'dlcs' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                color: subTab === 'dlcs' ? '#A5B4FC' : 'rgba(255,255,255,0.3)',
                fontSize: '10px',
                fontWeight: 700,
              }}
            >
              {game.dlcs.length}
            </span>
          )}
          {subTab === 'dlcs' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: '#6366F1', boxShadow: '0 0 10px #6366F1' }}
            />
          )}
        </button>

        {/* Tab: Versions */}
        <button
          onClick={() => setSubTab('versions')}
          className="flex items-center gap-2 px-4 py-3 relative transition-colors"
          style={{
            color: subTab === 'versions'
              ? '#FFF'
              : 'rgba(255,255,255,0.5)',
            fontSize: '13px',
            fontWeight: subTab === 'versions' ? 700 : 500,
            border: 'none',
            background: 'transparent',
            outline: 'none',
          }}
        >
          <span>Versiones</span>
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{
              backgroundColor: (game.changelog && game.changelog.length > 0) ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
              color: (game.changelog && game.changelog.length > 0) ? '#A5B4FC' : 'rgba(255,255,255,0.3)',
              fontSize: '10px',
              fontWeight: 700,
            }}
          >
            {game.changelog ? game.changelog.length : 0}
          </span>
          {subTab === 'versions' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: '#6366F1', boxShadow: '0 0 10px #6366F1' }}
            />
          )}
        </button>

        {/* Tab 3: Mods (Próximamente / Off) */}
        <button
          disabled
          className="flex items-center gap-2 px-4 py-3 relative transition-colors cursor-not-allowed"
          style={{
            color: 'rgba(255,255,255,0.2)',
            fontSize: '13px',
            fontWeight: 500,
            border: 'none',
            background: 'transparent',
            opacity: 0.4,
          }}
        >
          <span>Mods</span>
          <span
            className="px-1.5 py-0.5 rounded-md text-xs"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.3)',
              fontSize: '9px',
              fontWeight: 600,
            }}
          >
            Próximamente
          </span>
        </button>
      </div>

      {/* Content Area */}
      <div>
        <div className="flex gap-6 p-6">
          {/* Left column - main content */}
          <div className="flex-1 min-w-0 space-y-5">
            {subTab === 'achievements' ? (
              /* Achievements Sub-Tab View */
              <div
                className="p-5 rounded-2xl space-y-4"
                style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award size={22} className="text-amber-400" />
                    <div>
                      <h3 style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 700 }}>
                        Logros del Juego ({achievementsState.unlockedCount} de {achievementsState.totalCount} conseguidos)
                      </h3>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                        Progreso del juego: {Math.round((achievementsState.unlockedCount / achievementsState.totalCount) * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="w-48 h-2 rounded-full overflow-hidden bg-white/10">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-amber-500"
                      style={{ width: `${Math.round((achievementsState.unlockedCount / achievementsState.totalCount) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                  {achievementsState.list.map((ach) => (
                    <div
                      key={ach.apiName}
                      className="flex items-center gap-3.5 p-3 rounded-xl transition-all"
                      style={{
                        backgroundColor: ach.unlocked ? 'rgba(245, 158, 11, 0.08)' : 'rgba(255,255,255,0.03)',
                        border: ach.unlocked ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255,255,255,0.06)',
                        opacity: ach.unlocked ? 1 : 0.65
                      }}
                    >
                      {/* Icon */}
                      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-black/40 border border-white/10 flex items-center justify-center">
                        {ach.unlocked ? (
                          ach.iconUrl ? (
                            <img src={ach.iconUrl} alt={ach.displayName} className="w-full h-full object-cover" />
                          ) : (
                            <Award className="text-amber-400" size={20} />
                          )
                        ) : (
                          ach.iconGrayUrl ? (
                            <img src={ach.iconGrayUrl} alt={ach.displayName} className="w-full h-full object-cover grayscale opacity-50" />
                          ) : (
                            <Award className="text-slate-500" size={20} />
                          )
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{ach.displayName || ach.apiName}</h4>
                          {ach.unlocked && (
                            <span className="text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded bg-amber-500/10 shrink-0">
                              Desbloqueado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{ach.description || 'Sin descripción'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : subTab === 'dlcs' ? (
              /* DLCs Sub-Tab View */
              <div
                className="p-5 rounded-2xl space-y-4"
                style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-center justify-between">
                  <h3 style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 700 }}>
                    Contenido Descargable e Expansiones (DLCs)
                  </h3>
                  <span
                    className="px-2.5 py-1 rounded-lg text-xs"
                    style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#A5B4FC', fontWeight: 600 }}
                  >
                    {game.dlcs?.length || 0} packs activos
                  </span>
                </div>

                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                  Todos los DLCs listados a continuación están integrados automáticamente en la receta de instalación.
                </p>

                <div className="space-y-3">
                  {(game.dlcs || []).map((dlc, idx) => {
                    const currentVersionObj = game.availableVersions?.find(v => v.version === selectedVersion);
                    const isIncluded = currentVersionObj && currentVersionObj.id 
                        ? game.gameVersionDlcs?.some(gvd => gvd.dlc_id === dlc.id && gvd.game_version_id === currentVersionObj.id) 
                        : false;

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-4 rounded-xl transition-all"
                        style={{ 
                          backgroundColor: isIncluded ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', 
                          border: isIncluded ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(255,255,255,0.05)',
                          opacity: isIncluded ? 1 : 0.6
                        }}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
                          {/* DLC Image / Icon */}
                          <div
                            className="w-16 h-16 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                            style={{ backgroundColor: '#0A0D14', border: '1px solid rgba(255,255,255,0.1)' }}
                          >
                            <Package size={22} className={isIncluded ? "text-indigo-400" : "text-gray-500"} />
                          </div>

                          {/* DLC Title & Description */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div style={{ color: isIncluded ? '#E2E8F0' : '#94A3B8', fontSize: '14px', fontWeight: 700 }}>
                                {dlc.name}
                              </div>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>• Pack #{idx + 1}</span>
                            </div>

                            <p style={{ color: isIncluded ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>
                              {isIncluded ? 'Incluido en la versión seleccionada.' : 'Falta en la versión seleccionada.'}
                            </p>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 flex items-center gap-2">
                          {isIncluded ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34D399', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700 }}>
                              <FolderCheck size={14} /> Incluido
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 600 }}>
                              <X size={14} /> Ausente
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : subTab === 'versions' ? (
              /* Unified Versions & History Sub-Tab View */
              <div className="space-y-5">
                <div
                  className="p-5 rounded-2xl space-y-4"
                  style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package size={16} style={{ color: '#818CF8' }} />
                      <h3 style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 700 }}>
                        Historial y Lista de Versiones Publicadas
                      </h3>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer" onClick={() => setShowAllVersions(!showAllVersions)}>
                        <div 
                          className="w-8 h-4 rounded-full relative transition-colors duration-200"
                          style={{ backgroundColor: showAllVersions ? '#6366F1' : 'rgba(255,255,255,0.1)' }}
                        >
                          <div 
                            className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 shadow-sm"
                            style={{ left: showAllVersions ? '18px' : '2px' }}
                          />
                        </div>
                        <span style={{ color: showAllVersions ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '12px', transition: 'color 0.2s', userSelect: 'none' }}>
                          Mostrar todo el historial
                        </span>
                      </label>
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs"
                        style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#A5B4FC', fontWeight: 600 }}
                      >
                        {unifiedVersionsList.length} versión(es) registrada(s)
                      </span>
                    </div>
                  </div>

                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                    Consulta el historial completo del juego. Puedes descargar las versiones disponibles o solicitar a los administradores que añadan una versión específica.
                  </p>

                  <div className="space-y-3.5">
                    {unifiedVersionsList.map((item, idx) => {
                      const isRequested = requestedVersionsMap[item.version];
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl space-y-3 transition-all"
                          style={{
                            backgroundColor: item.isAvailable ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)',
                            border: item.isAvailable ? '1px solid rgba(99,102,241,0.25)' : '1px solid rgba(255,255,255,0.06)'
                          }}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="px-2.5 py-1 rounded-lg font-bold text-xs"
                                style={{
                                  backgroundColor: item.isAvailable ? '#6366F1' : 'rgba(255,255,255,0.1)',
                                  color: '#FFF'
                                }}
                              >
                                {item.version.startsWith('v') ? item.version : `v${item.version}`}
                              </span>

                              {item.isAvailable && (
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-semibold"
                                  style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981' }}
                                >
                                  Disponible para Descargar
                                </span>
                              )}

                              {item.buildId && showBuildId && (
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                                  (Build {item.buildId})
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {item.date && (
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                                  {item.date}
                                </span>
                              )}

                              {item.isAvailable ? (
                                <button
                                  onClick={() => {
                                    setSelectedVersion(item.version);
                                    onStartDownload?.(game);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-600 transition-colors cursor-pointer"
                                  style={{ backgroundColor: '#6366F1', color: '#FFF' }}
                                >
                                  <Download size={13} />
                                  <span>Descargar</span>
                                </button>
                              ) : isRequested ? (
                                <span
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                                  style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10B981' }}
                                >
                                  <FolderCheck size={13} /> Petición Enviada
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setRequestVersionTarget(item.version);
                                    setRequestModalOpen(true);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer hover:bg-amber-500/20"
                                  style={{
                                    backgroundColor: 'rgba(245,158,11,0.12)',
                                    color: '#FBBF24',
                                    border: '1px solid rgba(245,158,11,0.3)'
                                  }}
                                >
                                  <MessageSquare size={13} />
                                  <span>Solicitar Versión</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Notes if available */}
                          {item.notes && item.notes.length > 0 && (
                            <ul className="space-y-1 pl-1 pt-1 border-t border-white/5">
                              {item.notes.map((note, noteIdx) => (
                                <li key={noteIdx} className="flex items-start gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: item.isAvailable ? '#818CF8' : 'rgba(255,255,255,0.3)' }} />
                                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', lineHeight: 1.5, flex: 1, minWidth: 0 }}>
                                    <ExpandableText text={note} lines={2} />
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              /* Details Sub-Tab View (Default) */
              <>
                {/* Category / Genre & Controller Support Pure Text (Steam Style: No background, No border) */}
                <div className="flex items-center justify-between py-0.5 select-none">
                  {/* Left: Genre */}
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#67C1F5', fontSize: '11px', fontWeight: 800, letterSpacing: '0.05em' }}>
                      GÉNERO:
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500 }}>
                      {game.genre}
                    </span>
                  </div>

                  {/* Right: Controller Support (Far right end) */}
                  {game.controllerSupport && (
                    <div className="flex items-center gap-1.5 ml-auto" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', fontWeight: 500 }}>
                      <Gamepad2 size={14} style={{ color: '#67C1F5' }} />
                      <span>Soporte para mando completo</span>
                    </div>
                  )}
                </div>

                {/* Description 3-Column Block (Cover | Description | Dev & Publisher) */}
                <div
                  className="p-5 rounded-2xl flex gap-5 items-start"
                  style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Left: Vertical Cover Image */}
                  <div className="w-40 shrink-0 aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-white/10">
                    <img
                      src={game.cover}
                      alt={game.title}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Center: Full Game Description */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <h3 style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 700 }}>
                      Acerca del Juego
                    </h3>
                    <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', lineHeight: 1.7, flex: 1, minWidth: 0 }}>
                      <ExpandableText text={game.description} lines={4} />
                    </div>
                  </div>

                  {/* Right: Developer & Publisher Info Card (No image border, clean horizontal divider) */}
                  {(() => {
                    const isSameCompany =
                      game.developer.trim().toLowerCase() === game.publisher.trim().toLowerCase();

                    const renderCompanyLogo = (name: string, customLogoUrl?: string) => {
                      if (customLogoUrl) {
                        return (
                          <img
                            src={customLogoUrl}
                            alt={name}
                            className="h-14 max-w-full object-contain shrink-0 drop-shadow-lg"
                          />
                        );
                      }
                      const initials = name
                        .split(' ')
                        .map((word) => word[0])
                        .join('')
                        .substring(0, 2)
                        .toUpperCase();

                      return (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                          style={{
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(59,130,246,0.3))',
                            color: '#A5B4FC',
                            fontSize: '15px',
                            fontWeight: 800,
                          }}
                        >
                          {initials}
                        </div>
                      );
                    };

                    if (isSameCompany) {
                      return (
                        <div
                          className="w-64 shrink-0 p-4 rounded-xl flex flex-col items-start"
                          style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                        >
                          <div className="flex items-center gap-1.5 mb-2" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                            <Building2 size={13} style={{ color: '#818CF8' }} /> DESARROLLADOR & EDITOR
                          </div>

                          <div className="w-full h-px my-2" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

                          <div className="flex flex-col items-start gap-2.5 w-full pt-1">
                            {renderCompanyLogo(game.developer, game.developerLogoUrl || game.publisherLogoUrl)}
                            <div>
                              <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 700 }}>
                                {game.developer}
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginTop: '2px' }}>
                                Desarrollo & Publicación Oficial
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        className="w-64 shrink-0 p-4 rounded-xl flex flex-col"
                        style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                      >
                        {/* Developer section */}
                        <div className="flex flex-col items-start gap-2">
                          <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                            <Building2 size={12} style={{ color: '#818CF8' }} /> DESARROLLADOR
                          </div>
                          {renderCompanyLogo(game.developer, game.developerLogoUrl)}
                          <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 700 }}>
                            {game.developer}
                          </div>
                        </div>

                        {/* Horizontal divider */}
                        <div className="w-full h-px my-3.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />

                        {/* Publisher section */}
                        <div className="flex flex-col items-start gap-2">
                          <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                            <Megaphone size={12} style={{ color: '#60A5FA' }} /> EDITOR / PUBLISHER
                          </div>
                          {renderCompanyLogo(game.publisher, game.publisherLogoUrl)}
                          <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 700 }}>
                            {game.publisher}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Calendar, label: 'Lanzamiento', value: new Date(game.releaseDate).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) },
                    { icon: HardDrive, label: 'Tamaño', value: game.size },
                    { icon: Clock, label: 'Horas jugadas', value: `${game.hoursPlayed.toFixed(1)} hrs` },
                    { icon: Gamepad2, label: 'Mando', value: game.controllerSupport ? 'Soporte completo' : 'Teclado y ratón' },
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

                {/* Changelog / Notas de Parche */}
                {game.changelog && game.changelog.length > 0 && (
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
                                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', flex: 1, minWidth: 0 }}>
                                  <ExpandableText text={note} lines={2} />
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right panel - actions */}
          <div className="w-72 shrink-0 space-y-4">
            {/* Action panel (Unified) */}
            <div
              className="p-4 rounded-2xl"
              style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {renderActionPanel()}
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Saves Modal (Oracle Cloud VPS) */}
      {cloudModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ backgroundColor: '#11151F', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#161B26' }}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                  <Cloud size={20} />
                </div>
                <div>
                  <h3 style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 700, margin: 0 }}>
                    Partidas Guardadas (Cloud Saves)
                  </h3>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                    Oracle Cloud Always Free VPS & Respaldo Local
                  </div>
                </div>
              </div>
              <button
                onClick={() => setCloudModalOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Game info header in modal */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <img src={game.iconUrl || game.cover} alt={game.title} className="w-12 h-12 rounded-xl object-cover border border-white/10 shadow shrink-0" />
                <div className="min-w-0 flex-1">
                  <div style={{ color: '#FFF', fontSize: '14px', fontWeight: 700 }} className="truncate">
                    {game.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold" style={{ backgroundColor: savegameInfo?.exists ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: savegameInfo?.exists ? '#10B981' : '#F59E0B' }}>
                      <Cloud size={11} /> {savegameInfo?.exists ? 'Copia Nube Lista' : 'Sin copia previa'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Savegame info cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                    ÚLTIMO RESPALDO
                  </div>
                  <div style={{ color: '#E2E8F0', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                    {savegameInfo?.updatedAt ? new Date(savegameInfo.updatedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca'}
                  </div>
                </div>

                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                    TAMAÑO COMPRIMIDO
                  </div>
                  <div style={{ color: '#E2E8F0', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                    {savegameInfo?.sizeBytes ? formatBytes(savegameInfo.sizeBytes) : '0 KB'}
                  </div>
                </div>
              </div>

              {/* Resolved folder path */}
              {savegameInfo?.resolvedPath && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em' }}>
                    <FolderCheck size={12} style={{ color: '#818CF8' }} /> RUTA DETECTADA EN SISTEMA
                  </div>
                  <div style={{ color: '#A5B4FC', fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '4px' }}>
                    {savegameInfo.resolvedPath}
                  </div>
                </div>
              )}

              {/* Status message alert */}
              {savegameStatusMsg && (
                <div className="p-3 rounded-xl text-xs font-medium" style={{ backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#C7D2FE' }}>
                  {savegameStatusMsg}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-5 flex items-center justify-end gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#161B26' }}>
              <button
                onClick={handleRestore}
                disabled={restoring || !savegameInfo?.exists}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                <Download size={15} />
                {restoring ? 'Restaurando...' : 'Restaurar Partida'}
              </button>

              <button
                onClick={handleBackup}
                disabled={backingUp}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
                  color: '#FFF',
                  fontSize: '13px',
                  fontWeight: 800,
                }}
              >
                <Upload size={15} />
                {backingUp ? 'Respaldando...' : 'Respaldar Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para solicitar versión específica */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}>
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
            style={{ backgroundColor: '#11151E', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Modal Header */}
            <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#161B26' }}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#FBBF24' }}>
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 style={{ color: '#E2E8F0', fontSize: '15px', fontWeight: 700 }}>
                    Solicitar Versión {requestVersionTarget}
                  </h3>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                    {game.title}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setRequestModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: 1.6 }}>
                ¿Tienes sugerencias o un enlace donde conseguir los archivos de esta versión? Envía una nota a los administradores:
              </p>

              <div>
                <textarea
                  value={requestCustomMessage}
                  onChange={(e) => setRequestCustomMessage(e.target.value)}
                  placeholder="Escribe tu mensaje, sugerencia o enlaces útiles aquí..."
                  rows={4}
                  className="w-full p-3 rounded-xl text-xs resize-none outline-none focus:border-indigo-500 transition-colors"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#E2E8F0'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 flex items-center justify-end gap-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#161B26' }}>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/10 transition-colors cursor-pointer"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                Cancelar
              </button>

              <button
                onClick={handleSendVersionRequest}
                disabled={submittingVersionReq}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                  color: '#FFF',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.3)'
                }}
              >
                {submittingVersionReq ? 'Enviando...' : 'Enviar Petición'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Background Settings Modal */}
      {bgSettingsModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBgSettingsModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl border" style={{ backgroundColor: '#151922', borderColor: 'rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings size={18} style={{ color: '#818CF8' }} />
                <h2 style={{ color: '#E2E8F0', fontSize: '16px', fontWeight: 600 }}>Ajustes de Fondo</h2>
              </div>
              <button onClick={() => setBgSettingsModalOpen(false)} style={{ color: 'rgba(255,255,255,0.5)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>Activar fondos dinámicos</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Habilitar la rotación de imágenes</div>
                </div>
                <button
                  onClick={() => {
                    const newVal = !enableDynamicBackgrounds;
                    setEnableDynamicBackgrounds(newVal);
                    if (window.chrome?.webview) {
                      window.chrome.webview.postMessage({ action: "SAVE_SETTINGS", settings: { enableDynamicBackgrounds: newVal, bgImageDurationMs, bgFadeDurationMs } });
                    }
                  }}
                  className="relative flex items-center transition-all duration-300 rounded-full"
                  style={{ width: '40px', height: '22px', backgroundColor: enableDynamicBackgrounds ? '#6366F1' : 'rgba(255,255,255,0.12)' }}
                >
                  <div className="absolute rounded-full transition-all duration-300 bg-white" style={{ width: '16px', height: '16px', left: enableDynamicBackgrounds ? '21px' : '3px' }} />
                </button>
              </div>

              {enableDynamicBackgrounds && (
                <>
                  <div>
                    <div className="flex justify-between mb-2">
                      <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>Tiempo por imagen</div>
                      <div style={{ color: '#818CF8', fontSize: '12px' }}>{(bgImageDurationMs / 1000).toFixed(1)} s</div>
                    </div>
                    <input 
                      type="range" min="3000" max="20000" step="500" 
                      value={bgImageDurationMs} 
                      onChange={(e) => setBgImageDurationMs(parseInt(e.target.value))}
                      onMouseUp={() => {
                        if (window.chrome?.webview) {
                          window.chrome.webview.postMessage({ action: "SAVE_SETTINGS", settings: { enableDynamicBackgrounds, bgImageDurationMs, bgFadeDurationMs } });
                        }
                      }}
                      className="w-full accent-indigo-500" 
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>Velocidad del fundido</div>
                      <div style={{ color: '#818CF8', fontSize: '12px' }}>{(bgFadeDurationMs / 1000).toFixed(1)} s</div>
                    </div>
                    <input 
                      type="range" min="200" max="10000" step="100" 
                      value={bgFadeDurationMs} 
                      onChange={(e) => setBgFadeDurationMs(parseInt(e.target.value))}
                      onMouseUp={() => {
                        if (window.chrome?.webview) {
                          window.chrome.webview.postMessage({ action: "SAVE_SETTINGS", settings: { enableDynamicBackgrounds, bgImageDurationMs, bgFadeDurationMs } });
                        }
                      }}
                      className="w-full accent-indigo-500" 
                    />
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setBgSettingsModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors hover:bg-indigo-600"
                style={{ backgroundColor: '#6366F1', color: '#fff' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
