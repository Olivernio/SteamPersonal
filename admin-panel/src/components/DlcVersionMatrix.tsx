import React, { useState, useMemo } from 'react';
import type { DbGameVersion, DlcItem } from '../services/supabaseAdmin';
import { Package, Search, CheckSquare, Square, Copy, Layers } from 'lucide-react';

interface DlcVersionMatrixProps {
  versions: DbGameVersion[];
  dlcs: DlcItem[];
  versionDlcs: { [versionId: string]: string[] };
  onChangeVersionDlcs: (newMap: { [versionId: string]: string[] }) => void;
}

export const DlcVersionMatrix: React.FC<DlcVersionMatrixProps> = ({
  versions,
  dlcs,
  versionDlcs,
  onChangeVersionDlcs,
}) => {
  const [search, setSearch] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>(() => {
    return versions[0]?.id || versions[0]?.version_name || '';
  });
  const [viewMode, setViewMode] = useState<'card' | 'matrix'>('card');

  // Filtered DLCs
  const filteredDlcs = useMemo(() => {
    if (!search.trim()) return dlcs;
    const q = search.toLowerCase();
    return dlcs.filter((d) => d.name.toLowerCase().includes(q));
  }, [dlcs, search]);

  if (versions.length === 0) {
    return (
      <div
        style={{
          padding: '28px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.1)',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '13px',
        }}
      >
        <Layers size={28} style={{ margin: '0 auto 8px', color: 'rgba(99,102,241,0.4)' }} />
        No hay versiones registradas aún. Añade al menos una versión en la pestaña de Versiones para poder asociarle DLCs.
      </div>
    );
  }

  if (dlcs.length === 0) {
    return (
      <div
        style={{
          padding: '28px',
          borderRadius: '12px',
          backgroundColor: 'rgba(255,255,255,0.02)',
          border: '1px dashed rgba(255,255,255,0.1)',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '13px',
        }}
      >
        <Package size={28} style={{ margin: '0 auto 8px', color: 'rgba(99,102,241,0.4)' }} />
        No hay DLCs agregados en el catálogo de este juego. Agrega DLCs arriba con "Añadir Uno" o "Importación Masiva" para asociarlos a cada versión.
      </div>
    );
  }

  const currentVersionKey = selectedVersionId || versions[0]?.id || versions[0]?.version_name || '';
  const currentIncludedDlcIds = versionDlcs[currentVersionKey] || [];

  const handleToggleDlc = (versionKey: string, dlcId: string) => {
    const current = versionDlcs[versionKey] || [];
    const updated = current.includes(dlcId)
      ? current.filter((id) => id !== dlcId)
      : [...current, dlcId];

    onChangeVersionDlcs({
      ...versionDlcs,
      [versionKey]: updated,
    });
  };

  const handleSelectAllForVersion = (versionKey: string) => {
    const allDlcIds = dlcs.filter((d) => d.id).map((d) => d.id!);
    onChangeVersionDlcs({
      ...versionDlcs,
      [versionKey]: allDlcIds,
    });
  };

  const handleDeselectAllForVersion = (versionKey: string) => {
    onChangeVersionDlcs({
      ...versionDlcs,
      [versionKey]: [],
    });
  };

  const handleCopyFromOtherVersion = (targetVersionKey: string, sourceVersionKey: string) => {
    if (!sourceVersionKey || targetVersionKey === sourceVersionKey) return;
    const sourceDlcs = versionDlcs[sourceVersionKey] || [];
    onChangeVersionDlcs({
      ...versionDlcs,
      [targetVersionKey]: [...sourceDlcs],
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={16} style={{ color: '#818CF8' }} />
          <h4 style={{ margin: 0, fontSize: '14px', color: '#E2E8F0', fontWeight: 700 }}>
            Asignación de DLCs por Versión
          </h4>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(99,102,241,0.15)',
              color: '#A5B4FC',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {dlcs.length} DLCs totales
          </span>
        </div>

        {/* View Mode Toggle & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Search box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.1)',
              width: '200px',
            }}
          >
            <Search size={13} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar DLC..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#E2E8F0',
                fontSize: '11px',
                width: '100%',
              }}
            />
          </div>

          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              type="button"
              onClick={() => setViewMode('card')}
              style={{
                padding: '6px 10px',
                backgroundColor: viewMode === 'card' ? '#6366F1' : 'rgba(255,255,255,0.04)',
                color: '#FFF',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Por Versión
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              style={{
                padding: '6px 10px',
                backgroundColor: viewMode === 'matrix' ? '#6366F1' : 'rgba(255,255,255,0.04)',
                color: '#FFF',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Matriz Completa
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'card' ? (
        /* CARD / VERSION SELECTOR VIEW (Super comfortable for large DLC lists) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Version Pills Bar */}
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
            {versions.map((v) => {
              const vKey = v.id || v.version_name;
              const count = (versionDlcs[vKey] || []).length;
              const isSelected = currentVersionKey === vKey;

              return (
                <button
                  key={vKey}
                  type="button"
                  onClick={() => setSelectedVersionId(vKey)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '10px',
                    backgroundColor: isSelected ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.03)',
                    border: isSelected ? '1px solid #6366F1' : '1px solid rgba(255,255,255,0.08)',
                    color: isSelected ? '#FFF' : 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{v.version_name}</span>
                  <span
                    style={{
                      padding: '1px 6px',
                      borderRadius: '10px',
                      backgroundColor: count > 0 ? '#10B981' : 'rgba(255,255,255,0.1)',
                      color: '#FFF',
                      fontSize: '10px',
                      fontWeight: 800,
                    }}
                  >
                    {count} DLCs
                  </span>
                </button>
              );
            })}
          </div>

          {/* Controls Bar for Active Version */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#A5B4FC', fontWeight: 700 }}>
                {versions.find((v) => (v.id || v.version_name) === currentVersionKey)?.version_name || 'Versión Seleccionada'}:
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                {currentIncludedDlcIds.length} de {dlcs.length} DLCs activados en esta versión
              </span>
            </div>

            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => handleSelectAllForVersion(currentVersionKey)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16,185,129,0.15)',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#6EE7B7',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <CheckSquare size={12} /> Marcar Todos
              </button>

              <button
                type="button"
                onClick={() => handleDeselectAllForVersion(currentVersionKey)}
                style={{
                  padding: '5px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: '#FCA5A5',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Square size={12} /> Desmarcar Todos
              </button>

              {/* Copy from another version */}
              {versions.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
                  <Copy size={12} style={{ color: 'rgba(255,255,255,0.4)' }} />
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleCopyFromOtherVersion(currentVersionKey, e.target.value);
                        e.target.value = '';
                      }
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
                      cursor: 'pointer',
                    }}
                  >
                    <option value="" disabled>Copiar DLCs de...</option>
                    {versions
                      .filter((v) => (v.id || v.version_name) !== currentVersionKey)
                      .map((v) => (
                        <option key={v.id || v.version_name} value={v.id || v.version_name}>
                          {v.version_name} ({(versionDlcs[v.id || v.version_name] || []).length} DLCs)
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* DLCs Interactive Checklist Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: '8px',
              maxHeight: '320px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {filteredDlcs.map((dlc) => {
              const isChecked = Boolean(dlc.id && currentIncludedDlcIds.includes(dlc.id));

              return (
                <div
                  key={dlc.id || dlc.name}
                  onClick={() => dlc.id && handleToggleDlc(currentVersionKey, dlc.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: isChecked ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.02)',
                    border: isChecked ? '1px solid rgba(99,102,241,0.35)' : '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    style={{
                      width: '15px',
                      height: '15px',
                      accentColor: '#6366F1',
                      cursor: 'pointer',
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12px',
                      color: isChecked ? '#FFF' : 'rgba(255,255,255,0.6)',
                      fontWeight: isChecked ? 600 : 400,
                      lineHeight: '1.3',
                      wordBreak: 'break-word',
                    }}
                  >
                    {dlc.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* FULL MATRIX TABLE VIEW */
        <div
          style={{
            backgroundColor: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            overflow: 'hidden',
            overflowX: 'auto',
            maxHeight: '360px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#E2E8F0' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#161B26', zIndex: 10 }}>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, minWidth: '180px' }}>
                  DLC ({filteredDlcs.length})
                </th>
                {versions.map((v) => {
                  const vKey = v.id || v.version_name;
                  const count = (versionDlcs[vKey] || []).length;
                  return (
                    <th key={vKey} style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700, minWidth: '100px' }}>
                      <div>{v.version_name}</div>
                      <div style={{ fontSize: '10px', color: '#10B981', fontWeight: 600 }}>{count} DLCs</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredDlcs.map((dlc, idx) => (
                <tr
                  key={dlc.id || idx}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <td style={{ padding: '8px 14px', fontWeight: 500, color: 'rgba(255,255,255,0.85)' }}>
                    {dlc.name}
                  </td>
                  {versions.map((v) => {
                    const vKey = v.id || v.version_name;
                    const isChecked = Boolean(dlc.id && (versionDlcs[vKey] || []).includes(dlc.id));

                    return (
                      <td key={vKey} style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => dlc.id && handleToggleDlc(vKey, dlc.id)}
                          style={{
                            width: '16px',
                            height: '16px',
                            accentColor: '#6366F1',
                            cursor: 'pointer',
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
