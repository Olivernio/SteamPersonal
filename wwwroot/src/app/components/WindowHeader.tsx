import { Minus, Square, X, Wifi, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface WindowHeaderProps {
  onSync: () => void;
  syncing: boolean;
}

export function WindowHeader({ onSync, syncing }: WindowHeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div
      className="flex items-center justify-between px-4 h-10 shrink-0 select-none"
      style={{ backgroundColor: '#080B10', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Left: App identity */}
      <div className="flex items-center gap-3">
        {/* Logo icon */}
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #6366F1, #3B82F6)' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" fill="white" fillOpacity="0.9" />
            <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="white" fillOpacity="0.4" />
          </svg>
        </div>
        <span style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600, letterSpacing: '0.01em' }}>
          Steam Personal
        </span>
        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>|</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>Game Launcher</span>
      </div>

      {/* Center: sync status */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: '#10B981',
              boxShadow: '0 0 6px #10B981',
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <Wifi size={11} style={{ color: '#10B981' }} />
          <span style={{ color: '#10B981', fontSize: '11px', fontWeight: 500 }}>Sincronizado con Supabase</span>
        </div>
        <button
          onClick={onSync}
          className="flex items-center gap-1 px-2 py-1 rounded-md transition-all duration-200"
          style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.4)';
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
        >
          <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Right: window controls */}
      <div className="flex items-center gap-1">
        <button
          className="flex items-center justify-center w-8 h-6 rounded-md transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
          }}
        >
          <Minus size={12} />
        </button>
        <button
          className="flex items-center justify-center w-8 h-6 rounded-md transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onClick={() => setIsMaximized(!isMaximized)}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.08)';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.9)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
          }}
        >
          <Square size={11} />
        </button>
        <button
          className="flex items-center justify-center w-8 h-6 rounded-md transition-all duration-150"
          style={{ color: 'rgba(255,255,255,0.45)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#E11D48';
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
          }}
        >
          <X size={12} />
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
