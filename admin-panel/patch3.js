import fs from 'fs';

const path = './src/components/CatalogManager.tsx';
let content = fs.readFileSync(path, 'utf-8');

// 1. Add DbGameVersion import
content = content.replace(
  "import type { DbGame, RecipeStep, DlcItem } from '../services/supabaseAdmin';",
  "import type { DbGame, RecipeStep, DlcItem, DbGameVersion } from '../services/supabaseAdmin';"
);

// 2. Add gameVersions and versionDlcs state
content = content.replace(
  "const [dlcsList, setDlcsList] = useState<DlcItem[]>([]);",
  "const [dlcsList, setDlcsList] = useState<DlcItem[]>([]);\n  const [gameVersions, setGameVersions] = useState<DbGameVersion[]>([]);\n  const [versionDlcs, setVersionDlcs] = useState<{ [versionId: string]: string[] }>({});\n\n  const uuidv4 = () => {\n    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {\n      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);\n      return v.toString(16);\n    });\n  };"
);

// 3. Reset in openCreateModal
content = content.replace(
  "setDlcsList([]);",
  "setDlcsList([]);\n    setGameVersions([]);\n    setVersionDlcs({});"
);

// 4. Update openEditModal
const editModalRegex = /const rawDlcs = game\.dlcs \|\| \[\];[\s\S]*?setDlcsList\(normalizedDlcs\);/m;
content = content.replace(editModalRegex, `// Fetch master DLCs
    const { data: dlcData } = await supabase.from('dlcs').select('*').eq('game_id', game.id!);
    setDlcsList(dlcData || []);

    // Fetch game_versions
    const { data: versionsData } = await supabase.from('game_versions').select('*').eq('game_id', game.id!).order('created_at', { ascending: false });
    setGameVersions(versionsData || []);

    // Fetch game_version_dlcs
    const versionMap: { [versionId: string]: string[] } = {};
    if (versionsData && versionsData.length > 0) {
      const versionIds = versionsData.map(v => v.id);
      const { data: gvdData } = await supabase.from('game_version_dlcs').select('*').in('game_version_id', versionIds);
      if (gvdData) {
        gvdData.forEach(gvd => {
          if (!versionMap[gvd.game_version_id]) versionMap[gvd.game_version_id] = [];
          versionMap[gvd.game_version_id].push(gvd.dlc_id);
        });
      }
    }
    setVersionDlcs(versionMap);`);

// 5. Update handleAddDlc
content = content.replace(
  "setDlcsList((prev) => [...prev, { name: '', image: '', description: '' }]);",
  "setDlcsList((prev) => [...prev, { id: uuidv4(), name: '' }]);"
);

// 6. Update handleProcessBulkDlcs
content = content.replace(
  "const parsed: DlcItem[] = lines.map((line) => {\n      if (line.includes('=')) {\n        const parts = line.split('=');\n        const appId = parts[0].trim();\n        const dlcName = parts.slice(1).join('=').trim();\n        const isNumeric = /^\\d+$/.test(appId);\n        const imageUrl = isNumeric ? `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg` : '';\n        return {\n          id: isNumeric ? appId : undefined,\n          name: dlcName || line,\n          image: imageUrl,\n          description: ''\n        };\n      }\n      return {\n        name: line,\n        image: '',\n        description: ''\n      };\n    });",
  "const parsed: DlcItem[] = lines.map((line) => {\n      if (line.includes('=')) {\n        const parts = line.split('=');\n        const dlcName = parts.slice(1).join('=').trim();\n        return {\n          id: uuidv4(),\n          name: dlcName || line\n        };\n      }\n      return {\n        id: uuidv4(),\n        name: line\n      };\n    });"
);

// 7. handleSave
const handleSaveDlcsRegex = /const dlcs = dlcsList\.filter\(\(d\) => d\.name\.trim\(\) !== ''\);/;
content = content.replace(handleSaveDlcsRegex, ""); // Remove const dlcs

content = content.replace(
  "is_active: true,\n      dlcs,\n      controller_support: controllerSupport,",
  "is_active: true,\n      controller_support: controllerSupport,"
);

const saveRecipeRegex = /\/\/ Save associated recipe[\s\S]*?if \(recipeErr\) console\.warn\('Aviso al guardar receta:', recipeErr\.message\);\n    }/m;
content = content.replace(saveRecipeRegex, `// Save associated recipe
    if (gameId) {
      const { error: recipeErr } = await supabase
        .from('installation_recipes')
        .upsert(
          { game_id: gameId, steps },
          { onConflict: 'game_id' }
        );

      if (recipeErr) console.warn('Aviso al guardar receta:', recipeErr.message);
    }

    // Save DLCs
    if (gameId) {
      const dlcPayload = dlcsList.filter(d => d.name.trim() !== '').map(d => ({
        id: d.id,
        game_id: gameId,
        name: d.name
      }));
      
      if (dlcPayload.length > 0) {
        const { error: dlcErr } = await supabase
          .from('dlcs')
          .upsert(dlcPayload, { onConflict: 'id' });
        
        if (dlcErr) {
          console.warn('Error saving DLCs', dlcErr);
        } else {
          // Update game_version_dlcs
          if (gameVersions.length > 0) {
            const versionIds = gameVersions.map(v => v.id);
            await supabase.from('game_version_dlcs').delete().in('game_version_id', versionIds);
            
            const gvdPayload: any[] = [];
            Object.entries(versionDlcs).forEach(([vId, dlcIds]) => {
              dlcIds.forEach(dlcId => {
                gvdPayload.push({
                  game_version_id: vId,
                  dlc_id: dlcId
                });
              });
            });
            
            if (gvdPayload.length > 0) {
              const { error: gvdErr } = await supabase.from('game_version_dlcs').insert(gvdPayload);
              if (gvdErr) console.warn('Error saving game_version_dlcs', gvdErr);
            }
          }
        }
      } else {
        // If they cleared all DLCs, we might want to delete them from DB? 
        // We'll leave it simple for now, since it's an admin panel.
      }
    }`);

// 8. Fix DLC tab UI (Remove image/description inputs and add matrix)
// We need to replace the content of:
// {/* DLC Items Cards Scrollable List */} ... all the way to ... </div> </div> 
// Let's use a reliable regex for the `dlcsList.map` part

const dlcUiMapRegex = /\{\/\* DLC Items Cards Scrollable List \*\/\}[\s\S]*?\{\/\* Requirements Settings \*\/\}/m;

const newDlcUi = `{/* DLC Items Cards Scrollable List */}
                    {dlcsList.length === 0 ? (
                      <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                        No hay DLCs agregados a este juego. Usa "Importación Masiva (Pegar Lista)" para pegar tu lista al instante.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                        {dlcsList.map((dlc, idx) => (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.06)',
                              borderRadius: '8px',
                              padding: '12px',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Nombre del DLC"
                                value={dlc.name}
                                onChange={(e) => handleUpdateDlc(idx, 'name', e.target.value)}
                                style={{ width: '100%', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#E2E8F0', fontSize: '13px' }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDlc(idx)}
                              style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.1)', color: '#EF4444', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'background-color 0.2s' }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DLC Matrix UI */}
                  {gameVersions.length > 0 && (
                    <div style={{ marginTop: '24px' }}>
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
                </div>

                {/* Requirements Settings */}`;

content = content.replace(dlcUiMapRegex, newDlcUi);

// Also fix the text tip that mentions Steam ID
content = content.replace(
  "<strong>✨ Tip automático:</strong> Si incluye el AppID numérico de Steam, ¡se obtendrá y asignará automáticamente la imagen oficial de Steam de cada DLC!",
  ""
);

fs.writeFileSync(path, content, 'utf-8');
console.log('Patch 3 successful');
