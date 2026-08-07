import { useState, useEffect } from 'react';
import { Award } from 'lucide-react';
import { onWebViewMessage, WebViewMessage } from '../webview-bridge';

interface ToastData {
  id: string;
  gameKey: string;
  appId: number;
  displayName: string;
  description: string;
  iconUrl: string;
}

export function AchievementToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    const unsub = onWebViewMessage((msg: WebViewMessage) => {
      if (msg.type === 'ACHIEVEMENT_UNLOCKED') {
        const newToast: ToastData = {
          id: `${msg.appId}_${msg.achievement.apiName}_${Date.now()}`,
          gameKey: msg.gameKey,
          appId: msg.appId,
          displayName: msg.achievement.displayName || msg.achievement.apiName,
          description: msg.achievement.description || '¡Logro desbloqueado!',
          iconUrl: msg.achievement.iconUrl
        };

        setToasts((prev) => [...prev, newToast]);

        // Auto dismiss after 6 seconds
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== newToast.id));
        }, 6000);
      }
    });

    return () => unsub();
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3.5 p-3.5 rounded-2xl shadow-2xl backdrop-blur-md transition-all duration-300 animate-slide-in-right"
          style={{
            backgroundColor: 'rgba(21, 25, 34, 0.95)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            boxShadow: '0 10px 30px -5px rgba(245, 158, 11, 0.25)',
            minWidth: '320px',
            maxWidth: '400px'
          }}
        >
          {/* Achievement Icon */}
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/50 border border-amber-500/30 shrink-0 flex items-center justify-center">
            {toast.iconUrl ? (
              <img src={toast.iconUrl} alt={toast.displayName} className="w-full h-full object-cover" />
            ) : (
              <Award className="w-6 h-6 text-amber-400" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                <Award size={12} /> ¡Logro Desbloqueado!
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-100 truncate mt-0.5">{toast.displayName}</h4>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{toast.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
