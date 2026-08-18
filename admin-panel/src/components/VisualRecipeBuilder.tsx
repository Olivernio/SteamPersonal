import React, { useState } from 'react';
import { Download, Shield, Copy, ExternalLink, Plus, Trash2, ArrowUp, ArrowDown, FolderMinus, BookOpen, X, ChevronDown } from 'lucide-react';
import type { RecipeStep, RecipeFragment } from '../services/supabaseAdmin';

interface VisualRecipeBuilderProps {
  steps: RecipeStep[];
  onChange: (steps: RecipeStep[]) => void;
  defaultDownloadUrl?: string;
  defaultTitle?: string;
  /** Optional list of reusable recipe fragments to insert */
  fragments?: RecipeFragment[];
}

export const VisualRecipeBuilder: React.FC<VisualRecipeBuilderProps> = ({
  steps,
  onChange,
  defaultDownloadUrl = '',
  defaultTitle = '',
  fragments = []
}) => {
  const [fragmentPickerOpen, setFragmentPickerOpen] = useState(false);
  const addStep = (actionType: string) => {
    let newStep: RecipeStep = { action: actionType };

    switch (actionType) {
      case 'stream_extract':
        newStep = {
          action: 'stream_extract',
          provider: 'GoogleDrive',
          url: defaultDownloadUrl
        };
        break;
      case 'add_defender_exclusion':
        newStep = {
          action: 'add_defender_exclusion',
          path: '{INSTALL_DIR}'
        };
        break;
      case 'apply_crack':
        newStep = {
          action: 'apply_crack',
          source_folder: '{INSTALL_DIR}/Engine/Binaries/ThirdParty/Steamworks/Steamv157/Win64/steam_settings',
          target_folder: '{INSTALL_DIR}'
        };
        break;
      case 'create_shortcut':
        newStep = {
          action: 'create_shortcut',
          shortcut_name: defaultTitle || 'Juego'
        };
        break;
      case 'cleanup':
        newStep = {
          action: 'cleanup',
          path: '{INSTALL_DIR}/'
        };
        break;
    }

    onChange([...steps, newStep]);
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= steps.length) return;

    const newSteps = [...steps];
    const temp = newSteps[index];
    newSteps[index] = newSteps[targetIndex];
    newSteps[targetIndex] = temp;
    onChange(newSteps);
  };

  const updateStepField = (index: number, field: keyof RecipeStep, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    onChange(newSteps);
  };

  const insertFragment = (fragment: RecipeFragment) => {
    onChange([...steps, ...fragment.steps]);
    setFragmentPickerOpen(false);
  };

  const getStepIcon = (action: string) => {
    switch (action) {
      case 'stream_extract': return <Download size={16} style={{ color: '#60A5FA' }} />;
      case 'add_defender_exclusion': return <Shield size={16} style={{ color: '#F59E0B' }} />;
      case 'apply_crack': return <Copy size={16} style={{ color: '#A78BFA' }} />;
      case 'create_shortcut': return <ExternalLink size={16} style={{ color: '#34D399' }} />;
      case 'cleanup': case 'delete_files': return <FolderMinus size={16} style={{ color: '#F87171' }} />;
      default: return <Download size={16} />;
    }
  };

  const getStepTitle = (action: string) => {
    switch (action) {
      case 'stream_extract': return 'Descarga y Extracción en Vivo';
      case 'add_defender_exclusion': return 'Exclusión en Windows Defender';
      case 'apply_crack': return 'Aplicar Medicina / Parche';
      case 'create_shortcut': return 'Crear Acceso Directo';
      case 'cleanup': case 'delete_files': return 'Limpieza / Eliminar Archivos';
      default: return action;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#E2E8F0' }}>
          Pasos de la Receta ({steps.length})
        </h4>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => addStep('stream_extract')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.3)',
              color: '#93C5FD',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={12} /> Descarga
          </button>

          <button
            type="button"
            onClick={() => addStep('add_defender_exclusion')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(245,158,11,0.15)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#FDE047',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={12} /> Defender
          </button>

          <button
            type="button"
            onClick={() => addStep('apply_crack')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(167,139,250,0.15)',
              border: '1px solid rgba(167,139,250,0.3)',
              color: '#C4B5FD',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={12} /> Parche
          </button>

          <button
            type="button"
            onClick={() => addStep('create_shortcut')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(52,211,153,0.15)',
              border: '1px solid rgba(52,211,153,0.3)',
              color: '#6EE7B7',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={12} /> Acceso Directo
          </button>

          <button
            type="button"
            onClick={() => addStep('cleanup')}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              backgroundColor: 'rgba(248,113,113,0.15)',
              border: '1px solid rgba(248,113,113,0.3)',
              color: '#FCA5A5',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Plus size={12} /> Limpieza
          </button>

          {/* Fragment picker button (only shown if fragments are available) */}
          {fragments.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setFragmentPickerOpen(prev => !prev)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(129,140,248,0.15)',
                  border: '1px solid rgba(129,140,248,0.4)',
                  color: '#A5B4FC',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <BookOpen size={12} /> Fragmento <ChevronDown size={10} />
              </button>

              {fragmentPickerOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '4px',
                  zIndex: 50,
                  backgroundColor: '#1A1F2E',
                  border: '1px solid rgba(129,140,248,0.3)',
                  borderRadius: '10px',
                  padding: '6px',
                  minWidth: '240px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#A5B4FC' }}>Fragmentos disponibles</span>
                    <button type="button" onClick={() => setFragmentPickerOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                  </div>
                  {fragments.map(frag => (
                    <button
                      key={frag.id}
                      type="button"
                      onClick={() => insertFragment(frag)}
                      title={frag.description}
                      style={{
                        textAlign: 'left',
                        padding: '7px 10px',
                        borderRadius: '7px',
                        background: 'transparent',
                        border: '1px solid transparent',
                        color: '#CBD5E1',
                        cursor: 'pointer',
                        fontSize: '12px',
                        transition: 'all 0.15s'
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(129,140,248,0.1)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(129,140,248,0.2)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'; }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: '2px' }}>{frag.name}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {frag.tags.map(t => <span key={t} style={{ padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(129,140,248,0.15)', color: '#818CF8' }}>{t}</span>)}
                        <span style={{ color: 'rgba(255,255,255,0.25)' }}>• {frag.steps.length} paso{frag.steps.length !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {steps.length === 0 ? (
        <div
          style={{
            padding: '24px',
            borderRadius: '12px',
            border: '2px dashed rgba(255,255,255,0.1)',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '13px'
          }}
        >
          No hay pasos configurados. Haz clic en los botones de arriba para agregar acciones a la receta.
        </div>
      ) : (
        steps.map((step, idx) => (
          <div
            key={idx}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              backgroundColor: '#1E2330',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {/* Step header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getStepIcon(step.action)}
                <span style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>
                  Paso {idx + 1}: {getStepTitle(step.action)}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveStep(idx, 'up')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: idx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
                    cursor: idx === 0 ? 'default' : 'pointer',
                    padding: '2px'
                  }}
                >
                  <ArrowUp size={14} />
                </button>

                <button
                  type="button"
                  disabled={idx === steps.length - 1}
                  onClick={() => moveStep(idx, 'down')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: idx === steps.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.5)',
                    cursor: idx === steps.length - 1 ? 'default' : 'pointer',
                    padding: '2px'
                  }}
                >
                  <ArrowDown size={14} />
                </button>

                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#EF4444',
                    cursor: 'pointer',
                    padding: '2px',
                    marginLeft: '6px'
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Action specific fields */}
            {step.action === 'stream_extract' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>Proveedor</label>
                  <input
                    value={step.provider || 'GoogleDrive'}
                    onChange={(e) => updateStepField(idx, 'provider', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F0',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>URL de Descarga</label>
                  <input
                    value={step.url || ''}
                    onChange={(e) => updateStepField(idx, 'url', e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F0',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            )}

            {step.action === 'add_defender_exclusion' && (
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>Ruta a Excluir</label>
                <input
                  value={step.path || '{INSTALL_DIR}'}
                  onChange={(e) => updateStepField(idx, 'path', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#E2E8F0',
                    fontSize: '12px'
                  }}
                />
              </div>
            )}

            {step.action === 'apply_crack' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>Carpeta Origen</label>
                  <input
                    value={step.source_folder || ''}
                    onChange={(e) => updateStepField(idx, 'source_folder', e.target.value)}
                    placeholder="{INSTALL_DIR}/Engine/..."
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F0',
                      fontSize: '12px'
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>Carpeta Destino</label>
                  <input
                    value={step.target_folder || '{INSTALL_DIR}'}
                    onChange={(e) => updateStepField(idx, 'target_folder', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#E2E8F0',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>
            )}

            {(step.action === 'cleanup' || step.action === 'delete_files') && (
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>Ruta a Eliminar (acepta wildcards: *.url, *.nfo)</label>
                <input
                  value={step.path || ''}
                  onChange={(e) => updateStepField(idx, 'path', e.target.value)}
                  placeholder="{INSTALL_DIR}/_Redist"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(248,113,113,0.25)',
                    color: '#E2E8F0',
                    fontSize: '12px'
                  }}
                />
              </div>
            )}

            {step.action === 'create_shortcut' && (
              <div>
                <label style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', display: 'block', marginBottom: '2px' }}>Nombre del Acceso Directo</label>
                <input
                  value={step.shortcut_name || ''}
                  onChange={(e) => updateStepField(idx, 'shortcut_name', e.target.value)}
                  placeholder="Librarian: Tidy Up..."
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#E2E8F0',
                    fontSize: '12px'
                  }}
                />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};
