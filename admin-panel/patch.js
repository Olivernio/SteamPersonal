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
  "name: dlcName || line,\n          image: imageUrl,\n          description: ''",
  "id: uuidv4(),\n          name: dlcName || line"
);
content = content.replace(
  "name: line,\n        image: '',\n        description: ''",
  "id: uuidv4(),\n        name: line"
);

// 7. handleSave remove dlcs from gamePayload
content = content.replace(
  "is_active: true,\n      dlcs,\n      controller_support: controllerSupport,",
  "is_active: true,\n      controller_support: controllerSupport,"
);

// 8. handleSave save DLCs
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

// 9. Update the UI for DLCs tab
const renderDlcTabRegex = /<div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>[\s\S]*?<div style={{ backgroundColor: '#0F1219', borderTop: '1px solid rgba\(255,255,255,0\.06\)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>/;

let dlcUi = `
{/* DLC Matrix UI */}
{gameVersions.length > 0 && (
  <div style={{ marginTop: '24px' }}>
    <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#E2E8F0', fontWeight: 600 }}>Inclusión en Versiones</h3>
    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', color: '#CBD5E1' }}>
        <thead>
          <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>Versión</th>
            {dlcsList.filter(d => d.name.trim() !== '').map((dlc, idx) => (
              <th key={idx} style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>{dlc.name}</th>
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
`;

content = content.replace(
  "</div>\n                    </div>\n                  ))}\n                </div>\n              </div>",
  "</div>\n                    </div>\n                  ))}\n                </div>\n              </div>\n              " + dlcUi
);


fs.writeFileSync(path, content, 'utf-8');
console.log('CatalogManager.tsx patched successfully.');
