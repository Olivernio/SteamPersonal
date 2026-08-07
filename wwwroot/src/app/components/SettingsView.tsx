import { useState } from 'react';
import { HardDrive, Download, Shield, Bell, Monitor, Palette, Server, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative flex items-center transition-all duration-300 rounded-full"
      style={{
        width: '40px',
        height: '22px',
        backgroundColor: value ? '#6366F1' : 'rgba(255,255,255,0.12)',
        boxShadow: value ? '0 0 10px rgba(99,102,241,0.4)' : 'none',
        border: 'none',
        padding: 0,
      }}
    >
      <div
        className="absolute rounded-full transition-all duration-300"
        style={{
          width: '16px',
          height: '16px',
          backgroundColor: '#fff',
          left: value ? '21px' : '3px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </button>
  );
}

interface SettingRowProps {
  icon: typeof HardDrive;
  label: string;
  description: string;
  children: React.ReactNode;
  iconColor?: string;
}

function SettingRow({ icon: Icon, label, description, children, iconColor = '#818CF8' }: SettingRowProps) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200"
      style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
      >
        <Icon size={17} style={{ color: iconColor }} />
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>{label}</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>{description}</div>
      </div>
      {children}
    </div>
  );
}

interface SectionProps {
  title: string;
  icon: typeof HardDrive;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, children }: SectionProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div
        className="px-4 py-3 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', backgroundColor: 'rgba(255,255,255,0.02)' }}
      >
        <Icon size={14} style={{ color: '#6366F1' }} />
        <h3 style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em' }}>
          {title.toUpperCase()}
        </h3>
      </div>
      <div className="p-2 space-y-0.5">{children}</div>
    </div>
  );
}

export function SettingsView() {
  const [settings, setSettings] = useState({
    autoUpdate: true,
    notifications: true,
    startupLaunch: false,
    backgroundSync: true,
    hardwareAccel: true,
    closeToTray: true,
    downloadLimit: false,
    verifyFiles: true,
    analytics: false,
    betaChannel: false,
  });

  const [steamApiKey, setSteamApiKey] = useState('');

  // Escuchar mensaje SETTINGS_LOADED desde el backend
  React.useEffect(() => {
    const handleMessage = (event: any) => {
      const msg = event.data;
      if (msg && msg.type === "SETTINGS_LOADED") {
        setSteamApiKey(msg.settings?.steamApiKey || '');
      }
    };

    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.addEventListener('message', handleMessage);
      window.chrome.webview.postMessage({ action: "GET_SETTINGS" });
    }

    return () => {
      if (window.chrome && window.chrome.webview) {
        window.chrome.webview.removeEventListener('message', handleMessage);
      }
    };
  }, []);

  const handleSaveSettings = () => {
    if (window.chrome && window.chrome.webview) {
      window.chrome.webview.postMessage({
        action: "SAVE_SETTINGS",
        settings: {
          steamApiKey: steamApiKey
        }
      });
      alert("Ajustes guardados correctamente");
    }
  };

  const [downloadPath, setDownloadPath] = useState('C:\\Games\\SteamPersonal');
  const [downloadSpeed, setDownloadSpeed] = useState('Sin límite');
  const [theme, setTheme] = useState('dark');
  const [lang, setLang] = useState('Español');

  const toggle = (key: keyof typeof settings) => {
    setSettings((s) => ({ ...s, [key]: !s[key] }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <h1 style={{ color: '#E2E8F0', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>Ajustes</h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>Configura Steam Personal a tu gusto</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <Section title="Conexiones de Red" icon={Server}>
          <SettingRow
            icon={Server}
            label="Clave API de Steam"
            description="Necesaria para obtener la lista oficial de logros de tus juegos emulados."
          >
            <div className="flex gap-2">
              <input 
                type="text" 
                value={steamApiKey}
                onChange={(e) => setSteamApiKey(e.target.value)}
                placeholder="Ej. 6A3DB6..."
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', width: '220px', outline: 'none' }}
              />
              <button 
                onClick={handleSaveSettings}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-500 transition-colors"
                style={{ backgroundColor: '#6366F1', color: '#fff' }}
              >
                Guardar
              </button>
            </div>
          </SettingRow>
        </Section>

        {/* General */}
        <Section title="General" icon={Monitor}>
          <SettingRow icon={Monitor} label="Inicio automático con el sistema" description="Lanzar Steam Personal al iniciar Windows">
            <Toggle value={settings.startupLaunch} onChange={() => toggle('startupLaunch')} />
          </SettingRow>
          <SettingRow icon={Bell} label="Minimizar a bandeja del sistema" description="Al cerrar, la app sigue ejecutándose en el fondo" iconColor="#60A5FA">
            <Toggle value={settings.closeToTray} onChange={() => toggle('closeToTray')} />
          </SettingRow>
          <SettingRow icon={Bell} label="Notificaciones" description="Alertas de actualizaciones y descargas completadas" iconColor="#F59E0B">
            <Toggle value={settings.notifications} onChange={() => toggle('notifications')} />
          </SettingRow>
        </Section>

        {/* Biblioteca */}
        <Section title="Biblioteca y Descargas" icon={Download}>
          <SettingRow icon={Download} label="Actualizaciones automáticas" description="Actualizar juegos automáticamente cuando haya nuevas versiones" iconColor="#10B981">
            <Toggle value={settings.autoUpdate} onChange={() => toggle('autoUpdate')} />
          </SettingRow>

          <div
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
            >
              <HardDrive size={17} style={{ color: '#818CF8' }} />
            </div>
            <div className="flex-1 min-w-0">
              <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>Ruta de instalación</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>Directorio donde se instalan los juegos</div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-3 py-1.5 rounded-lg"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#A5B4FC',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                }}
              >
                {downloadPath}
              </span>
              <button
                className="px-2.5 py-1.5 rounded-lg"
                style={{
                  backgroundColor: 'rgba(99,102,241,0.15)',
                  border: '1px solid rgba(99,102,241,0.3)',
                  color: '#A5B4FC',
                  fontSize: '11px',
                }}
              >
                Cambiar
              </button>
            </div>
          </div>

          <div
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
            >
              <Download size={17} style={{ color: '#60A5FA' }} />
            </div>
            <div className="flex-1">
              <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>Límite de velocidad de descarga</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>Controla el ancho de banda usado para descargas</div>
            </div>
            <select
              value={downloadSpeed}
              onChange={(e) => setDownloadSpeed(e.target.value)}
              className="px-3 py-1.5 rounded-lg outline-none"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#E2E8F0',
                fontSize: '12px',
              }}
            >
              <option value="Sin límite">Sin límite</option>
              <option value="10 MB/s">10 MB/s</option>
              <option value="25 MB/s">25 MB/s</option>
              <option value="50 MB/s">50 MB/s</option>
              <option value="100 MB/s">100 MB/s</option>
            </select>
          </div>

          <SettingRow icon={Shield} label="Verificar archivos al instalar" description="Comprobar integridad de archivos descargados" iconColor="#10B981">
            <Toggle value={settings.verifyFiles} onChange={() => toggle('verifyFiles')} />
          </SettingRow>
        </Section>

        {/* Apariencia */}
        <Section title="Apariencia" icon={Palette}>
          <div
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)' }}
            >
              <Palette size={17} style={{ color: '#C084FC' }} />
            </div>
            <div className="flex-1">
              <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>Tema de la interfaz</div>
              <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px' }}>Apariencia visual de la aplicación</div>
            </div>
            <div className="flex gap-1.5">
              {['dark', 'darker', 'midnight'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className="px-3 py-1.5 rounded-lg capitalize"
                  style={{
                    backgroundColor: theme === t ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                    border: theme === t ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                    color: theme === t ? '#A5B4FC' : 'rgba(255,255,255,0.45)',
                    fontSize: '11px',
                    fontWeight: theme === t ? 600 : 400,
                  }}
                >
                  {t === 'dark' ? 'Oscuro' : t === 'darker' ? 'Más oscuro' : 'Medianoche'}
                </button>
              ))}
            </div>
          </div>

          <SettingRow icon={Monitor} label="Aceleración por hardware" description="Usar GPU para renderizar la interfaz (recomendado)" iconColor="#F59E0B">
            <Toggle value={settings.hardwareAccel} onChange={() => toggle('hardwareAccel')} />
          </SettingRow>
        </Section>

        {/* Sincronización */}
        <Section title="Supabase y Sincronización" icon={Server}>
          <SettingRow icon={Server} label="Sincronización en segundo plano" description="Mantener la biblioteca actualizada automáticamente" iconColor="#10B981">
            <Toggle value={settings.backgroundSync} onChange={() => toggle('backgroundSync')} />
          </SettingRow>

          <div
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}
            >
              <Server size={17} style={{ color: '#10B981' }} />
            </div>
            <div className="flex-1">
              <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>Estado de conexión</div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#10B981' }} />
                <span style={{ color: '#10B981', fontSize: '11px' }}>Conectado · supabase.io/sp-launcher</span>
              </div>
            </div>
            <button
              className="px-3 py-1.5 rounded-lg"
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: 'rgba(239,68,68,0.8)',
                fontSize: '11px',
              }}
            >
              Desconectar
            </button>
          </div>
        </Section>

        {/* Advanced */}
        <Section title="Privacidad y Avanzado" icon={Shield}>
          <SettingRow icon={Shield} label="Enviar estadísticas de uso anónimas" description="Ayuda a mejorar la aplicación (sin datos personales)" iconColor="#6366F1">
            <Toggle value={settings.analytics} onChange={() => toggle('analytics')} />
          </SettingRow>
          <SettingRow icon={Bell} label="Canal Beta" description="Recibir actualizaciones de prelanzamiento" iconColor="#F59E0B">
            <Toggle value={settings.betaChannel} onChange={() => toggle('betaChannel')} />
          </SettingRow>
          <button
            className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)', textAlign: 'left' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(239,68,68,0.05)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.02)'; }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)' }}
            >
              <Shield size={17} style={{ color: '#EF4444' }} />
            </div>
            <div className="flex-1">
              <div style={{ color: '#EF4444', fontSize: '13px', fontWeight: 500 }}>Restablecer configuración</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>Volver a los valores de fábrica</div>
            </div>
            <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </button>
        </Section>

        {/* Version info */}
        <div className="pb-4 text-center">
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '11px' }}>
            Steam Personal v1.0.0 · Build 2026.08.03 · React + Tailwind
          </span>
        </div>
      </div>

      <style>{`
        select option { background-color: #1E2532; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
