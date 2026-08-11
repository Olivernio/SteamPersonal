import fs from 'fs';

const path = './src/components/CatalogManager.tsx';
let content = fs.readFileSync(path, 'utf-8');

// The new DLC Map block
const newDlcBlock = `{dlcsList.map((dlc, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'center'
                            }}
                          >
                            {/* Inputs Column */}
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <input
                                value={dlc.name}
                                onChange={(e) => handleUpdateDlc(idx, 'name', e.target.value)}
                                placeholder="Nombre del DLC"
                                style={{ padding: '6px 8px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px', fontWeight: 600 }}
                              />
                            </div>

                            {/* Remove Button */}
                            <button
                              type="button"
                              onClick={() => handleRemoveDlc(idx)}
                              title="Eliminar este DLC"
                              style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer', flexShrink: 0 }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}`;

const oldDlcBlockRegex = /\{dlcsList\.map\(\(dlc, idx\) => \([\s\S]*?\}\)\)\}/;
content = content.replace(oldDlcBlockRegex, newDlcBlock);

const newMatrixBlock = `                  {/* DLC Matrix UI */}
                  {gameVersions.length > 0 && (
                    <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                      <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#E2E8F0', fontWeight: 600 }}>Inclusión en Versiones</h3>
                      <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#CBD5E1' }}>
                          <thead>
                            <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                              <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, minWidth: '150px' }}>Versión</th>
                              {dlcsList.filter(d => d.name.trim() !== '').map((dlc, idx) => (
                                <th key={idx} style={{ padding: '12px', textAlign: 'center', fontWeight: 600, minWidth: '100px' }}>{dlc.name}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {gameVersions.map((version) => (
                              <tr key={version.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '12px', borderRight: '1px solid rgba(255,255,255,0.03)' }}>{version.version_name}</td>
                                {dlcsList.filter(d => d.name.trim() !== '').map((dlc, idx) => {
                                  const isChecked = (versionDlcs[version.id] || []).includes(dlc.id!);
                                  return (
                                    <td key={idx} style={{ padding: '12px', textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          setVersionDlcs(prev => {
                                            const prevSet = prev[version.id] || [];
                                            const newSet = e.target.checked 
                                              ? [...prevSet, dlc.id!]
                                              : prevSet.filter(id => id !== dlc.id!);
                                            return { ...prev, [version.id]: newSet };
                                          });
                                        }}
                                        style={{ cursor: 'pointer', accentColor: '#6366F1', width: '16px', height: '16px' }}
                                      />
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Controller support checkbox */}`;

content = content.replace("{/* Controller support checkbox */}", newMatrixBlock);

fs.writeFileSync(path, content, 'utf-8');
console.log('Patch 5 applied');
