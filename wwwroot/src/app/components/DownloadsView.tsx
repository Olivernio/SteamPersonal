import { useState, useEffect, useRef } from 'react';
import { Pause, X, Play, Wifi, HardDrive, Zap, Clock, CheckCircle } from 'lucide-react';
import { ACTIVE_DOWNLOAD } from '../data/games';

interface DownloadState {
  progress: number;
  speed: string;
  eta: string;
  paused: boolean;
  cancelled: boolean;
  currentStep: number;
  completed: boolean;
}

const SPEEDS = ['38.4 MB/s', '45.2 MB/s', '51.7 MB/s', '42.9 MB/s', '47.3 MB/s', '55.1 MB/s', '39.8 MB/s'];
const ETAS = ['5 mins', '4 mins', '3 mins', '2 mins', '1 min', '<1 min'];

export function DownloadsView() {
  const dl = ACTIVE_DOWNLOAD;

  const initialProgress = (dl.downloadedBytes / dl.totalBytes) * 100;

  const [state, setState] = useState<DownloadState>({
    progress: initialProgress,
    speed: dl.speed,
    eta: dl.eta,
    paused: false,
    cancelled: false,
    currentStep: dl.currentStep,
    completed: false,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedIdx = useRef(0);

  useEffect(() => {
    if (state.paused || state.cancelled || state.completed) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.paused || prev.cancelled || prev.completed) return prev;
        const newProgress = Math.min(prev.progress + 0.18, 100);
        const stepProgress = (newProgress / 100) * (dl.steps.length - 1);
        const newStep = Math.min(Math.floor(stepProgress), dl.steps.length - 1);
        speedIdx.current = (speedIdx.current + 1) % SPEEDS.length;
        const etaIdx = Math.floor((newProgress / 100) * (ETAS.length - 1));
        return {
          ...prev,
          progress: newProgress,
          speed: SPEEDS[speedIdx.current],
          eta: newProgress >= 100 ? 'Finalizando...' : ETAS[Math.min(etaIdx, ETAS.length - 1)],
          currentStep: newStep,
          completed: newProgress >= 100,
        };
      });
    }, 200);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [state.paused, state.cancelled, state.completed]);

  const downloadedGB = (state.progress / 100) * dl.totalBytes;

  if (state.cancelled) {
    return (
      <div className="flex flex-col h-full">
        <ViewHeader />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div style={{ fontSize: '56px' }}>❌</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '16px' }}>Descarga cancelada</p>
          <button
            onClick={() => setState((s) => ({ ...s, cancelled: false, progress: initialProgress, currentStep: 0 }))}
            className="px-4 py-2 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#A5B4FC', fontSize: '13px' }}
          >
            Reiniciar descarga
          </button>
        </div>
      </div>
    );
  }

  if (state.completed) {
    return (
      <div className="flex flex-col h-full">
        <ViewHeader />
        <div className="flex-1 p-6 space-y-4">
          <div
            className="p-6 rounded-2xl flex flex-col items-center gap-4"
            style={{ backgroundColor: '#151922', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(16,185,129,0.2)' }}
            >
              <CheckCircle size={32} style={{ color: '#10B981' }} />
            </div>
            <div className="text-center">
              <h2 style={{ color: '#E2E8F0', fontSize: '18px', fontWeight: 700 }}>Descarga completada</h2>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', marginTop: '4px' }}>{dl.gameTitle} {dl.version}</p>
            </div>
            <button
              className="flex items-center gap-2 px-6 py-3 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #059669, #10B981)',
                boxShadow: '0 6px 20px rgba(16,185,129,0.35)',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <Play size={16} fill="currentColor" />
              JUGAR AHORA
            </button>
          </div>
          <EmptyQueueCard />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ViewHeader />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Active download card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {/* Card header */}
          <div
            className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(59,130,246,0.06)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: state.paused ? '#EAB308' : '#3B82F6',
                  boxShadow: state.paused ? '0 0 6px #EAB308' : '0 0 8px #3B82F6',
                  animation: state.paused ? 'none' : 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span style={{ color: state.paused ? '#EAB308' : '#60A5FA', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em' }}>
                {state.paused ? 'PAUSADO' : 'DESCARGANDO'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setState((s) => ({ ...s, paused: !s.paused }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.12)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
              >
                {state.paused ? <Play size={12} /> : <Pause size={12} />}
                {state.paused ? 'Reanudar' : 'Pausar'}
              </button>
              <button
                onClick={() => setState((s) => ({ ...s, cancelled: true }))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200"
                style={{
                  backgroundColor: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: 'rgba(239,68,68,0.8)',
                  fontSize: '12px',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.15)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.08)'; }}
              >
                <X size={12} />
                Cancelar
              </button>
            </div>
          </div>

          {/* Card body */}
          <div className="p-5">
            <div className="flex gap-4 mb-5">
              {/* Thumbnail */}
              <div className="w-20 h-24 rounded-xl overflow-hidden shrink-0">
                <img src={dl.gameCover} alt={dl.gameTitle} className="w-full h-full object-cover" />
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-start justify-between mb-1">
                  <h2 style={{ color: '#E2E8F0', fontSize: '18px', fontWeight: 700 }}>{dl.gameTitle}</h2>
                  <span
                    className="px-2 py-0.5 rounded-md"
                    style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#60A5FA', fontSize: '11px', fontWeight: 700 }}
                  >
                    {dl.version}
                  </span>
                </div>

                {/* Step badge */}
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="px-3 py-1 rounded-full flex items-center gap-2"
                    style={{
                      background: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.3)',
                    }}
                  >
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: '#818CF8', animation: state.paused ? 'none' : 'pulse 1s ease-in-out infinite' }}
                    />
                    <span style={{ color: '#A5B4FC', fontSize: '11px', fontWeight: 600 }}>
                      {dl.steps[state.currentStep]}
                    </span>
                  </div>
                </div>

                {/* Step pipeline */}
                <div className="flex items-center gap-1">
                  {dl.steps.map((step, i) => (
                    <div key={step} className="flex items-center gap-1">
                      <div
                        className="flex items-center justify-center rounded-full transition-all duration-500"
                        style={{
                          width: i === state.currentStep ? '20px' : '8px',
                          height: '8px',
                          backgroundColor: i < state.currentStep
                            ? '#10B981'
                            : i === state.currentStep
                            ? '#6366F1'
                            : 'rgba(255,255,255,0.1)',
                          borderRadius: i === state.currentStep ? '4px' : '50%',
                        }}
                      />
                      {i < dl.steps.length - 1 && (
                        <div
                          style={{
                            width: '12px',
                            height: '1px',
                            backgroundColor: i < state.currentStep ? '#10B981' : 'rgba(255,255,255,0.1)',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
                  <HardDrive size={12} />
                  <span>{downloadedGB.toFixed(1)} GB / {dl.totalBytes} GB</span>
                </div>
                <span style={{ color: '#E2E8F0', fontSize: '14px', fontWeight: 700 }}>
                  {state.progress.toFixed(1)}%
                </span>
              </div>

              <div
                className="w-full h-3 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(255,255,255,0.07)' }}
              >
                <div
                  className="h-full rounded-full relative overflow-hidden transition-all duration-300"
                  style={{
                    width: `${state.progress}%`,
                    background: state.paused
                      ? 'linear-gradient(90deg, #EAB308, #CA8A04)'
                      : 'linear-gradient(90deg, #6366F1, #3B82F6)',
                    boxShadow: state.paused ? '0 0 12px rgba(234,179,8,0.5)' : '0 0 12px rgba(59,130,246,0.5)',
                  }}
                >
                  {!state.paused && (
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                        animation: 'shimmer 1.5s linear infinite',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div
              className="grid grid-cols-3 gap-3 p-3 rounded-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {[
                { icon: Zap, label: 'Velocidad', value: state.paused ? '— MB/s' : state.speed, color: '#3B82F6' },
                { icon: Clock, label: 'Tiempo restante', value: state.paused ? 'Pausado' : state.eta, color: '#8B5CF6' },
                { icon: Wifi, label: 'Estado', value: state.paused ? 'En pausa' : 'Activo', color: state.paused ? '#EAB308' : '#10B981' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-1 py-1">
                  <stat.icon size={14} style={{ color: stat.color }} />
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>{stat.label}</span>
                  <span style={{ color: stat.color, fontSize: '13px', fontWeight: 700 }}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Queue */}
        <EmptyQueueCard />

        {/* Completed downloads */}
        <div
          className="p-4 rounded-2xl"
          style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <h3 style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '12px' }}>
            HISTORIAL RECIENTE
          </h3>
          {[
            { title: 'Elden Nexus', version: 'v2.12', date: '31 Jul 2026', size: '62.4 GB' },
            { title: 'Iron Legacy', version: 'v1.8', date: '28 Jul 2026', size: '28.3 GB' },
          ].map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-3 py-2.5"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <CheckCircle size={14} style={{ color: '#10B981', shrink: 0 }} />
              <div className="flex-1">
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>{item.title}</span>
                <span
                  className="ml-2 px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', fontSize: '10px', fontWeight: 600 }}
                >
                  {item.version}
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>{item.size}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '11px' }}>{item.date}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(200%); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}

function ViewHeader() {
  return (
    <div
      className="px-6 py-4 shrink-0"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h1 style={{ color: '#E2E8F0', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>Descargas Activas</h1>
      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>Monitorea y gestiona tus descargas</p>
    </div>
  );
}

function EmptyQueueCard() {
  return (
    <div
      className="p-4 rounded-2xl flex items-center gap-4"
      style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)', borderStyle: 'dashed' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
      >
        <HardDrive size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
      </div>
      <div>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 500 }}>Cola de descarga vacía</p>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>Agrega juegos desde la Biblioteca</p>
      </div>
    </div>
  );
}
