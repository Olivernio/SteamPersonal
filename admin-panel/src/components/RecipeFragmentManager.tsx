import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Edit2, X, Save, Tag, Loader } from 'lucide-react';
import type { RecipeFragment } from '../services/supabaseAdmin';
import {
  fetchRecipeFragments,
  upsertRecipeFragment,
  deleteRecipeFragment,
} from '../services/supabaseAdmin';
import { VisualRecipeBuilder } from './VisualRecipeBuilder';

const EMPTY_FRAGMENT: Omit<RecipeFragment, 'id' | 'created_at' | 'updated_at'> = {
  name: '',
  description: '',
  steps: [],
  tags: [],
};

interface RecipeFragmentManagerProps {
  /** If provided, renders as a floating modal; otherwise inline */
  onClose?: () => void;
  /** Called after save so callers can refresh their fragment list */
  onFragmentsChange?: (fragments: RecipeFragment[]) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  backgroundColor: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.1)',
  color: '#E2E8F0',
  fontSize: '13px',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '4px',
  fontWeight: 600,
};

export const RecipeFragmentManager: React.FC<RecipeFragmentManagerProps> = ({
  onClose,
  onFragmentsChange,
}) => {
  const [fragments, setFragments] = useState<RecipeFragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFragment, setEditingFragment] = useState<Partial<RecipeFragment> | null>(null);
  const [saving, setSaving] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadFragments = useCallback(async () => {
    setLoading(true);
    const data = await fetchRecipeFragments();
    setFragments(data);
    onFragmentsChange?.(data);
    setLoading(false);
  }, [onFragmentsChange]);

  useEffect(() => { loadFragments(); }, [loadFragments]);

  const openCreate = () => {
    setEditingFragment({ ...EMPTY_FRAGMENT });
    setTagsInput('');
  };

  const openEdit = (frag: RecipeFragment) => {
    setEditingFragment({ ...frag });
    setTagsInput(frag.tags.join(', '));
  };

  const closeEdit = () => {
    setEditingFragment(null);
    setTagsInput('');
  };

  const handleSave = async () => {
    if (!editingFragment || !editingFragment.name?.trim()) return;
    setSaving(true);

    const tags = tagsInput
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const result = await upsertRecipeFragment({
      ...(editingFragment.id ? { id: editingFragment.id } : {}),
      name: editingFragment.name.trim(),
      description: editingFragment.description?.trim() ?? '',
      steps: editingFragment.steps ?? [],
      tags,
    });

    if (result) {
      await loadFragments();
      closeEdit();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await deleteRecipeFragment(id);
    if (ok) {
      await loadFragments();
      setDeleteConfirm(null);
    }
  };

  const containerStyle: React.CSSProperties = onClose
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }
    : {};

  const panelStyle: React.CSSProperties = {
    backgroundColor: '#131722',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    width: '100%',
    maxWidth: '820px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <div style={containerStyle}>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={20} style={{ color: '#818CF8' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#E2E8F0' }}>
                Biblioteca de Fragmentos
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                Bloques reutilizables de pasos de instalación
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={openCreate}
              style={{
                padding: '8px 14px', borderRadius: '8px',
                backgroundColor: 'rgba(129,140,248,0.15)',
                border: '1px solid rgba(129,140,248,0.4)',
                color: '#A5B4FC', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Plus size={14} /> Nuevo Fragmento
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflow: 'auto', flex: 1, padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>
              <Loader size={20} style={{ animation: 'spin 1s linear infinite', marginRight: '8px' }} /> Cargando...
            </div>
          ) : fragments.length === 0 ? (
            <div style={{
              padding: '32px', borderRadius: '12px',
              border: '2px dashed rgba(255,255,255,0.08)',
              textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: '13px'
            }}>
              No hay fragmentos. Crea el primero con el botón de arriba.
            </div>
          ) : (
            fragments.map(frag => (
              <div key={frag.id} style={{
                padding: '14px 16px', borderRadius: '10px',
                backgroundColor: '#1E2330',
                border: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px'
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#E2E8F0' }}>{frag.name}</span>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                      {frag.steps.length} paso{frag.steps.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {frag.description && (
                    <p style={{ margin: '0 0 6px', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>{frag.description}</p>
                  )}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {frag.tags.map(t => (
                      <span key={t} style={{
                        padding: '2px 7px', borderRadius: '5px',
                        backgroundColor: 'rgba(129,140,248,0.12)',
                        color: '#818CF8', fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '3px'
                      }}>
                        <Tag size={9} /> {t}
                      </span>
                    ))}
                  </div>
                  {/* Step summary pills */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {frag.steps.map((s, i) => (
                      <span key={i} style={{
                        padding: '2px 7px', borderRadius: '5px',
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,255,255,0.45)', fontSize: '10px'
                      }}>
                        {s.action}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => openEdit(frag)}
                    style={{
                      padding: '6px 10px', borderRadius: '7px',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#CBD5E1', cursor: 'pointer', fontSize: '11px',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                  {deleteConfirm === frag.id ? (
                    <>
                      <button type="button" onClick={() => handleDelete(frag.id!)} style={{ padding: '6px 10px', borderRadius: '7px', backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', cursor: 'pointer', fontSize: '11px' }}>Confirmar</button>
                      <button type="button" onClick={() => setDeleteConfirm(null)} style={{ padding: '6px 10px', borderRadius: '7px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '11px' }}>Cancelar</button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(frag.id!)}
                      style={{
                        padding: '6px', borderRadius: '7px',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.2)',
                        color: '#F87171', cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit/Create sub-modal */}
      {editingFragment && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 210,
          backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#131722', borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            width: '100%', maxWidth: '680px', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Sub-modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0
            }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#E2E8F0' }}>
                {editingFragment.id ? 'Editar Fragmento' : 'Nuevo Fragmento'}
              </h4>
              <button type="button" onClick={closeEdit} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* Sub-modal body */}
            <div style={{ overflow: 'auto', flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Nombre del Fragmento *</label>
                <input
                  style={inputStyle}
                  value={editingFragment.name ?? ''}
                  onChange={e => setEditingFragment(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Limpieza DODI Standard"
                />
              </div>
              <div>
                <label style={labelStyle}>Descripción (interna, solo admin)</label>
                <input
                  style={inputStyle}
                  value={editingFragment.description ?? ''}
                  onChange={e => setEditingFragment(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Ej: Elimina _Redist y .url de repacks DODI - verificado VirusTotal"
                />
              </div>
              <div>
                <label style={labelStyle}>Tags (separados por coma)</label>
                <input
                  style={inputStyle}
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder="dodi, cleanup, repack"
                />
              </div>

              {/* Steps builder */}
              <div style={{ paddingTop: '4px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <VisualRecipeBuilder
                  steps={editingFragment.steps ?? []}
                  onChange={steps => setEditingFragment(prev => ({ ...prev, steps }))}
                />
              </div>
            </div>

            {/* Sub-modal footer */}
            <div style={{
              padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0
            }}>
              <button type="button" onClick={closeEdit} style={{ padding: '9px 18px', borderRadius: '9px', backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '13px' }}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !editingFragment.name?.trim()}
                style={{
                  padding: '9px 18px', borderRadius: '9px',
                  backgroundColor: saving || !editingFragment.name?.trim() ? 'rgba(129,140,248,0.3)' : '#6366F1',
                  border: 'none', color: '#fff', cursor: saving ? 'wait' : 'pointer',
                  fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {saving ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {saving ? 'Guardando...' : 'Guardar Fragmento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
