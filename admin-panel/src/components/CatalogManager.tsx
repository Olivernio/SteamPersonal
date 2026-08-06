import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseAdmin';
import type { DbGame, RecipeStep } from '../services/supabaseAdmin';
import { fetchSteamGameDetails, searchSteamGames } from '../services/steamService';
import type { SteamSearchResult } from '../services/steamService';
import { VisualRecipeBuilder } from './VisualRecipeBuilder';
import { Plus, Edit2, Trash2, RefreshCw, Layers, Zap, Search, Flame, ArrowUpDown, MessageSquare, CheckCircle2 } from 'lucide-react';

export const CatalogManager: React.FC = () => {
  const [games, setGames] = useState<DbGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
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
  const [version, setVersion] = useState('1.0.0');
  const [dlcsText, setDlcsText] = useState('');
  const [controllerSupport, setControllerSupport] = useState(true);
  const [reqMin, setReqMin] = useState('');
  const [reqRec, setReqRec] = useState('');
  const [screenshotsText, setScreenshotsText] = useState('');
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [importingSteam, setImportingSteam] = useState(false);

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
    setVersion('1.0.0');
    setDlcsText('');
    setControllerSupport(true);
    setReqMin('OS: Windows 10 64-bit | RAM: 8 GB');
    setReqRec('OS: Windows 11 64-bit | RAM: 16 GB');
    setScreenshotsText('');
    setSteps([
      { action: 'stream_extract', provider: 'GoogleDrive', url: '' },
      { action: 'add_defender_exclusion', path: '{INSTALL_DIR}' },
      { action: 'create_shortcut', shortcut_name: '' }
    ]);
    setModalOpen(true);
  };

  const openEditModal = async (game: DbGame) => {
    setEditingGame(game);
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
    setVersion(game.latest_official_version || '1.0.0');
    setDlcsText(Array.isArray(game.dlcs) ? game.dlcs.join(', ') : '');
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

    const dlcs = dlcsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

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
      latest_official_version: version,
      is_active: true,
      dlcs,
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

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px' }}>
          <form
            onSubmit={handleSave}
            style={{
              width: '820px',
              maxHeight: '90vh',
              backgroundColor: '#151922',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            {/* Modal header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0, color: '#E2E8F0', fontSize: '16px', fontWeight: 600 }}>
                {editingGame ? `Editar: ${editingGame.title}` : 'Publicar Nuevo Juego'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Modal body scrollable */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Título del Juego *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Librarian: Tidy Up the Arcane Library!"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Versión *</label>
                  <input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    required
                    placeholder="1.0.0"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Clave Única (key)</label>
                  <input
                    value={gameKey}
                    onChange={(e) => setGameKey(e.target.value)}
                    placeholder="librarian"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Género</label>
                  <input
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    placeholder="Acción / Aventura"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Steam AppID</label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={steamAppId}
                      onChange={(e) => setSteamAppId(e.target.value)}
                      placeholder="1091500"
                      style={{ flex: 1, padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      onClick={() => handleImportSteam()}
                      disabled={importingSteam}
                      title="Importar usando el AppID ingresado"
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
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
                      <Zap size={12} /> {importingSteam ? '...' : 'Steam'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery(title || '');
                        setSearchModalOpen(true);
                      }}
                      title="Buscar en Steam por nombre"
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
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
                      <Search size={12} /> Buscar
                    </button>
                  </div>
                </div>
              </div>

              {/* Developer and Publisher Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Desarrollador</label>
                  <input
                    value={developer}
                    onChange={(e) => setDeveloper(e.target.value)}
                    placeholder="Arcane Studio"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Editor / Publisher</label>
                  <input
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="Arcane Publishing"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Company Logos */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>URL Logo Desarrollador (PNG/Icono)</label>
                  <input
                    value={developerLogoUrl}
                    onChange={(e) => setDeveloperLogoUrl(e.target.value)}
                    placeholder="https://.../dev-logo.png"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>URL Logo Editor (PNG/Icono)</label>
                  <input
                    value={publisherLogoUrl}
                    onChange={(e) => setPublisherLogoUrl(e.target.value)}
                    placeholder="https://.../pub-logo.png"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>URL Enlace de Descarga *</label>
                  <input
                    value={downloadUrl}
                    onChange={(e) => setDownloadUrl(e.target.value)}
                    required
                    placeholder="https://drive.google.com/..."
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Ruta Relativa del Ejecutable *</label>
                  <input
                    value={executableRelativePath}
                    onChange={(e) => setExecutableRelativePath(e.target.value)}
                    required
                    placeholder="Librarian.exe"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Portada (Cover 2:3)</label>
                  <input
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://.../cover.jpg"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Fondo (Banner HD)</label>
                  <input
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://.../banner.jpg"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Logo PNG Transparente</label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://.../logo.png"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Ícono Juego (32x32 / Mini)</label>
                  <input
                    value={iconUrl}
                    onChange={(e) => setIconUrl(e.target.value)}
                    placeholder="https://.../icon.png"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* DLCs & Controller Support */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>DLCs Incluidos (Separados por coma)</label>
                  <input
                    value={dlcsText}
                    onChange={(e) => setDlcsText(e.target.value)}
                    placeholder="Shadow Realm, Colosseum Pack, Nightfall Armor"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div style={{ paddingTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={controllerSupport}
                      onChange={(e) => setControllerSupport(e.target.checked)}
                      style={{ accentColor: '#6366F1', width: '16px', height: '16px' }}
                    />
                    🎮 Soporte para mando
                  </label>
                </div>
              </div>

              {/* Requirements */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Requisitos Mínimos</label>
                  <input
                    value={reqMin}
                    onChange={(e) => setReqMin(e.target.value)}
                    placeholder="OS: Windows 10 64-bit | CPU: Intel Core i3 | RAM: 8 GB"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Requisitos Recomendados</label>
                  <input
                    value={reqRec}
                    onChange={(e) => setReqRec(e.target.value)}
                    placeholder="OS: Windows 11 64-bit | CPU: Intel Core i5 | RAM: 16 GB"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Descripción del Juego</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Una breve reseña o sinopsis..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              {/* Screenshots URLs */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>Capturas de Pantalla (Una URL por línea)</label>
                <textarea
                  value={screenshotsText}
                  onChange={(e) => setScreenshotsText(e.target.value)}
                  rows={2}
                  placeholder="https://.../screen1.jpg&#10;https://.../screen2.jpg"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px', resize: 'vertical' }}
                />
              </div>

              {/* Visual Recipe Builder Section */}
              <div style={{ paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <VisualRecipeBuilder
                  steps={steps}
                  onChange={setSteps}
                  defaultDownloadUrl={downloadUrl}
                  defaultTitle={title}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ padding: '8px 14px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ padding: '8px 20px', borderRadius: '8px', backgroundColor: '#6366F1', border: 'none', color: '#FFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {saving ? 'Guardando...' : 'Guardar y Publicar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
