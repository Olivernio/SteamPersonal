import React, { useState } from 'react';
import type { DbGameVersion, DownloadMirror } from '../services/supabaseAdmin';
import { parseMirrors, serializeMirrors } from '../services/supabaseAdmin';
import { Plus, Trash2, ExternalLink, FileText, CheckCircle2, XCircle, Tag, Server } from 'lucide-react';

interface VersionManagerModalProps {
  version: DbGameVersion | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (savedVersion: DbGameVersion) => void;
  onDelete?: (versionId: string) => void;
  allExistingVersions?: DbGameVersion[];
}

const COMMON_PROVIDERS = ['Google Drive', 'Mega', 'Mediafire', '1Fichier', 'Servidor Directo', 'Torrent'];

export const VersionManagerModal: React.FC<VersionManagerModalProps> = ({
  version,
  isOpen,
  onClose,
  onSave,
  onDelete,
  allExistingVersions = [],
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(version && (version.id || version.version_name));

  const [versionName, setVersionName] = useState(version?.version_name || '');
  const [buildId, setBuildId] = useState(version?.build_id || '');
  const [releaseDate, setReleaseDate] = useState(version?.release_date || new Date().toISOString().split('T')[0]);
  const [isAvailable, setIsAvailable] = useState(version?.is_available ?? true);
  const [changelogTitle, setChangelogTitle] = useState(version?.changelog_title || '');
  const [changelogBody, setChangelogBody] = useState(version?.changelog_body || '');

  // Mirrors state
  const [mirrors, setMirrors] = useState<DownloadMirror[]>(() => {
    if (version?.mirrors && version.mirrors.length > 0) return version.mirrors;
    if (version?.download_url) return parseMirrors(version.download_url);
    return [{ provider: 'Google Drive', url: '' }];
  });

  const handleAddMirror = (provider = 'Google Drive') => {
    setMirrors((prev) => [...prev, { provider, url: '' }]);
  };

  const handleUpdateMirror = (idx: number, field: keyof DownloadMirror, val: string) => {
    setMirrors((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleRemoveMirror = (idx: number) => {
    setMirrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCloneFrom = (sourceVersion: DbGameVersion) => {
    setChangelogTitle(sourceVersion.changelog_title || '');
    setChangelogBody(sourceVersion.changelog_body || '');
    const sourceMirrors = sourceVersion.mirrors || parseMirrors(sourceVersion.download_url);
    if (sourceMirrors.length > 0) {
      setMirrors(sourceMirrors.map((m) => ({ ...m })));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName.trim()) {
      alert('Debes ingresar el nombre de la versión (ej: v1.0.0)');
      return;
    }

    const cleanMirrors = mirrors.filter((m) => m.url.trim() !== '');
    const serializedDownloadUrl = serializeMirrors(cleanMirrors);

    const saved: DbGameVersion = {
      ...version,
      game_id: version?.game_id || '',
      version_name: versionName.trim(),
      build_id: buildId.trim() || undefined,
      release_date: releaseDate || undefined,
      is_available: isAvailable,
      download_url: serializedDownloadUrl || undefined,
      changelog_title: changelogTitle.trim() || undefined,
      changelog_body: changelogBody.trim() || undefined,
      mirrors: cleanMirrors,
    };

    onSave(saved);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.82)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10500,
        padding: '20px',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: '720px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          backgroundColor: '#121620',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '18px',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            backgroundColor: '#161B26',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(99,102,241,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818CF8',
              }}
            >
              <Tag size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', color: '#E2E8F0', fontWeight: 700 }}>
                {isEditing ? `Editar Versión: ${version?.version_name}` : 'Crear Nueva Versión'}
              </h3>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                Configura mirrors de descarga, notas de parche y disponibilidad para el cliente desktop
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.4)',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Scrollable */}
        <div style={{ padding: '22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Version Basic Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 600 }}>
                Nombre de Versión *
              </label>
              <input
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                placeholder="v1.2.4 o 1.0.0"
                required
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#E2E8F0',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 600 }}>
                Build ID (Steam)
              </label>
              <input
                value={buildId}
                onChange={(e) => setBuildId(e.target.value)}
                placeholder="14502019"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#E2E8F0',
                  fontSize: '13px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px', fontWeight: 600 }}>
                Fecha de Lanzamiento
              </label>
              <input
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#E2E8F0',
                  fontSize: '13px',
                }}
              />
            </div>
          </div>

          {/* Availability Toggle */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: isAvailable ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)',
              border: isAvailable ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ color: isAvailable ? '#10B981' : 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isAvailable ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {isAvailable ? 'Disponible para Descargar e Instalar en Cliente' : 'Versión Oculta / Solo Histórica'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px' }}>
                Si está activa, los usuarios verán el botón de Descargar e Instalar esta versión directamente.
              </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#10B981' }}
              />
            </label>
          </div>

          {/* Mirrors & Download Links Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={16} style={{ color: '#818CF8' }} />
                <label style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 700 }}>
                  Enlaces de Descarga & Servidores Mirrors ({mirrors.length})
                </label>
              </div>

              {/* Quick Add Provider Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {COMMON_PROVIDERS.slice(0, 4).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handleAddMirror(p)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(99,102,241,0.15)',
                      border: '1px solid rgba(99,102,241,0.3)',
                      color: '#A5B4FC',
                      fontSize: '10px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Plus size={11} /> {p}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
              Puedes configurar múltiples servidores de descarga para esta versión. El cliente utilizará el primero por defecto y ofrecerá los demás como espejos/mirrors.
            </p>

            {/* Mirrors List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mirrors.map((mirror, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '6px',
                      backgroundColor: idx === 0 ? '#6366F1' : 'rgba(255,255,255,0.1)',
                      color: '#FFF',
                      fontSize: '11px',
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    #{idx + 1}
                  </span>

                  {/* Provider Selector / Custom input */}
                  <input
                    value={mirror.provider}
                    onChange={(e) => handleUpdateMirror(idx, 'provider', e.target.value)}
                    placeholder="Proveedor (Google Drive, Mega, etc.)"
                    style={{
                      width: '140px',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F0',
                      fontSize: '12px',
                      fontWeight: 600,
                    }}
                  />

                  {/* URL Input */}
                  <input
                    value={mirror.url}
                    onChange={(e) => handleUpdateMirror(idx, 'url', e.target.value)}
                    placeholder="https://drive.google.com/file/d/... o URL directa del archivo"
                    style={{
                      flex: 1,
                      padding: '7px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F0',
                      fontSize: '12px',
                    }}
                  />

                  {/* Test URL */}
                  {mirror.url && (
                    <a
                      href={mirror.url}
                      target="_blank"
                      rel="noreferrer"
                      title="Probar enlace en nueva pestaña"
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.6)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}

                  {/* Delete mirror */}
                  <button
                    type="button"
                    onClick={() => handleRemoveMirror(idx)}
                    title="Eliminar este mirror"
                    style={{
                      padding: '6px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)',
                      color: '#EF4444',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => handleAddMirror('Mega')}
                style={{
                  alignSelf: 'flex-start',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px dashed rgba(255,255,255,0.15)',
                  color: '#A5B4FC',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '4px',
                }}
              >
                <Plus size={12} /> Añadir Otro Mirror
              </button>
            </div>
          </div>

          {/* Changelog & Patch Notes Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={16} style={{ color: '#818CF8' }} />
                <label style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 700 }}>
                  Notas del Parche / Changelog
                </label>
              </div>

              {/* Clone from other version option */}
              {allExistingVersions.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Clonar de:</span>
                  <select
                    onChange={(e) => {
                      const v = allExistingVersions.find((item) => item.version_name === e.target.value);
                      if (v) handleCloneFrom(v);
                    }}
                    defaultValue=""
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F0',
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  >
                    <option value="" disabled>Seleccionar versión...</option>
                    {allExistingVersions.map((v) => (
                      <option key={v.id || v.version_name} value={v.version_name}>
                        {v.version_name} {v.changelog_title ? `(${v.changelog_title})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                Título del Parche (Opcional)
              </label>
              <input
                value={changelogTitle}
                onChange={(e) => setChangelogTitle(e.target.value)}
                placeholder="Ej: Actualización 1.2 - Mejoras de Rendimiento y Nuevas Misiones"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#E2E8F0',
                  fontSize: '12px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                Detalles del Changelog / Puntos clave
              </label>
              <textarea
                value={changelogBody}
                onChange={(e) => setChangelogBody(e.target.value)}
                rows={4}
                placeholder="- Solucionado error de renderizado en shaders&#10;- Agregado soporte para DLSS 3.5&#10;- Corrección en misiones secundarias"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#E2E8F0',
                  fontSize: '12px',
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 22px',
            backgroundColor: '#161B26',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {isEditing && onDelete && version?.id ? (
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar la versión ${version.version_name}?`)) {
                  onDelete(version.id!);
                  onClose();
                }
              }}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Trash2 size={13} /> Eliminar Versión
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                backgroundColor: '#6366F1',
                border: 'none',
                color: '#FFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(99,102,241,0.4)',
              }}
            >
              {isEditing ? 'Guardar Cambios' : 'Añadir Versión'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
