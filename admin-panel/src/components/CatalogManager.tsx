import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseAdmin';
import type { DbGame, RecipeStep, DlcItem, DbGameVersion } from '../services/supabaseAdmin';
import { fetchSteamGameDetails, searchSteamGames } from '../services/steamService';
import type { SteamSearchResult } from '../services/steamService';
import { VisualRecipeBuilder } from './VisualRecipeBuilder';
import { Plus, Edit2, Trash2, RefreshCw, Layers, Zap, Search, Flame, ArrowUpDown, MessageSquare, CheckCircle2, Image as ImageIcon, LayoutGrid, Eye, FileText, X, Package } from 'lucide-react';

export const CatalogManager: React.FC = () => {
  const [games, setGames] = useState<DbGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'info' | 'media' | 'install' | 'dlc_reqs'>('info');
  const [editingGame, setEditingGame] = useState<DbGame | null>(null);

  // Sorting & Filtering state
  const [sortBy, setSortBy] = useState<'requests' | 'recent' | 'alphabetical'>('requests');

  // Steam Search Modal state
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SteamSearchResult[]>([]);
  const [searchingSteam, setSearchingSteam] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [gameKey, setGameKey] = useState('');
  const [steamAppId, setSteamAppId] = useState('');
  const [developer, setDeveloper] = useState('');
  const [publisher, setPublisher] = useState('');
  const [developerLogoUrl, setDeveloperLogoUrl] = useState('');
  const [publisherLogoUrl, setPublisherLogoUrl] = useState('');
  const [genre, setGenre] = useState('');
  const [description, setDescription] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [executableRelativePath, setExecutableRelativePath] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [savePathPattern, setSavePathPattern] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [dlcsList, setDlcsList] = useState<DlcItem[]>([]);
  const [gameVersions, setGameVersions] = useState<DbGameVersion[]>([]);
  const [versionDlcs, setVersionDlcs] = useState<{ [versionId: string]: string[] }>({});

  const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
  const [controllerSupport, setControllerSupport] = useState(true);
  const [reqMin, setReqMin] = useState('');
  const [reqRec, setReqRec] = useState('');
  const [screenshotsText, setScreenshotsText] = useState('');
  const [newScreenshotUrl, setNewScreenshotUrl] = useState('');
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [importingSteam, setImportingSteam] = useState(false);

  const [bulkDlcText, setBulkDlcText] = useState('');
  const [showBulkDlcImport, setShowBulkDlcImport] = useState(false);

  const handleAddDlc = () => {
    setDlcsList((prev) => [...prev, { id: uuidv4(), name: '' }]);
  };

  const handleUpdateDlc = (index: number, field: keyof DlcItem, value: string) => {
    setDlcsList((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveDlc = (index: number) => {
    setDlcsList((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAllDlcs = () => {
    if (confirm('¿Estás seguro de que deseas eliminar todos los DLCs de este juego?')) {
      setDlcsList([]);
    }
  };

  const handleProcessBulkDlcs = () => {
    if (!bulkDlcText.trim()) return;
    const lines = bulkDlcText.split('\n').map((l) => l.trim()).filter(Boolean);
    const parsed: DlcItem[] = lines.map((line) => {
      if (line.includes('=')) {
        const parts = line.split('=');
        const dlcName = parts.slice(1).join('=').trim();
        return {
          id: uuidv4(),
          name: dlcName || line
        };
      }
      return {
        id: uuidv4(),
        name: line
      };
    });

    setDlcsList((prev) => [...prev, ...parsed]);
    setBulkDlcText('');
    setShowBulkDlcImport(false);
  };

  const handleAddScreenshot = () => {
    if (!newScreenshotUrl.trim()) return;
    const current = screenshotsText ? screenshotsText.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    if (!current.includes(newScreenshotUrl.trim())) {
      const updated = [...current, newScreenshotUrl.trim()];
      setScreenshotsText(updated.join('\n'));
    }
    setNewScreenshotUrl('');
  };

  const handleRemoveScreenshot = (indexToRemove: number) => {
    const current = screenshotsText ? screenshotsText.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    const updated = current.filter((_, idx) => idx !== indexToRemove);
    setScreenshotsText(updated.join('\n'));
  };

  const handleImportSteam = async (overrideAppId?: string | number) => {
    const targetAppId = String(overrideAppId || steamAppId).trim();
    if (!targetAppId) {
      alert('Ingresa primero el Steam AppID (ej: 1091500)');
      return;
    }

    setImportingSteam(true);
    try {
      const details = await fetchSteamGameDetails(targetAppId);
      setTitle(details.title);
      setGameKey(details.gameKey);
      setDeveloper(details.developer);
      if (details.publisher) setPublisher(details.publisher);
      setGenre(details.genre);
      setCoverUrl(details.coverUrl);
      if (details.bannerUrl) setBannerUrl(details.bannerUrl);
      if (details.iconUrl) setIconUrl(details.iconUrl);
      if (details.description) setDescription(details.description);
      if (details.controllerSupport !== undefined) setControllerSupport(details.controllerSupport);
      if (details.requirements) {
        if (details.requirements.min) setReqMin(details.requirements.min);
        if (details.requirements.rec) setReqRec(details.requirements.rec);
      }
      if (details.screenshots && details.screenshots.length > 0) {
        setScreenshotsText(details.screenshots.join('\n'));
      }

      // Update shortcut name in steps if present
      setSteps((prev) =>
        prev.map((s) => (s.action === 'create_shortcut' ? { ...s, shortcut_name: details.title } : s))
      );
    } catch (err: any) {
      alert(`Error al importar de Steam: ${err.message}`);
    } finally {
      setImportingSteam(false);
    }
  };

  const handleSearchSteam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchingSteam(true);
    try {
      const results = await searchSteamGames(searchQuery);
      setSearchResults(results);
    } catch (err: any) {
      alert(`Error al buscar en Steam: ${err.message}`);
    } finally {
      setSearchingSteam(false);
    }
  };

  const selectSteamResult = (result: SteamSearchResult) => {
    setSteamAppId(String(result.appId));
    setSearchModalOpen(false);
    handleImportSteam(result.appId);
  };

  const fetchCatalog = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setGames(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const sortedGames = [...games].sort((a, b) => {
    if (sortBy === 'requests') {
      return (b.request_count || 0) - (a.request_count || 0);
    }
    if (sortBy === 'recent') {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
    if (sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  const totalRequests = games.reduce((acc, g) => acc + (g.request_count || 0), 0);
  const pendingUpdateGames = games.filter((g) => (g.request_count || 0) > 0).length;

  const openCreateModal = () => {
    setEditingGame(null);
    setTitle('');
    setGameKey('');
    setSteamAppId('');
    setDeveloper('Indie Developer');
    setPublisher('Indie Publisher');
    setDeveloperLogoUrl('');
    setPublisherLogoUrl('');
    setGenre('Aventura');
    setDescription('');
    setDownloadUrl('');
    setExecutableRelativePath('');
    setCoverUrl('');
    setBannerUrl('');
    setLogoUrl('');
    setIconUrl('');
    setSavePathPattern('');
    setVersion('1.0.0');
    setDlcsList([]);
    setGameVersions([]);
    setVersionDlcs({});
    setControllerSupport(true);
    setReqMin('OS: Windows 10 64-bit | RAM: 8 GB');
    setReqRec('OS: Windows 11 64-bit | RAM: 16 GB');
    setScreenshotsText('');
    setSteps([
      { action: 'stream_extract', provider: 'GoogleDrive', url: '' },
      { action: 'add_defender_exclusion', path: '{INSTALL_DIR}' },
      { action: 'create_shortcut', shortcut_name: '' }
    ]);
    setModalTab('info');
    setModalOpen(true);
  };

  const openEditModal = async (game: DbGame) => {
    setEditingGame(game);
    setModalTab('info');
    setTitle(game.title);
    setGameKey(game.game_key);
    setSteamAppId(game.steam_appid ? String(game.steam_appid) : '');
    setDeveloper(game.developer || '');
    setPublisher(game.publisher || '');
    setDeveloperLogoUrl(game.developer_logo_url || '');
    setPublisherLogoUrl(game.publisher_logo_url || '');
    setGenre(game.genre || '');
    setDescription(game.description || '');
    setDownloadUrl(game.download_url);
    setExecutableRelativePath(game.executable_relative_path);
    setCoverUrl(game.cover_image_url || '');
    setBannerUrl(game.header_banner_url || '');
    setLogoUrl(game.logo_image_url || '');
    setIconUrl(game.icon_url || '');
    setSavePathPattern(game.save_path_pattern || '');
    setVersion(game.latest_official_version || '1.0.0');

    // Fetch master DLCs
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
    setVersionDlcs(versionMap);

    setControllerSupport(game.controller_support ?? true);
    setReqMin(game.requirements?.min || 'OS: Windows 10 64-bit | RAM: 8 GB');
    setReqRec(game.requirements?.rec || 'OS: Windows 11 64-bit | RAM: 16 GB');
    setScreenshotsText(Array.isArray(game.screenshots) ? game.screenshots.join('\n') : '');

    // Fetch existing recipe steps
    const { data: recipeData } = await supabase
      .from('installation_recipes')
      .select('steps')
      .eq('game_id', game.id!)
      .single();

    if (recipeData && recipeData.steps) {
      setSteps(recipeData.steps);
    } else {
      setSteps([
        { action: 'stream_extract', provider: 'GoogleDrive', url: game.download_url },
        { action: 'add_defender_exclusion', path: '{INSTALL_DIR}' },
        { action: 'create_shortcut', shortcut_name: game.title }
      ]);
    }

    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);



    const screenshots = screenshotsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const gamePayload = {
      game_key: gameKey || title.toLowerCase().replace(/[^a-z0-9]/g, ''),
      title,
      steam_appid: steamAppId ? parseInt(steamAppId) : null,
      developer,
      publisher: publisher || 'Indie Publisher',
      developer_logo_url: developerLogoUrl || null,
      publisher_logo_url: publisherLogoUrl || null,
      genre,
      description,
      download_url: downloadUrl,
      executable_relative_path: executableRelativePath,
      cover_image_url: coverUrl,
      header_banner_url: bannerUrl,
      logo_image_url: logoUrl,
      icon_url: iconUrl || null,
      save_path_pattern: savePathPattern || null,
      latest_official_version: version,
      is_active: true,
      controller_support: controllerSupport,
      requirements: { min: reqMin, rec: reqRec },
      screenshots
    };

    let gameId = editingGame?.id;

    if (editingGame) {
      // Update game
      const { error } = await supabase
        .from('games')
        .update(gamePayload)
        .eq('id', editingGame.id!);
      if (error) alert(`Error al guardar juego: ${error.message}`);
    } else {
      // Insert game
      const { data, error } = await supabase
        .from('games')
        .insert([gamePayload])
        .select('id')
        .single();

      if (error) {
        alert(`Error al crear juego: ${error.message}`);
        setSaving(false);
        return;
      }
      gameId = data.id;
    }

    // Save associated recipe
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
      }
    }

    setSaving(false);
    setModalOpen(false);
    fetchCatalog();
  };

  const handleDelete = async (gameId: string, gameTitle: string) => {
    if (!confirm(`¿Eliminar definitivamente "${gameTitle}"?`)) return;

    await supabase.from('games').delete().eq('id', gameId);
    fetchCatalog();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0B0E14' }}>
      {/* Action Header */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', color: '#E2E8F0', fontWeight: 700 }}>Catálogo de Juegos</h1>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Gestiona los juegos y recetas que se sincronizarán con los clientes desktop</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchCatalog}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} /> Refrescar
          </button>

          <button
            onClick={openCreateModal}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              backgroundColor: '#6366F1',
              border: 'none',
              color: '#FFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} /> Publicar Nuevo Juego
          </button>
        </div>
      </div>

      {/* Requests Dashboard Stats & Filters Bar */}
      <div style={{ padding: '16px 24px', backgroundColor: '#0F131C', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Layers size={15} style={{ color: '#818CF8' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Catálogo:</span>
            <strong style={{ fontSize: '13px', color: '#E2E8F0' }}>{games.length} juegos</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}>
            <Flame size={15} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Solicitudes Totales:</span>
            <strong style={{ fontSize: '13px', color: '#FB923C' }}>{totalRequests} peticiones</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <MessageSquare size={15} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Requieren Update:</span>
            <strong style={{ fontSize: '13px', color: '#FCA5A5' }}>{pendingUpdateGames} juegos</strong>
          </div>
        </div>

        {/* Sort selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowUpDown size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Ordenar por:</span>
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#E2E8F0',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="requests">🔥 Más Solicitados Primero</option>
            <option value="recent">🕒 Agregados Recientemente</option>
            <option value="alphabetical">🔤 Alfabético (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Main Grid / Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px' }}>Cargando catálogo...</div>
        ) : sortedGames.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', backgroundColor: '#151922', borderRadius: '16px', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Layers size={40} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '12px' }} />
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>No hay juegos en la base de datos.</p>
            <button
              onClick={openCreateModal}
              style={{ marginTop: '16px', padding: '8px 16px', borderRadius: '8px', backgroundColor: '#6366F1', border: 'none', color: '#FFF', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
            >
              Publicar el Primer Juego
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {sortedGames.map((g) => {
              const reqCount = g.request_count || 0;
              const isHighPriority = reqCount > 5;
              const isMediumPriority = reqCount > 0 && reqCount <= 5;

              return (
                <div
                  key={g.id}
                  style={{
                    borderRadius: '12px',
                    backgroundColor: '#151922',
                    border: isHighPriority
                      ? '1px solid rgba(239,68,68,0.4)'
                      : isMediumPriority
                      ? '1px solid rgba(245,158,11,0.3)'
                      : '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative'
                  }}
                >
                  <div style={{ height: '140px', backgroundColor: '#0B0E14', position: 'relative', overflow: 'hidden' }}>
                    {g.cover_image_url ? (
                      <img src={g.cover_image_url} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '32px' }}>🎮</div>
                    )}
                    <span style={{ position: 'absolute', top: '8px', right: '8px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#A5B4FC', fontSize: '10px', fontWeight: 700 }}>
                      {g.latest_official_version}
                    </span>
                  </div>

                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px', fontSize: '14px', color: '#E2E8F0', fontWeight: 600 }}>{g.title}</h3>
                      <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{g.developer} · {g.publisher || 'Indie'} · {g.genre}</p>
                    </div>

                    <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {isHighPriority ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#FCA5A5', fontSize: '11px', fontWeight: 700 }}>
                          <Flame size={12} style={{ color: '#EF4444' }} /> 🔥 {reqCount} peticiones
                        </span>
                      ) : isMediumPriority ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#FDE047', fontSize: '11px', fontWeight: 700 }}>
                          <MessageSquare size={12} style={{ color: '#F59E0B' }} /> 📩 {reqCount} peticiones
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#6EE7B7', fontSize: '10px', fontWeight: 600 }}>
                          <CheckCircle2 size={11} style={{ color: '#10B981' }} /> Actualizado
                        </span>
                      )}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(g)}
                          style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer' }}
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => handleDelete(g.id!, g.title)}
                          style={{ padding: '6px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Steam Interactive Search Modal */}
      {searchModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '24px' }}>
          <div style={{ width: '600px', backgroundColor: '#151922', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} style={{ color: '#F59E0B' }} />
                <h3 style={{ margin: 0, color: '#E2E8F0', fontSize: '15px', fontWeight: 700 }}>Buscar Juego en Steam Store</h3>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSearchSteam} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escribe el nombre del juego (ej: Cyberpunk 2077, Elden Ring, Hades)..."
                autoFocus
                style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2E8F0', fontSize: '13px' }}
              />
              <button
                type="submit"
                disabled={searchingSteam}
                style={{ padding: '10px 16px', borderRadius: '8px', backgroundColor: '#F59E0B', border: 'none', color: '#000', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {searchingSteam ? 'Buscando...' : 'Buscar'}
              </button>
            </form>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                  {searchingSteam ? 'Consultando API de Steam Store...' : 'Ingresa el nombre del juego arriba y presiona Buscar.'}
                </div>
              ) : (
                searchResults.map((item) => (
                  <div
                    key={item.appId}
                    onClick={() => selectSteamResult(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(99,102,241,0.15)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                  >
                    <img src={item.tinyImage} alt={item.name} style={{ width: '80px', height: '40px', objectFit: 'cover', borderRadius: '6px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600 }}>{item.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>Steam AppID: {item.appId}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: '6px', backgroundColor: 'rgba(245,158,11,0.2)', color: '#FDE047', fontSize: '11px', fontWeight: 700 }}>
                      ⚡ Seleccionar e Importar
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal (Modernized 4-Tab Editor with Live Image Previews) */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <form
            onSubmit={handleSave}
            style={{
              width: '940px',
              maxWidth: '95vw',
              height: '88vh',
              backgroundColor: '#11151F',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              overflow: 'hidden'
            }}
          >
            {/* Modal header */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#161B26', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818CF8' }}>
                  {editingGame ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#E2E8F0', fontSize: '16px', fontWeight: 700 }}>
                    {editingGame ? `Editar Juego: ${editingGame.title}` : 'Publicar Nuevo Juego en Catálogo'}
                  </h3>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                    Gestor completo de metadatos, arte visual y recetas de instalación
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#0D1017', padding: '0 24px', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setModalTab('info')}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'info' ? '2px solid #6366F1' : '2px solid transparent',
                  color: modalTab === 'info' ? '#FFF' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  fontWeight: modalTab === 'info' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <FileText size={15} style={{ color: modalTab === 'info' ? '#818CF8' : 'inherit' }} />
                <span>1. Información Básica</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('media')}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'media' ? '2px solid #6366F1' : '2px solid transparent',
                  color: modalTab === 'media' ? '#FFF' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  fontWeight: modalTab === 'media' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <ImageIcon size={15} style={{ color: modalTab === 'media' ? '#818CF8' : 'inherit' }} />
                <span>2. Arte Visual & Previews</span>
                {screenshotsText && (
                  <span style={{ backgroundColor: 'rgba(99,102,241,0.2)', color: '#A5B4FC', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>
                    {screenshotsText.split('\n').filter((s) => s.trim()).length} fotos
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setModalTab('install')}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'install' ? '2px solid #6366F1' : '2px solid transparent',
                  color: modalTab === 'install' ? '#FFF' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  fontWeight: modalTab === 'install' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Zap size={15} style={{ color: modalTab === 'install' ? '#818CF8' : 'inherit' }} />
                <span>3. Rutas & Receta</span>
              </button>

              <button
                type="button"
                onClick={() => setModalTab('dlc_reqs')}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: modalTab === 'dlc_reqs' ? '2px solid #6366F1' : '2px solid transparent',
                  color: modalTab === 'dlc_reqs' ? '#FFF' : 'rgba(255,255,255,0.5)',
                  fontSize: '13px',
                  fontWeight: modalTab === 'dlc_reqs' ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <LayoutGrid size={15} style={{ color: modalTab === 'dlc_reqs' ? '#818CF8' : 'inherit' }} />
                <span>4. DLCs & Requisitos</span>
              </button>
            </div>

            {/* Modal Body scrollable */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* TAB 1: INFORMACIÓN BÁSICA */}
              {modalTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Título del Juego *</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        placeholder="Cyberpunk 2077"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Versión *</label>
                      <input
                        value={version}
                        onChange={(e) => setVersion(e.target.value)}
                        required
                        placeholder="1.0.0"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Clave Única (key)</label>
                      <input
                        value={gameKey}
                        onChange={(e) => setGameKey(e.target.value)}
                        placeholder="cyberpunk2077"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Género</label>
                      <input
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder="RPG / Mundo Abierto"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Steam AppID</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          value={steamAppId}
                          onChange={(e) => setSteamAppId(e.target.value)}
                          placeholder="1091500"
                          style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleImportSteam()}
                          disabled={importingSteam}
                          title="Importar metadatos usando el AppID de Steam"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(245,158,11,0.2)',
                            border: '1px solid rgba(245,158,11,0.4)',
                            color: '#FDE047',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Zap size={13} /> {importingSteam ? '...' : 'Steam'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery(title || '');
                            setSearchModalOpen(true);
                          }}
                          title="Buscar juego en Steam Store"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(99,102,241,0.2)',
                            border: '1px solid rgba(99,102,241,0.4)',
                            color: '#A5B4FC',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Search size={13} /> Buscar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Desarrollador</label>
                      <input
                        value={developer}
                        onChange={(e) => setDeveloper(e.target.value)}
                        placeholder="CD PROJEKT RED"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Editor / Publisher</label>
                      <input
                        value={publisher}
                        onChange={(e) => setPublisher(e.target.value)}
                        placeholder="CD PROJEKT RED"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Descripción del Juego</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={5}
                      placeholder="Reseña o sinopsis oficial..."
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: ARTE VISUAL & GALERÍA DE PREVIEWS */}
              {modalTab === 'media' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Grid de 4 Previews Principales */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    {/* Cover Preview Card */}
                    <div style={{ padding: '14px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '14px' }}>
                      <div style={{ width: '70px', height: '105px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {coverUrl ? (
                          <img src={coverUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <Eye size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>PORTADA (COVER 2:3)</label>
                        <input
                          value={coverUrl}
                          onChange={(e) => setCoverUrl(e.target.value)}
                          placeholder="https://.../cover.jpg"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    {/* Banner Preview Card */}
                    <div style={{ padding: '14px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '14px' }}>
                      <div style={{ width: '120px', height: '70px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {bannerUrl ? (
                          <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <Eye size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>FONDO (BANNER HD 16:9)</label>
                        <input
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          placeholder="https://.../banner.jpg"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    {/* Transparent Logo Preview Card */}
                    <div style={{ padding: '14px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '14px' }}>
                      <div style={{ width: '100px', height: '70px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#0A0D14', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <Eye size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>LOGO PNG TRANSPARENTE</label>
                        <input
                          value={logoUrl}
                          onChange={(e) => setLogoUrl(e.target.value)}
                          placeholder="https://.../logo.png"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                        />
                      </div>
                    </div>

                    {/* Mini Icon Preview Card */}
                    <div style={{ padding: '14px', borderRadius: '14px', backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: '14px' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {iconUrl ? (
                          <img src={iconUrl} alt="Icon" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <Eye size={18} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>ÍCONO MINI (32x32)</label>
                        <input
                          value={iconUrl}
                          onChange={(e) => setIconUrl(e.target.value)}
                          placeholder="https://.../icon.png"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Developer & Publisher Logos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {developerLogoUrl && (
                        <img src={developerLogoUrl} alt="Dev Logo" style={{ height: '36px', maxWidth: '80px', objectFit: 'contain', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Logo Desarrollador (URL)</label>
                        <input
                          value={developerLogoUrl}
                          onChange={(e) => setDeveloperLogoUrl(e.target.value)}
                          placeholder="https://.../dev-logo.png"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {publisherLogoUrl && (
                        <img src={publisherLogoUrl} alt="Pub Logo" style={{ height: '36px', maxWidth: '80px', objectFit: 'contain', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '4px' }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Logo Editor (URL)</label>
                        <input
                          value={publisherLogoUrl}
                          onChange={(e) => setPublisherLogoUrl(e.target.value)}
                          placeholder="https://.../pub-logo.png"
                          style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multiple Screenshots Manager with Visual Thumbnail Grid */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ImageIcon size={16} style={{ color: '#818CF8' }} />
                        <label style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 700 }}>Galería de Capturas de Pantalla (Screenshots)</label>
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                        {screenshotsText.split('\n').filter((s) => s.trim()).length} imágenes añadidas
                      </span>
                    </div>

                    {/* Quick Add Screenshot Input */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={newScreenshotUrl}
                        onChange={(e) => setNewScreenshotUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddScreenshot(); } }}
                        placeholder="Pegar URL de captura de pantalla (ej: https://.../ss_1.jpg)..."
                        style={{ flex: 1, padding: '9px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.12)', color: '#E2E8F0', fontSize: '12px' }}
                      />
                      <button
                        type="button"
                        onClick={handleAddScreenshot}
                        style={{ padding: '9px 16px', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#A5B4FC', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        <Plus size={14} /> Añadir Foto
                      </button>
                    </div>

                    {/* Visual Grid of Screenshots */}
                    {screenshotsText.split('\n').filter((s) => s.trim()).length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '4px' }}>
                        {screenshotsText.split('\n').filter((s) => s.trim()).map((url, idx) => (
                          <div
                            key={idx}
                            style={{ position: 'relative', height: '90px', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#000' }}
                          >
                            <img src={url.trim()} alt={`SS ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => (e.currentTarget.style.opacity = '0.3')} />
                            <button
                              type="button"
                              onClick={() => handleRemoveScreenshot(idx)}
                              title="Eliminar captura"
                              style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.2)', color: '#FF4D4D', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                            >
                              <X size={12} />
                            </button>
                            <div style={{ position: 'absolute', bottom: '4px', left: '4px', backgroundColor: 'rgba(0,0,0,0.6)', color: '#FFF', fontSize: '9px', padding: '1px 5px', borderRadius: '4px' }}>
                              #{idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Raw Textarea Bulk Input Fallback */}
                    <details style={{ marginTop: '6px' }}>
                      <summary style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', cursor: 'pointer' }}>Ver/Editar URLs en formato de texto masivo</summary>
                      <textarea
                        value={screenshotsText}
                        onChange={(e) => setScreenshotsText(e.target.value)}
                        rows={3}
                        placeholder="https://.../screen1.jpg&#10;https://.../screen2.jpg"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px', resize: 'vertical', marginTop: '6px' }}
                      />
                    </details>
                  </div>
                </div>
              )}

              {/* TAB 3: RUTAS & RECETA DE INSTALACIÓN */}
              {modalTab === 'install' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>URL Enlace de Descarga *</label>
                      <input
                        value={downloadUrl}
                        onChange={(e) => setDownloadUrl(e.target.value)}
                        required
                        placeholder="https://drive.google.com/..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Ruta Relativa Ejecutable *</label>
                      <input
                        value={executableRelativePath}
                        onChange={(e) => setExecutableRelativePath(e.target.value)}
                        required
                        placeholder="Cyberpunk2077.exe"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Ruta de Guardado (Save Path)</label>
                      <input
                        value={savePathPattern}
                        onChange={(e) => setSavePathPattern(e.target.value)}
                        placeholder="%APPDATA%/CD Projekt Red/Cyberpunk 2077"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  {/* Visual Recipe Builder Component */}
                  <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <VisualRecipeBuilder
                      steps={steps}
                      onChange={setSteps}
                      defaultDownloadUrl={downloadUrl}
                      defaultTitle={title}
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: DLCS & REQUISITOS DEL SISTEMA */}
              {modalTab === 'dlc_reqs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Visual DLCs List Manager */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Package size={18} style={{ color: '#818CF8' }} />
                        <label style={{ fontSize: '14px', color: '#E2E8F0', fontWeight: 700 }}>
                          Contenido Descargable e Expansiones ({dlcsList.length} DLCs)
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setShowBulkDlcImport(!showBulkDlcImport)}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            backgroundColor: showBulkDlcImport ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.15)',
                            border: '1px solid rgba(245,158,11,0.35)',
                            color: '#FDE047',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          📋 {showBulkDlcImport ? 'Cerrar Pegado' : 'Importación Masiva (Pegar Lista)'}
                        </button>
                        <button
                          type="button"
                          onClick={handleAddDlc}
                          style={{
                            padding: '7px 12px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(99,102,241,0.2)',
                            border: '1px solid rgba(99,102,241,0.4)',
                            color: '#A5B4FC',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                        >
                          <Plus size={13} /> Añadir Uno
                        </button>
                        {dlcsList.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearAllDlcs}
                            style={{
                              padding: '7px 12px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(239,68,68,0.15)',
                              border: '1px solid rgba(239,68,68,0.3)',
                              color: '#EF4444',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            🗑️ Vaciar ({dlcsList.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bulk DLC Import Panel */}
                    {showBulkDlcImport && (
                      <div style={{ padding: '14px', borderRadius: '12px', backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ color: '#FDE047', fontSize: '12px', fontWeight: 700 }}>
                          📋 Pegar Lista de DLCs (Formato AppID=Nombre o Texto plano)
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', lineHeight: '1.4' }}>
                          Pega tus líneas en formato <code style={{ color: '#A5B4FC' }}>2306801=Monster Hunter Rise - Special Stickers</code> o nombres directos.
                          <br />
                          <strong>✨ Tip automático:</strong> Si incluye el AppID numérico de Steam, ¡se obtendrá y asignará automáticamente la imagen oficial de Steam de cada DLC!
                        </div>
                        <textarea
                          value={bulkDlcText}
                          onChange={(e) => setBulkDlcText(e.target.value)}
                          rows={6}
                          placeholder="2306801=Monster Hunter Rise - Special Stickers 14&#10;2306802=Monster Hunter Rise - Special Stickers 15&#10;Monster Hunter Rise - Sunbreak Expansion"
                          style={{ width: '100%', padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#E2E8F0', fontSize: '12px', fontFamily: 'monospace' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => setShowBulkDlcImport(false)}
                            style={{ padding: '6px 12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', border: 'none', cursor: 'pointer' }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleProcessBulkDlcs}
                            disabled={!bulkDlcText.trim()}
                            style={{ padding: '6px 16px', borderRadius: '6px', backgroundColor: '#F59E0B', color: '#000', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                          >
                            Procesar e Importar {bulkDlcText.split('\n').filter((l) => l.trim()).length} DLCs
                          </button>
                        </div>
                      </div>
                    )}

                    {/* DLC Items Cards Scrollable List */}
                    {dlcsList.length === 0 ? (
                      <div style={{ padding: '24px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                        No hay DLCs agregados a este juego. Usa "Importación Masiva (Pegar Lista)" para pegar tus 253 DLCs al instante.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                        {dlcsList.map((dlc, idx) => (
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
                        ))}
                      </div>
                    )}
                  </div>

                  {/* DLC Matrix UI */}
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

                  {/* Controller support checkbox */}
                  <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={controllerSupport}
                        onChange={(e) => setControllerSupport(e.target.checked)}
                        style={{ accentColor: '#6366F1', width: '18px', height: '18px' }}
                      />
                      🎮 Soporte para mando completo
                    </label>
                  </div>

                  {/* Requirements */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Requisitos Mínimos del Sistema</label>
                      <input
                        value={reqMin}
                        onChange={(e) => setReqMin(e.target.value)}
                        placeholder="OS: Windows 10 64-bit | CPU: Intel Core i7-6700 | RAM: 12 GB | GTX 1060"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Requisitos Recomendados del Sistema</label>
                      <input
                        value={reqRec}
                        onChange={(e) => setReqRec(e.target.value)}
                        placeholder="OS: Windows 11 64-bit | CPU: Core i7-12700 | RAM: 16 GB | RTX 3080"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: '#161B26', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ padding: '10px 16px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '10px 24px', borderRadius: '10px', backgroundColor: '#6366F1', border: 'none', color: '#FFF', fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}
              >
                {saving ? 'Guardando en Supabase...' : 'Guardar y Publicar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
