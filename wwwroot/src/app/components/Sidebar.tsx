import { BookOpen, Compass, Download, Settings, RefreshCw, Gamepad2, ChevronRight } from 'lucide-react';

export type View = 'library' | 'explore' | 'downloads' | 'settings';

interface SidebarProps {
  activeView: View;
  onViewChange: (view: View) => void;
  downloadCount: number;
  onSync: () => void;
  syncing: boolean;
}

const navItems: { id: View; label: string; icon: typeof BookOpen; badge?: string }[] = [
  { id: 'library', label: 'Biblioteca', icon: BookOpen },
  { id: 'explore', label: 'Explorar / Catálogo', icon: Compass },
  { id: 'downloads', label: 'Descargas Activas', icon: Download },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export function Sidebar({ activeView, onViewChange, downloadCount, onSync, syncing }: SidebarProps) {
  return (
    <div
      className="flex flex-col w-56 shrink-0 h-full"
      style={{
        backgroundColor: '#0D1117',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Nav items */}
      <nav className="flex-1 pt-4 px-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative"
              style={{
                backgroundColor: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(99,102,241,0.25)' : '1px solid transparent',
                color: isActive ? '#A5B4FC' : 'rgba(255,255,255,0.45)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.8)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
                }
              }}
            >
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ backgroundColor: '#6366F1', boxShadow: '0 0 8px #6366F1' }}
                />
              )}
              <Icon size={17} strokeWidth={isActive ? 2 : 1.75} />
              <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, letterSpacing: '0.01em' }}>
                {item.label}
              </span>
              {item.id === 'downloads' && downloadCount > 0 && (
                <span
                  className="ml-auto flex items-center justify-center w-5 h-5 rounded-full text-xs"
                  style={{ backgroundColor: '#3B82F6', color: '#fff', fontSize: '10px', fontWeight: 700 }}
                >
                  {downloadCount}
                </span>
              )}
              {isActive && item.id !== 'downloads' && (
                <ChevronRight size={13} className="ml-auto opacity-50" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '0 12px' }} />

      {/* User section */}
      <div className="p-3 space-y-2">
        {/* User info */}
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-xl"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366F1, #3B82F6)' }}
          >
            <Gamepad2 size={16} style={{ color: '#fff' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ color: '#E2E8F0', fontSize: '12px', fontWeight: 600 }}>Admin</div>
            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>8 juegos · Activo</div>
          </div>
        </div>

        {/* Sync button */}
        <button
          onClick={onSync}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl transition-all duration-200"
          style={{
            background: syncing
              ? 'rgba(59,130,246,0.2)'
              : 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            color: syncing ? '#60A5FA' : '#A5B4FC',
            fontSize: '12px',
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            if (!syncing) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.22)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!syncing) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.3)';
            }
          }}
        >
          <RefreshCw
            size={13}
            style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}
          />
          {syncing ? 'Sincronizando...' : 'Sincronizar'}
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
