import { useState } from 'react';
import { Minus, Square, X, Wifi, RefreshCw, BookOpen, Compass, Download, Settings, Gamepad2, ChevronRight } from 'lucide-react';
import { View } from './Sidebar';

interface WindowHeaderProps {
  activeView: View;
  onViewChange: (view: View) => void;
  downloadCount: number;
  onSync: () => void;
  syncing: boolean;
}

const navItems: { id: View; label: string; icon: typeof BookOpen }[] = [
  { id: 'library', label: 'Biblioteca', icon: BookOpen },
  { id: 'explore', label: 'Explorar', icon: Compass },
  { id: 'downloads', label: 'Descargas', icon: Download },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export function WindowHeader({
  activeView,
  onViewChange,
  downloadCount,
  onSync,
  syncing,
}: WindowHeaderProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div
      className="flex items-center justify-between px-4 h-12 shrink-0 select-none"
      style={{
        backgroundColor: '#080B10',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 50,
      }}
    >
      {/* Left: App identity & Nav Tabs */}
      <div className="flex items-center gap-6">
        {/* Brand identity */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #3B82F6)' }}
          >
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" fill="white" fillOpacity="0.95" />
              <path d="M7 4L10 5.5V8.5L7 10L4 8.5V5.5L7 4Z" fill="white" fillOpacity="0.45" />
            </svg>
          </div>
          <span style={{ color: '#E2E8F0', fontSize: '14px', fontWeight: 700, letterSpacing: '0.02em' }}>
            Steam Personal
          </span>
        </div>

        {/* Vertical divider */}
        <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255,255,255,0.1)' }} />

        {/* Top Navbar Tabs (Migrated from Sidebar) */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all duration-200 relative"
                style={{
                  backgroundColor: isActive ? 'rgba(99,102,241,0.18)' : 'transparent',
                  border: isActive ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                  color: isActive ? '#A5B4FC' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.06)';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.85)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)';
                  }
                }}
              >
                <Icon size={15} strokeWidth={isActive ? 2.2 : 1.75} />
                <span>{item.label}</span>

                {item.id === 'downloads' && downloadCount > 0 && (
                  <span
                    className="flex items-center justify-center px-1.5 py-0.5 rounded-full text-xs"
                    style={{ backgroundColor: '#3B82F6', color: '#fff', fontSize: '10px', fontWeight: 800, minWidth: '16px' }}
                  >
                    {downloadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Sync status & Window Controls */}
      <div className="flex items-center gap-3">
        {/* Supabase status badge */}
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
          <span style={{ color: '#10B981', fontSize: '11px', fontWeight: 600 }}>En línea</span>
        </div>

        {/* Sync button */}
        <button
          onClick={onSync}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all duration-200"
          style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: syncing ? '#60A5FA' : 'rgba(255,255,255,0.6)',
            fontSize: '11px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.1)';
            (e.currentTarget as HTMLButtonElement).style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
            (e.currentTarget as HTMLButtonElement).style.color = syncing ? '#60A5FA' : 'rgba(255,255,255,0.6)';
          }}
        >
          <RefreshCw size={12} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} />
          <span>{syncing ? 'Sincronizando...' : 'Sincronizar'}</span>
        </button>

        {/* Window controls */}
        <div className="flex items-center gap-1 ml-2">
          <button
            className="flex items-center justify-center w-8 h-7 rounded-md transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
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
            className="flex items-center justify-center w-8 h-7 rounded-md transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
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
            className="flex items-center justify-center w-8 h-7 rounded-md transition-all duration-150"
            style={{ color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}
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
