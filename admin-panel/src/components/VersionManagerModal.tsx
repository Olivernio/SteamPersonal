import React, { useState, useEffect } from 'react';
import type { DbGameVersion, DownloadMirror, VersionMirror, RecipeFragment } from '../services/supabaseAdmin';
import { parseMirrors, serializeMirrors, fetchVersionMirrors, fetchRecipeFragments } from '../services/supabaseAdmin';
import { fetchSteamDbPatchnotes, normalizeVersionKey, type SteamDbBuildItem } from '../services/steamService';
import { VisualRecipeBuilder } from './VisualRecipeBuilder';
import { Plus, Trash2, ExternalLink, FileText, CheckCircle2, XCircle, Tag, Server, Sparkles, RefreshCw, ChevronDown, ChevronUp, BookOpen, StickyNote } from 'lucide-react';

interface VersionManagerModalProps {
  version: DbGameVersion | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (savedVersion: DbGameVersion) => void;
  onDelete?: (versionId: string) => void;
  allExistingVersions?: DbGameVersion[];
  steamAppId?: string | number;
}

const COMMON_PROVIDERS = ['Google Drive', 'Gofile', 'Mega', 'Mediafire', '1Fichier', 'Servidor Directo', 'Torrent'];

export const VersionManagerModal: React.FC<VersionManagerModalProps> = ({
  version,
  isOpen,
  onClose,
  onSave,
  onDelete,
  allExistingVersions = [],
  steamAppId,
}) => {
  if (!isOpen) return null;

  const isEditing = Boolean(version && (version.id || version.version_name));

  const [versionName, setVersionName] = useState(version?.version_name || '');
  const [buildId, setBuildId] = useState(version?.build_id || '');
  const [releaseDate, setReleaseDate] = useState(version?.release_date || new Date().toISOString().split('T')[0]);
  const [isAvailable, setIsAvailable] = useState(version?.is_available ?? true);
  const [changelogTitle, setChangelogTitle] = useState(version?.changelog_title || '');
  const [changelogBody, setChangelogBody] = useState(version?.changelog_body || '');

  // SteamDB Autocomplete state
  const [loadingSteamDb, setLoadingSteamDb] = useState(false);
  const [steamDbBuilds, setSteamDbBuilds] = useState<SteamDbBuildItem[]>([]);
  const [showSteamDbPicker, setShowSteamDbPicker] = useState(false);

  const handleFetchSteamDbBuilds = async () => {
    const cleanAppId = String(steamAppId || '').trim();
    if (!cleanAppId) {
      alert('Ingresa primero el Steam AppID en la pestaña 1 (Información) para consultar SteamDB.');
      return;
    }

    setLoadingSteamDb(true);
    try {
      const builds = await fetchSteamDbPatchnotes(cleanAppId);
      if (builds.length === 0) {
        alert('No se encontraron builds en SteamDB para este Steam AppID.');
        return;
      }

      setSteamDbBuilds(builds);
      setShowSteamDbPicker(true);

      // Auto-match if user already typed a version name
      if (versionName.trim()) {
        const normKey = normalizeVersionKey(versionName);
        const match = builds.find((b) => normalizeVersionKey(b.versionName) === normKey);
        if (match) {
          setBuildId(match.buildId);
          if (match.releaseDate) setReleaseDate(match.releaseDate);
          if (!changelogTitle) setChangelogTitle(match.rawTitle);
          if (!changelogBody) setChangelogBody(match.description);
          alert(`¡Build ID ${match.buildId} encontrado y autocompletado para la versión ${versionName}!`);
        }
      }
    } catch (err: any) {
      alert(`Error al consultar SteamDB: ${err.message}`);
    } finally {
      setLoadingSteamDb(false);
    }
  };

  const handleSelectSteamDbBuild = (build: SteamDbBuildItem) => {
    setBuildId(build.buildId);
    if (!versionName || versionName === 'v1.0.0') {
      setVersionName(build.versionName);
    }
    if (build.releaseDate) {
      setReleaseDate(build.releaseDate);
    }
    if (!changelogTitle) {
      setChangelogTitle(build.rawTitle);
    }
    if (!changelogBody) {
      setChangelogBody(build.description);
    }
    setShowSteamDbPicker(false);
  };

  // VersionMirror state (new per-mirror recipe system)
  const [mirrors, setMirrors] = useState<VersionMirror[]>(() => {
    // Prefer the relational version_mirrors if already loaded
    if (version?.version_mirrors && version.version_mirrors.length > 0) {
      return version.version_mirrors;
    }
    // Fallback: migrate from legacy download_url / mirrors
    const legacyMirrors: DownloadMirror[] =
      (version?.mirrors && version.mirrors.length > 0)
        ? version.mirrors.filter((m) => m.url && m.url.trim() !== '')
        : parseMirrors(version?.download_url).filter((m) => m.url && m.url.trim() !== '');
    return legacyMirrors.map((m, idx) => ({
      game_version_id: version?.id ?? '',
      provider: m.provider,
      url: m.url,
      display_order: idx,
      recipe_mode: 'inherit' as const,
      recipe_steps: null,
    }));
  });

  const [expandedMirrorIdx, setExpandedMirrorIdx] = useState<number | null>(null);
  const [fragments, setFragments] = useState<RecipeFragment[]>([]);

  // Load fragments once on mount (for the fragment picker in VisualRecipeBuilder)
  useEffect(() => {
    fetchRecipeFragments().then(setFragments);
  }, []);

  // If version already has DB mirrors, fetch them (async update after initial render)
  useEffect(() => {
    if (version?.id && !version.version_mirrors) {
      fetchVersionMirrors(version.id).then((dbMirrors) => {
        if (dbMirrors.length > 0) setMirrors(dbMirrors);
      });
    }
  }, [version?.id]);

  const handleAddMirror = (provider = 'Google Drive') => {
    setMirrors((prev) => [
      ...prev,
      {
        game_version_id: version?.id ?? '',
        provider,
        url: '',
        display_order: prev.length,
        recipe_mode: 'inherit',
        recipe_steps: null,
      },
    ]);
  };

  const handleUpdateMirrorField = <K extends keyof VersionMirror>(idx: number, field: K, val: VersionMirror[K]) => {
    setMirrors((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      // When switching to 'inherit', clear custom steps
      if (field === 'recipe_mode' && val === 'inherit') {
        copy[idx].recipe_steps = null;
      }
      // When switching to 'override', initialize with empty steps
      if (field === 'recipe_mode' && val === 'override' && !copy[idx].recipe_steps) {
        copy[idx].recipe_steps = [];
      }
      return copy;
    });
  };

  const handleRemoveMirror = (idx: number) => {
    setMirrors((prev) => prev.filter((_, i) => i !== idx));
    if (expandedMirrorIdx === idx) setExpandedMirrorIdx(null);
  };

  const handleCloneFrom = (sourceVersion: DbGameVersion) => {
    setChangelogTitle(sourceVersion.changelog_title || '');
    setChangelogBody(sourceVersion.changelog_body || '');
    const sourceMirrors: DownloadMirror[] = sourceVersion.mirrors || parseMirrors(sourceVersion.download_url);
    if (sourceMirrors.length > 0) {
      setMirrors(sourceMirrors.map((m, idx) => ({
        game_version_id: version?.id ?? '',
        provider: m.provider,
        url: m.url,
        display_order: idx,
        recipe_mode: 'inherit' as const,
        recipe_steps: null,
      })));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionName.trim()) {
      alert('Debes ingresar el nombre de la versión (ej: v1.0.0)');
      return;
    }

    const cleanMirrors = mirrors.filter((m) => m.url.trim() !== '');
    // Legacy serialization for download_url (backwards compat with frontend)
    const serializedDownloadUrl = serializeMirrors(
      cleanMirrors.map((m) => ({ provider: m.provider, url: m.url }))
    );

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
      mirrors: cleanMirrors.map((m) => ({ provider: m.provider, url: m.url })),
      version_mirrors: cleanMirrors,
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                  Build ID (Steam)
                </label>
                <button
                  type="button"
                  onClick={handleFetchSteamDbBuilds}
                  disabled={loadingSteamDb}
                  title="Consultar SteamDB para autocompletar el Build ID"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#818CF8',
                    fontSize: '11px',
                    fontWeight: 700,
                    cursor: loadingSteamDb ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0 2px',
                  }}
                >
                  {loadingSteamDb ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                  <span>{loadingSteamDb ? 'Buscando...' : 'SteamDB'}</span>
                </button>
              </div>
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

          {/* SteamDB Suggestions Picker */}
          {showSteamDbPicker && steamDbBuilds.length > 0 && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                backgroundColor: 'rgba(99,102,241,0.08)',
                border: '1px solid rgba(99,102,241,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#A5B4FC', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Sparkles size={12} /> Builds detectadas en SteamDB ({steamDbBuilds.length}) — Haz clic para aplicar:
                </span>
                <button
                  type="button"
                  onClick={() => setShowSteamDbPicker(false)}
                  style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer' }}
                >
                  Ocultar ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
                {steamDbBuilds.map((b) => (
                  <button
                    key={b.buildId}
                    type="button"
                    onClick={() => handleSelectSteamDbBuild(b)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '7px',
                      backgroundColor: buildId === b.buildId ? '#6366F1' : 'rgba(255,255,255,0.06)',
                      border: '1px solid ' + (buildId === b.buildId ? '#818CF8' : 'rgba(255,255,255,0.1)'),
                      color: '#FFF',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    title={`${b.rawTitle}\n${b.description}`}
                  >
                    <span style={{ fontWeight: 800, color: buildId === b.buildId ? '#FFF' : '#A5B4FC' }}>
                      Build {b.buildId}
                    </span>
                    <span style={{ opacity: 0.75 }}>({b.versionName})</span>
                    <span style={{ opacity: 0.5, fontSize: '10px' }}>{b.releaseDate}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

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
                  Mirrors / Links ({mirrors.length})
                </label>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {COMMON_PROVIDERS.slice(0, 4).map((p) => (
                  <button key={p} type="button" onClick={() => handleAddMirror(p)}
                    style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC', fontSize: '10px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={11} /> {p}
                  </button>
                ))}
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
              Cada mirror puede heredar la receta base del juego o tener su propia receta de instalación (para repacks con carpetas spam, cracks distintos, etc.).
            </p>

            {/* Mirrors List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mirrors.length === 0 ? (
                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                  Sin mirrors configurados. Usa los botones de arriba para agregar uno.
                </div>
              ) : (
                mirrors.map((mirror, idx) => {
                  const isExpanded = expandedMirrorIdx === idx;
                  const hasOverride = mirror.recipe_mode === 'override';
                  return (
                    <div key={idx} style={{ borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: `1px solid ${hasOverride ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`, overflow: 'hidden' }}>
                      {/* Mirror header row */}
                      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '5px', backgroundColor: idx === 0 ? '#6366F1' : 'rgba(255,255,255,0.1)', color: '#FFF', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          #{idx + 1}
                        </span>

                        {/* Provider */}
                        <input
                          value={mirror.provider}
                          onChange={(e) => handleUpdateMirrorField(idx, 'provider', e.target.value)}
                          placeholder="Proveedor (DODI, FitGirl, etc.)"
                          style={{ width: '130px', padding: '6px 9px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px', fontWeight: 600 }}
                        />

                        {/* URL */}
                        <input
                          value={mirror.url}
                          onChange={(e) => handleUpdateMirrorField(idx, 'url', e.target.value)}
                          placeholder="https://drive.google.com/..."
                          style={{ flex: 1, minWidth: '150px', padding: '6px 9px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                        />

                        {/* Recipe mode toggle */}
                        <button
                          type="button"
                          onClick={() => handleUpdateMirrorField(idx, 'recipe_mode', hasOverride ? 'inherit' : 'override')}
                          title={hasOverride ? 'Usando receta propia — clic para heredar la base' : 'Heredando receta base — clic para personalizar'}
                          style={{ padding: '5px 10px', borderRadius: '6px', backgroundColor: hasOverride ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${hasOverride ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'}`, color: hasOverride ? '#FCD34D' : 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <BookOpen size={11} />
                          {hasOverride ? 'Receta propia' : 'Hereda base'}
                        </button>

                        {/* Expand / notes toggle */}
                        <button
                          type="button"
                          onClick={() => setExpandedMirrorIdx(isExpanded ? null : idx)}
                          title={isExpanded ? 'Contraer' : 'Expandir (receta + notas)'}
                          style={{ padding: '5px 7px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                        >
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>

                        {/* Test link */}
                        {mirror.url && (
                          <a href={mirror.url} target="_blank" rel="noreferrer" title="Abrir en nueva pestaña"
                            style={{ padding: '5px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center' }}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}

                        {/* Delete */}
                        <button type="button" onClick={() => handleRemoveMirror(idx)}
                          style={{ padding: '5px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>

                      {/* Expanded: notes + recipe */}
                      {isExpanded && (
                        <div style={{ padding: '10px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {/* Notes field */}
                          <div>
                            <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                              <StickyNote size={11} /> Notas internas (VirusTotal, advertencias, grupo del repack...)
                            </label>
                            <input
                              value={mirror.notes ?? ''}
                              onChange={(e) => handleUpdateMirrorField(idx, 'notes', e.target.value)}
                              placeholder="Ej: DODI — verificado VirusTotal 2026-08, eliminar _Redist"
                              style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', color: '#E2E8F0', fontSize: '12px' }}
                            />
                          </div>

                          {/* Recipe section (only when override) */}
                          {hasOverride ? (
                            <div style={{ backgroundColor: 'rgba(245,158,11,0.04)', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.15)', padding: '12px' }}>
                              <div style={{ fontSize: '11px', color: '#FCD34D', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <BookOpen size={12} /> Receta Personalizada de este Mirror
                              </div>
                              <VisualRecipeBuilder
                                steps={mirror.recipe_steps ?? []}
                                onChange={(steps) => handleUpdateMirrorField(idx, 'recipe_steps', steps)}
                                fragments={fragments}
                              />
                            </div>
                          ) : (
                            <div style={{ padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: '12px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <BookOpen size={13} style={{ flexShrink: 0 }} />
                              Este mirror heredará la receta base del juego. Activa <strong style={{ color: '#FCD34D' }}>"Receta propia"</strong> para personalizarla.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              <button type="button" onClick={() => handleAddMirror()}
                style={{ alignSelf: 'flex-start', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)', color: '#A5B4FC', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}
              >
                <Plus size={12} /> Añadir Mirror
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
