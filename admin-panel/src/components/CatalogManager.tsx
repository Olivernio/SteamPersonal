import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseAdmin';
import type { DbGame, RecipeStep, DlcItem, DbGameVersion } from '../services/supabaseAdmin';
import { parseMirrors, serializeMirrors } from '../services/supabaseAdmin';
import { fetchSteamGameDetails, searchSteamGames, fetchSteamEventsAndVersions } from '../services/steamService';
import type { SteamSearchResult } from '../services/steamService';
import { VisualRecipeBuilder } from './VisualRecipeBuilder';
import { MultiBannerPreview } from './MultiBannerPreview';
import { VersionManagerModal } from './VersionManagerModal';
import { DlcVersionMatrix } from './DlcVersionMatrix';
import {
  Plus, Edit2, Trash2, RefreshCw, Layers, Zap, Search, Flame, ArrowUpDown, MessageSquare,
  CheckCircle2, Image as ImageIcon, LayoutGrid, Eye, FileText, X, Package, Tag,
  Sparkles
} from 'lucide-react';

const uuidv4 = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

function isRealVersion(v: { version_name: string; changelog_title?: string; changelog_body?: string; download_url?: string }): boolean {
  const ver = (v.version_name || '').trim();
  const hasDl = Boolean(v.download_url && v.download_url.trim() !== '');
  if (hasDl) return true;

  // EXCLUSION: date-based placeholders (e.g. Update 2026-05-01, Update 2026-04-29)
  if (/^update\s+\d{4}[-\/\.]\d{2}[-\/\.]\d{2}/i.test(ver) || /^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}$/.test(ver)) {
    const searchTxt = `${v.changelog_title || ''} ${v.changelog_body || ''}`;
    const found = searchTxt.match(/\b(v\.?\s*\d+(\.\d+)+|version\s*\d+(\.\d+)+|ver\.\s*\d+(\.\d+)+)/i);
    if (found) {
      const num = found[0].replace(/^(v|version|ver)\.?\s*/i, '').trim();
      return Boolean(num && !/^\d{4}$/.test(num));
    }
    return false;
  }

  // 1. SemVer pattern (e.g. v1.0.7, v.1.0.7, 1.0.7, v0.9b)
  if (/^v?\.?\s*(\d+(\.\d+)+([a-z]|\-rc\d+|\-beta\d+|\-hotfix\d*|\.hotfix\d*)?)$/i.test(ver)) return true;

  // 2. Build ID (Build 123456)
  if (/^build\s*#?\s*\d+$/i.test(ver)) return true;

  // 3. Patch / Hotfix / Version (Patch 1.2, Hotfix 3, Version 1.0.5)
  if (/^(patch|hotfix|version|ver)\s*#?\s*\d+(\.\d+)*$/i.test(ver)) return true;

  return false;
}

function resolveVersionName(v: { version_name: string; changelog_title?: string; changelog_body?: string }): string {
  const ver = (v.version_name || '').trim();
  const isDate = /^update\s+\d{4}[-\/\.]\d{2}[-\/\.]\d{2}/i.test(ver) || /^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}$/.test(ver);

  if (isDate) {
    const searchTxt = `${v.changelog_title || ''} ${v.changelog_body || ''}`;
    const found = searchTxt.match(/\b(v\.?\s*\d+(\.\d+)+|version\s*\d+(\.\d+)+|ver\.\s*\d+(\.\d+)+)/i);
    if (found) {
      const num = found[0].replace(/^(v|version|ver)\.?\s*/i, '').trim();
      if (num && !/^\d{4}$/.test(num)) {
        return `v${num}`;
      }
    }
  }

  const semVer = ver.match(/^v?\.?\s*(\d+(\.\d+)+([a-z]|\-rc\d+|\-beta\d+|\-hotfix\d*|\.hotfix\d*)?)$/i);
  if (semVer) {
    return `v${semVer[1].replace(/^v\.?/i, '')}`;
  }

  return ver;
}

function compareVersions(vA: string, vB: string): number {
  if (!vA && !vB) return 0;
  if (!vA) return -1;
  if (!vB) return 1;

  const cleanA = vA.replace(/^v\.?/i, '').trim();
  const cleanB = vB.replace(/^v\.?/i, '').trim();

  const partsA = cleanA.split(/[\.\-\s]/).filter(Boolean);
  const partsB = cleanB.split(/[\.\-\s]/).filter(Boolean);

  const maxLen = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < maxLen; i++) {
    const rawA = partsA[i];
    const rawB = partsB[i];

    if (rawA === undefined) return -1;
    if (rawB === undefined) return 1;

    const numA = parseInt(rawA, 10);
    const numB = parseInt(rawB, 10);

    const isNumA = !isNaN(numA) && String(numA) === rawA;
    const isNumB = !isNaN(numB) && String(numB) === rawB;

    if (isNumA && isNumB) {
      if (numA !== numB) return numA - numB; // De menor a mayor (ascending)
    } else {
      const cmp = rawA.localeCompare(rawB, undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

export const CatalogManager: React.FC = () => {
  const [games, setGames] = useState<DbGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'info' | 'media' | 'versions' | 'install' | 'dlc_reqs'>('info');
  const [editingGame, setEditingGame] = useState<DbGame | null>(null);

  // Catalog search & filtering state
  const [catalogSearch, setCatalogSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'requests' | 'active'>('all');
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
  const [executableRelativePath, setExecutableRelativePath] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [savePathPattern, setSavePathPattern] = useState('');
  const [controllerSupport, setControllerSupport] = useState(true);
  const [reqMin, setReqMin] = useState('');
  const [reqRec, setReqRec] = useState('');
  const [screenshotsText, setScreenshotsText] = useState('');
  const [newScreenshotUrl, setNewScreenshotUrl] = useState('');
  const [steps, setSteps] = useState<RecipeStep[]>([]);
  const [saving, setSaving] = useState(false);
  const [importingSteam, setImportingSteam] = useState(false);

  // Lightbox modal state for screenshots
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // DLCs state
  const [dlcsList, setDlcsList] = useState<DlcItem[]>([]);
  const [bulkDlcText, setBulkDlcText] = useState('');
  const [showBulkDlcImport, setShowBulkDlcImport] = useState(false);

  // Multi-version management state
  const [gameVersions, setGameVersions] = useState<DbGameVersion[]>([]);
  const [versionDlcs, setVersionDlcs] = useState<{ [versionId: string]: string[] }>({});
  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<DbGameVersion | null>(null);
  const [versionSortOrder, setVersionSortOrder] = useState<'desc' | 'asc'>('desc');

  const displayedVersions = useMemo(() => {
    return [...gameVersions].sort((a, b) => {
      const verCmp = compareVersions(a.version_name, b.version_name);
      return versionSortOrder === 'desc' ? -verCmp : verCmp;
    });
  }, [gameVersions, versionSortOrder]);

  // DLC management handlers
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
          name: dlcName || line,
        };
      }
      return {
        id: uuidv4(),
        name: line,
      };
    });

    setDlcsList((prev) => [...prev, ...parsed]);
    setBulkDlcText('');
    setShowBulkDlcImport(false);
  };

  // Screenshots handlers
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

  // Steam Import & Search
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

  const [syncingSteamVersions, setSyncingSteamVersions] = useState(false);

  const handleSyncSteamVersions = async () => {
    const targetAppId = String(steamAppId || editingGame?.steam_appid || '').trim();
    if (!targetAppId) {
      alert('Ingresa primero el Steam AppID en la pestaña 1 (Información) para sincronizar versiones de Steam.');
      return;
    }

    setSyncingSteamVersions(true);
    try {
      const fetched = await fetchSteamEventsAndVersions(targetAppId);
      if (fetched.length === 0) {
        alert('No se encontraron versiones o eventos nuevos para este Steam AppID.');
        return;
      }

      setGameVersions((prev) => {
        const existingNames = new Set(prev.map((v) => v.version_name.toLowerCase()));
        const toAdd: DbGameVersion[] = [];

        fetched.forEach((f) => {
          if (!existingNames.has(f.version_name.toLowerCase())) {
            existingNames.add(f.version_name.toLowerCase());
            toAdd.push({
              game_id: editingGame?.id || '',
              version_name: f.version_name,
              build_id: f.build_id,
              release_date: f.release_date,
              is_available: false,
              download_url: '',
              mirrors: [],
              changelog_title: f.changelog_title,
              changelog_body: f.changelog_body,
            });
          } else {
            // Update build_id if existing version was missing it
            const existingIdx = prev.findIndex((v) => v.version_name.toLowerCase() === f.version_name.toLowerCase());
            if (existingIdx !== -1 && f.build_id && !prev[existingIdx].build_id) {
              prev[existingIdx].build_id = f.build_id;
            }
          }
        });

        const combined = [...prev, ...toAdd];
        return combined.sort((a, b) => compareVersions(a.version_name, b.version_name));
      });

      alert(`¡Sincronización completada! Se detectaron y actualizaron versiones y Build IDs desde Steam.`);
    } catch (e: any) {
      alert(`Error al sincronizar con Steam: ${e.message}`);
    } finally {
      setSyncingSteamVersions(false);
    }
  };

  // Catalog Fetch
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

  // Filtered & Sorted Games for Grid
  const displayedGames = useMemo(() => {
    let list = [...games];

    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase();
      list = list.filter(
        (g) =>
          g.title.toLowerCase().includes(q) ||
          g.developer?.toLowerCase().includes(q) ||
          g.game_key.toLowerCase().includes(q) ||
          (g.steam_appid && String(g.steam_appid).includes(q))
      );
    }

    if (filterType === 'requests') {
      list = list.filter((g) => (g.request_count || 0) > 0);
    }

    list.sort((a, b) => {
      if (sortBy === 'requests') return (b.request_count || 0) - (a.request_count || 0);
      if (sortBy === 'recent') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      if (sortBy === 'alphabetical') return a.title.localeCompare(b.title);
      return 0;
    });

    return list;
  }, [games, catalogSearch, filterType, sortBy]);

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
    setExecutableRelativePath('');
    setCoverUrl('');
    setBannerUrl('');
    setLogoUrl('');
    setIconUrl('');
    setSavePathPattern('');
    setDlcsList([]);
    setGameVersions([
      {
        game_id: '',
        version_name: 'v1.0.0',
        release_date: new Date().toISOString().split('T')[0],
        is_available: true,
        download_url: '',
        mirrors: [{ provider: 'Google Drive', url: '' }],
      },
    ]);
    setVersionDlcs({});
    setControllerSupport(true);
    setReqMin('OS: Windows 10 64-bit | RAM: 8 GB');
    setReqRec('OS: Windows 11 64-bit | RAM: 16 GB');
    setScreenshotsText('');
    setSteps([
      { action: 'stream_extract', provider: 'GoogleDrive', url: '' },
      { action: 'add_defender_exclusion', path: '{INSTALL_DIR}' },
      { action: 'create_shortcut', shortcut_name: '' },
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
    setExecutableRelativePath(game.executable_relative_path);
    setCoverUrl(game.cover_image_url || '');
    setBannerUrl(game.header_banner_url || '');
    setLogoUrl(game.logo_image_url || '');
    setIconUrl(game.icon_url || '');
    setSavePathPattern(game.save_path_pattern || '');

    // Fetch master DLCs
    const { data: dlcData } = await supabase.from('dlcs').select('*').eq('game_id', game.id!);
    setDlcsList(dlcData || []);

    // Fetch game_versions
    const { data: versionsData } = await supabase
      .from('game_versions')
      .select('*')
      .eq('game_id', game.id!)
      .order('release_date', { ascending: false });

    const realVersionsData = (versionsData || []).filter((v) => isRealVersion(v));

    const loadedVersions = realVersionsData
      .map((v) => ({
        ...v,
        version_name: resolveVersionName(v),
        mirrors: parseMirrors(v.download_url),
      }))
      .sort((a, b) => compareVersions(a.version_name, b.version_name));

    if (loadedVersions.length === 0) {
      setGameVersions([
        {
          game_id: game.id!,
          version_name: game.latest_official_version || '1.0.0',
          release_date: new Date().toISOString().split('T')[0],
          is_available: true,
          download_url: game.download_url || '',
          mirrors: parseMirrors(game.download_url),
        }
      ]);
    } else {
      setGameVersions(loadedVersions);
    }

    // Fetch game_version_dlcs
    const versionMap: { [versionId: string]: string[] } = {};
    if (loadedVersions.length > 0) {
      const versionIds = loadedVersions.map((v) => v.id).filter(Boolean);
      if (versionIds.length > 0) {
        const { data: gvdData } = await supabase
          .from('game_version_dlcs')
          .select('*')
          .in('game_version_id', versionIds);
        if (gvdData) {
          gvdData.forEach((gvd) => {
            if (!versionMap[gvd.game_version_id]) versionMap[gvd.game_version_id] = [];
            versionMap[gvd.game_version_id].push(gvd.dlc_id);
          });
        }
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
        { action: 'create_shortcut', shortcut_name: game.title },
      ]);
    }

    setModalOpen(true);
  };

  // Version modal handlers
  const handleSaveVersion = (savedVersion: DbGameVersion) => {
    setGameVersions((prev) => {
      const existingIdx = prev.findIndex(
        (v) => (v.id && savedVersion.id && v.id === savedVersion.id) || v.version_name === savedVersion.version_name
      );
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], ...savedVersion };
        return copy;
      }
      return [savedVersion, ...prev];
    });
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (editingGame?.id) {
      const { error } = await supabase.from('game_versions').delete().eq('id', versionId);
      if (error) console.error('Error deleting version:', error);
    }
    setGameVersions((prev) => prev.filter((v) => v.id !== versionId));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const screenshots = screenshotsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    // Derive latest version and download link from the versions list
    const downloadableVersion = gameVersions.find(
      (v) => (v.mirrors && v.mirrors.some((m) => m.url && m.url.trim() !== '')) || (v.download_url && v.download_url.trim() !== '')
    );
    const topVersion = downloadableVersion || gameVersions[0];
    const derivedLatestVersion = topVersion?.version_name || '1.0.0';
    const derivedDownloadUrl = topVersion?.mirrors && topVersion.mirrors.length > 0
      ? serializeMirrors(topVersion.mirrors)
      : (topVersion?.download_url || '');

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
      download_url: derivedDownloadUrl,
      executable_relative_path: executableRelativePath,
      cover_image_url: coverUrl,
      header_banner_url: bannerUrl,
      logo_image_url: logoUrl,
      icon_url: iconUrl || null,
      save_path_pattern: savePathPattern || null,
      latest_official_version: derivedLatestVersion,
      is_active: true,
      controller_support: controllerSupport,
      requirements: { min: reqMin, rec: reqRec },
      screenshots,
    };

    let gameId = editingGame?.id;

    if (editingGame) {
      const { error } = await supabase.from('games').update(gamePayload).eq('id', editingGame.id!);
      if (error) {
        alert(`Error al guardar juego: ${error.message}`);
        console.error('Error updating game:', error);
      }
    } else {
      const { data, error } = await supabase.from('games').insert([gamePayload]).select('id').single();

      if (error) {
        alert(`Error al crear juego: ${error.message}`);
        console.error('Error inserting game:', error);
        setSaving(false);
        return;
      }
      gameId = data.id;
    }

    if (gameId) {
      // 1. Save Recipe
      const { error: recipeError } = await supabase
        .from('installation_recipes')
        .upsert({ game_id: gameId, steps }, { onConflict: 'game_id' });
      if (recipeError) console.error('Error saving recipe:', recipeError);

      // 2. Save DLCs
      const dlcPayload = dlcsList
        .filter((d) => d.name.trim() !== '')
        .map((d) => ({
          id: d.id,
          game_id: gameId,
          name: d.name,
        }));

      if (dlcPayload.length > 0) {
        const { error: dlcError } = await supabase.from('dlcs').upsert(dlcPayload, { onConflict: 'id' });
        if (dlcError) console.error('Error saving dlcs:', dlcError);
      }

      // 3. Save Game Versions
      const versionsToSave = gameVersions.map((gv) => {
        let vDownloadUrl = '';
        if (gv.mirrors && gv.mirrors.length > 0) {
          vDownloadUrl = serializeMirrors(gv.mirrors);
        } else if (gv.download_url && gv.download_url.trim() !== '') {
          vDownloadUrl = gv.download_url.trim();
        }

        return {
          ...(gv.id ? { id: gv.id } : {}),
          game_id: gameId,
          version_name: gv.version_name,
          build_id: gv.build_id || null,
          release_date: gv.release_date || null,
          is_available: gv.is_available ?? true,
          download_url: vDownloadUrl,
          changelog_title: gv.changelog_title || null,
          changelog_body: gv.changelog_body || null,
        };
      });

      if (versionsToSave.length > 0) {
        const { data: savedVersionsData, error: versionError } = await supabase
          .from('game_versions')
          .upsert(versionsToSave, { onConflict: 'game_id,version_name' })
          .select('id, version_name');

        if (versionError) {
          console.error('Error al guardar versiones:', versionError);
          alert(`Aviso: Error al guardar versiones (${versionError.message}). Por favor verifica las políticas RLS en Supabase.`);
        }

        // 4. Save Version DLCs Associations
        if (savedVersionsData && savedVersionsData.length > 0) {
          const versionIds = savedVersionsData.map((v) => v.id);
          await supabase.from('game_version_dlcs').delete().in('game_version_id', versionIds);

          const gvdPayload: any[] = [];
          savedVersionsData.forEach((sv) => {
            // Find key in versionDlcs by either id or version_name
            const dlcIds = versionDlcs[sv.id] || versionDlcs[sv.version_name] || [];
            dlcIds.forEach((dlcId) => {
              gvdPayload.push({
                game_version_id: sv.id,
                dlc_id: dlcId,
              });
            });
          });

          if (gvdPayload.length > 0) {
            const { error: gvdError } = await supabase.from('game_version_dlcs').insert(gvdPayload);
            if (gvdError) console.error('Error saving game_version_dlcs:', gvdError);
          }
        }
      }
    }

    setSaving(false);
    setModalOpen(false);
    fetchCatalog();
  };

  const handleDelete = async (gameId: string, gameTitle: string) => {
    if (!confirm(`¿Eliminar definitivamente "${gameTitle}"? Se borrarán sus versiones y DLCs.`)) return;
    await supabase.from('games').delete().eq('id', gameId);
    fetchCatalog();
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0B0E14' }}>
      {/* Top Navigation & Action Header */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: '#0F1219',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#818CF8',
              boxShadow: '0 4px 16px rgba(99,102,241,0.25)',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '18px', color: '#E2E8F0', fontWeight: 800, letterSpacing: '-0.01em' }}>
              Catálogo de Juegos & Centro de Administración
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
              Gestiona títulos, multiversiones, mirrors de descarga, recetas y DLCs para el launcher
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchCatalog}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw size={13} /> Refrescar
          </button>

          <button
            onClick={openCreateModal}
            style={{
              padding: '9px 18px',
              borderRadius: '10px',
              backgroundColor: '#6366F1',
              border: 'none',
              color: '#FFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
            }}
          >
            <Plus size={16} /> Publicar Nuevo Juego
          </button>
        </div>
      </div>

      {/* Dashboard Stats & Search/Filter Toolbar */}
      <div
        style={{
          padding: '14px 24px',
          backgroundColor: '#121620',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* Metric Pills */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Layers size={14} style={{ color: '#818CF8' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Catálogo:</span>
            <strong style={{ fontSize: '12px', color: '#E2E8F0' }}>{games.length} juegos</strong>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(249,115,22,0.1)',
              border: '1px solid rgba(249,115,22,0.25)',
            }}
          >
            <Flame size={14} style={{ color: '#F97316' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Peticiones Totales:</span>
            <strong style={{ fontSize: '12px', color: '#FB923C' }}>{totalRequests}</strong>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
            }}
          >
            <MessageSquare size={14} style={{ color: '#EF4444' }} />
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Con Solicitudes:</span>
            <strong style={{ fontSize: '12px', color: '#FCA5A5' }}>{pendingUpdateGames} juegos</strong>
          </div>
        </div>

        {/* Search Input & Sort Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Quick Search */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.1)',
              width: '240px',
            }}
          >
            <Search size={14} style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Buscar por título, dev o key..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#E2E8F0',
                fontSize: '12px',
                width: '100%',
              }}
            />
            {catalogSearch && (
              <button
                onClick={() => setCatalogSearch('')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0 }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setFilterType('all')}
              style={{
                padding: '6px 10px',
                backgroundColor: filterType === 'all' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.03)',
                color: filterType === 'all' ? '#FFF' : 'rgba(255,255,255,0.6)',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('requests')}
              style={{
                padding: '6px 10px',
                backgroundColor: filterType === 'requests' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.03)',
                color: filterType === 'requests' ? '#FCA5A5' : 'rgba(255,255,255,0.6)',
                fontSize: '11px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              🔥 Solicitados ({pendingUpdateGames})
            </button>
          </div>

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpDown size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#E2E8F0',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="requests">🔥 Más Solicitados</option>
              <option value="recent">🕒 Agregados Recientemente</option>
              <option value="alphabetical">🔤 Alfabético (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Grid of Games */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {loading ? (
          <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '60px' }}>
            Cargando catálogo desde Supabase...
          </div>
        ) : displayedGames.length === 0 ? (
          <div
            style={{
              padding: '48px',
              textAlign: 'center',
              backgroundColor: '#131722',
              borderRadius: '16px',
              border: '1px dashed rgba(255,255,255,0.1)',
            }}
          >
            <Layers size={44} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '12px' }} />
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
              {catalogSearch ? 'No se encontraron juegos con esa búsqueda.' : 'No hay juegos en la base de datos.'}
            </p>
            <button
              onClick={openCreateModal}
              style={{
                marginTop: '16px',
                padding: '8px 16px',
                borderRadius: '8px',
                backgroundColor: '#6366F1',
                border: 'none',
                color: '#FFF',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Publicar un Juego
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '18px' }}>
            {displayedGames.map((g) => {
              const reqCount = g.request_count || 0;
              const isHighPriority = reqCount > 5;
              const isMediumPriority = reqCount > 0 && reqCount <= 5;

              return (
                <div
                  key={g.id}
                  style={{
                    borderRadius: '14px',
                    backgroundColor: '#131722',
                    border: isHighPriority
                      ? '1px solid rgba(239,68,68,0.45)'
                      : isMediumPriority
                      ? '1px solid rgba(245,158,11,0.35)'
                      : '1px solid rgba(255,255,255,0.08)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    transition: 'transform 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.5)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = isHighPriority
                      ? 'rgba(239,68,68,0.45)'
                      : isMediumPriority
                      ? 'rgba(245,158,11,0.35)'
                      : '1px solid rgba(255,255,255,0.08)';
                  }}
                >
                  {/* Card Cover with Version badge & Logo */}
                  <div style={{ height: '145px', backgroundColor: '#07090E', position: 'relative', overflow: 'hidden' }}>
                    {g.cover_image_url ? (
                      <img
                        src={g.cover_image_url}
                        alt={g.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '32px' }}>
                        🎮
                      </div>
                    )}

                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, rgba(19,23,34,0.9) 0%, transparent 60%)',
                      }}
                    />

                    {/* Version Badge */}
                    <span
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(8px)',
                        color: '#A5B4FC',
                        fontSize: '11px',
                        fontWeight: 800,
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      {g.latest_official_version}
                    </span>

                    {/* AppID pill if available */}
                    {g.steam_appid && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '8px',
                          left: '8px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          color: 'rgba(255,255,255,0.6)',
                          fontSize: '9px',
                          fontWeight: 700,
                        }}
                      >
                        ID: {g.steam_appid}
                      </span>
                    )}
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '10px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 3px', fontSize: '14px', color: '#E2E8F0', fontWeight: 700, lineHeight: 1.3 }}>
                        {g.title}
                      </h3>
                      <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}>
                        {g.developer} · {g.genre}
                      </p>
                    </div>

                    {/* Footer Actions & Requests status */}
                    <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {isHighPriority ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(239,68,68,0.2)',
                            border: '1px solid rgba(239,68,68,0.4)',
                            color: '#FCA5A5',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          <Flame size={12} style={{ color: '#EF4444' }} /> {reqCount} peticiones
                        </span>
                      ) : isMediumPriority ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(245,158,11,0.15)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            color: '#FDE047',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}
                        >
                          <MessageSquare size={12} style={{ color: '#F59E0B' }} /> {reqCount} peticiones
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.25)',
                            color: '#6EE7B7',
                            fontSize: '10px',
                            fontWeight: 600,
                          }}
                        >
                          <CheckCircle2 size={11} style={{ color: '#10B981' }} /> Al día
                        </span>
                      )}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(g)}
                          title="Editar metadatos, versiones y DLCs"
                          style={{
                            padding: '6px 8px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: 'rgba(255,255,255,0.85)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                          }}
                        >
                          <Edit2 size={12} /> Editar
                        </button>

                        <button
                          onClick={() => handleDelete(g.id!, g.title)}
                          title="Eliminar juego del catálogo"
                          style={{
                            padding: '6px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#FCA5A5',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Trash2 size={12} />
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '24px',
          }}
        >
          <div
            style={{
              width: '620px',
              backgroundColor: '#151922',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
            }}
          >
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Search size={18} style={{ color: '#F59E0B' }} />
                <h3 style={{ margin: 0, color: '#E2E8F0', fontSize: '15px', fontWeight: 700 }}>
                  Buscar Juego en Steam Store
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSearchSteam}
              style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '8px' }}
            >
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Escribe el nombre del juego (ej: Cyberpunk 2077, Elden Ring, Hades)..."
                autoFocus
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#E2E8F0',
                  fontSize: '13px',
                }}
              />
              <button
                type="submit"
                disabled={searchingSteam}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#F59E0B',
                  border: 'none',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
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
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(99,102,241,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(255,255,255,0.03)';
                    }}
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

      {/* Main Create / Edit Game Modal with 5 Navigation Tabs */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '18px',
          }}
        >
          <form
            onSubmit={handleSave}
            style={{
              width: '1000px',
              maxWidth: '96vw',
              height: '90vh',
              backgroundColor: '#11151F',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '20px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)',
              overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: '#161B26',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(99,102,241,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#818CF8',
                  }}
                >
                  {editingGame ? <Edit2 size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, color: '#E2E8F0', fontSize: '16px', fontWeight: 800 }}>
                    {editingGame ? `Editar: ${editingGame.title}` : 'Publicar Nuevo Juego'}
                  </h3>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>
                    Metadatos completos, multiversión, arte visual y recetas de instalación
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs Bar */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: '#0D1017',
                padding: '0 24px',
                gap: '4px',
                overflowX: 'auto',
              }}
            >
              {[
                { key: 'info', label: '1. Información', icon: <FileText size={15} /> },
                { key: 'media', label: '2. Banners & Media', icon: <ImageIcon size={15} /> },
                { key: 'versions', label: `3. Versiones (${gameVersions.length})`, icon: <Tag size={15} /> },
                { key: 'install', label: '4. Rutas & Receta', icon: <Zap size={15} /> },
                { key: 'dlc_reqs', label: `5. DLCs (${dlcsList.length}) & Requisitos`, icon: <LayoutGrid size={15} /> },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModalTab(tab.key as any)}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderBottom: modalTab === tab.key ? '2px solid #6366F1' : '2px solid transparent',
                    color: modalTab === tab.key ? '#FFF' : 'rgba(255,255,255,0.5)',
                    fontSize: '13px',
                    fontWeight: modalTab === tab.key ? 700 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ color: modalTab === tab.key ? '#818CF8' : 'inherit' }}>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Modal Body Scrollable */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* TAB 1: INFORMACIÓN BÁSICA */}
              {modalTab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                      Título del Juego *
                    </label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      placeholder="Cyberpunk 2077"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                        Clave Única (key)
                      </label>
                      <input
                        value={gameKey}
                        onChange={(e) => setGameKey(e.target.value)}
                        placeholder="cyberpunk2077"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                        Género
                      </label>
                      <input
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder="RPG / Mundo Abierto"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                        Steam AppID
                      </label>
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
                            whiteSpace: 'nowrap',
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
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <Search size={13} /> Buscar
                        </button>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                        Desarrollador
                      </label>
                      <input
                        value={developer}
                        onChange={(e) => setDeveloper(e.target.value)}
                        placeholder="CD PROJEKT RED"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                        Editor / Publisher
                      </label>
                      <input
                        value={publisher}
                        onChange={(e) => setPublisher(e.target.value)}
                        placeholder="CD PROJEKT RED"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                      Descripción del Juego
                    </label>
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

              {/* TAB 2: ARTE VISUAL & PREVIEWS (Multi-Banner support + Enhanced image previews) */}
              {modalTab === 'media' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Multi-Banner Component */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <MultiBannerPreview bannerUrlsText={bannerUrl} onChange={setBannerUrl} />
                  </div>

                  {/* Other Visual Assets Grid (Cover, Logo, Icon) */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px' }}>
                    {/* Cover 2:3 Preview Card */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>
                        PORTADA (COVER 2:3)
                      </label>
                      <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {coverUrl ? (
                          <img src={coverUrl} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Eye size={20} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <input
                        value={coverUrl}
                        onChange={(e) => setCoverUrl(e.target.value)}
                        placeholder="https://.../cover.jpg"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '11px' }}
                      />
                    </div>

                    {/* Transparent Logo Preview Card */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>
                        LOGO TRANSPARENTE (PNG)
                      </label>
                      <div
                        style={{
                          height: '140px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          backgroundColor: '#0E131E',
                          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
                          backgroundSize: '12px 12px',
                          border: '1px solid rgba(255,255,255,0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '10px',
                        }}
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.8))' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Eye size={20} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <input
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://.../logo.png"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '11px' }}
                      />
                    </div>

                    {/* Mini Icon Preview Card */}
                    <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 700, letterSpacing: '0.05em' }}>
                        ÍCONO MINI (32x32)
                      </label>
                      <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#000', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {iconUrl ? (
                          <img src={iconUrl} alt="Icon" style={{ width: '64px', height: '64px', borderRadius: '14px', objectFit: 'cover', boxShadow: '0 4px 16px rgba(0,0,0,0.6)' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Eye size={20} style={{ color: 'rgba(255,255,255,0.3)' }} />
                        )}
                      </div>
                      <input
                        value={iconUrl}
                        onChange={(e) => setIconUrl(e.target.value)}
                        placeholder="https://.../icon.png"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '11px' }}
                      />
                    </div>
                  </div>

                  {/* Dev & Publisher Logos */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                        Logo Desarrollador (URL)
                      </label>
                      <input
                        value={developerLogoUrl}
                        onChange={(e) => setDeveloperLogoUrl(e.target.value)}
                        placeholder="https://.../dev-logo.png"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                        Logo Editor (URL)
                      </label>
                      <input
                        value={publisherLogoUrl}
                        onChange={(e) => setPublisherLogoUrl(e.target.value)}
                        placeholder="https://.../pub-logo.png"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '12px' }}
                      />
                    </div>
                  </div>

                  {/* Screenshots Gallery with Lightbox Zoom */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ImageIcon size={16} style={{ color: '#818CF8' }} />
                        <label style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 700 }}>
                          Galería de Capturas de Pantalla ({screenshotsText.split('\n').filter((s) => s.trim()).length})
                        </label>
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                        Haz clic sobre cualquier imagen para verla en pantalla completa
                      </span>
                    </div>

                    {/* Quick Add */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        value={newScreenshotUrl}
                        onChange={(e) => setNewScreenshotUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddScreenshot();
                          }
                        }}
                        placeholder="Pegar URL de captura de pantalla (ej: https://.../screen.jpg)..."
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

                    {/* Grid of Thumbnails */}
                    {screenshotsText.split('\n').filter((s) => s.trim()).length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', marginTop: '4px' }}>
                        {screenshotsText
                          .split('\n')
                          .filter((s) => s.trim())
                          .map((url, idx) => (
                            <div
                              key={idx}
                              onClick={() => setLightboxUrl(url.trim())}
                              style={{
                                position: 'relative',
                                height: '90px',
                                borderRadius: '10px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.1)',
                                backgroundColor: '#000',
                                cursor: 'zoom-in',
                              }}
                            >
                              <img
                                src={url.trim()}
                                alt={`SS ${idx + 1}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveScreenshot(idx);
                                }}
                                title="Eliminar captura"
                                style={{
                                  position: 'absolute',
                                  top: '4px',
                                  right: '4px',
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  backgroundColor: 'rgba(0,0,0,0.8)',
                                  border: '1px solid rgba(255,255,255,0.2)',
                                  color: '#FF4D4D',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                }}
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
                  </div>
                </div>
              )}

              {/* TAB 3: GESTOR COMPLETO DE MULTIVERSIONES */}
              {modalTab === 'versions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#E2E8F0', fontWeight: 700 }}>
                        Versiones Registradas ({gameVersions.length})
                      </h4>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
                        Gestiona múltiples versiones para permitir a los usuarios elegir qué versión jugar o instalar
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setVersionSortOrder(versionSortOrder === 'desc' ? 'asc' : 'desc')}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: '#E2E8F0',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        title={versionSortOrder === 'desc' ? 'Orden actual: Mayor a menor (más recientes primero)' : 'Orden actual: Menor a mayor (más antiguas primero)'}
                      >
                        <ArrowUpDown size={13} style={{ color: '#818CF8' }} />
                        <span>{versionSortOrder === 'desc' ? 'Mayor a menor' : 'Menor a mayor'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSyncSteamVersions}
                        disabled={syncingSteamVersions}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          color: '#A5B4FC',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: syncingSteamVersions ? 'wait' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                        title="Buscar automáticamente versiones y Build IDs desde Steam para este juego"
                      >
                        <RefreshCw size={13} className={syncingSteamVersions ? 'animate-spin' : ''} />
                        {syncingSteamVersions ? 'Buscando...' : 'Sincronizar desde Steam'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditingVersion(null);
                          setVersionModalOpen(true);
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '10px',
                          backgroundColor: '#6366F1',
                          border: 'none',
                          color: '#FFF',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                        }}
                      >
                        <Plus size={14} /> Nueva Versión
                      </button>
                    </div>
                  </div>

                  {gameVersions.length === 0 ? (
                    <div style={{ padding: '36px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                      No hay versiones configuradas. Haz clic en "Nueva Versión" arriba para agregar una.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {displayedVersions.map((v, idx) => {
                        const versionMirrors = v.mirrors || parseMirrors(v.download_url);
                        const assignedDlcsCount = (versionDlcs[v.id || v.version_name] || []).length;

                        return (
                          <div
                            key={v.id || v.version_name || idx}
                            style={{
                              padding: '14px 16px',
                              borderRadius: '12px',
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                              <span
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: v.is_available ? '#6366F1' : 'rgba(255,255,255,0.1)',
                                  color: '#FFF',
                                  fontSize: '13px',
                                  fontWeight: 800,
                                }}
                              >
                                {v.version_name}
                              </span>

                              <div>
                                <div style={{ color: '#E2E8F0', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{v.changelog_title || 'Sin título de notas'}</span>
                                  {v.build_id && (
                                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                                      (Build {v.build_id})
                                    </span>
                                  )}
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px', marginTop: '2px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                                  <span>📅 {v.release_date || 'Sin fecha'}</span>
                                  <span style={{ color: '#10B981', fontWeight: 600 }}>
                                    📦 {assignedDlcsCount} DLCs asignados
                                  </span>
                                  <span style={{ color: '#A5B4FC', fontWeight: 600 }}>
                                    🔗 {versionMirrors.length} {versionMirrors.length === 1 ? 'mirror' : 'mirrors'} de descarga
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: v.is_available ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                                  color: v.is_available ? '#10B981' : 'rgba(255,255,255,0.4)',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                }}
                              >
                                {v.is_available ? '🟢 Disponible' : '⚪ Histórica'}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingVersion(v);
                                  setVersionModalOpen(true);
                                }}
                                style={{
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(255,255,255,0.06)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  color: '#E2E8F0',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Edit2 size={12} /> Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Eliminar la versión ${v.version_name}?`)) {
                                    if (v.id) handleDeleteVersion(v.id);
                                    else setGameVersions((prev) => prev.filter((item) => item.version_name !== v.version_name));
                                  }
                                }}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(239,68,68,0.15)',
                                  border: '1px solid rgba(239,68,68,0.3)',
                                  color: '#EF4444',
                                  cursor: 'pointer',
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: RUTAS & RECETA DE INSTALACIÓN */}
              {modalTab === 'install' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                        Ruta Relativa Ejecutable *
                      </label>
                      <input
                        value={executableRelativePath}
                        onChange={(e) => setExecutableRelativePath(e.target.value)}
                        required
                        placeholder="Cyberpunk2077.exe"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontWeight: 600 }}>
                        Ruta de Guardado (Save Path)
                      </label>
                      <input
                        value={savePathPattern}
                        onChange={(e) => setSavePathPattern(e.target.value)}
                        placeholder="%APPDATA%/CD Projekt Red/Cyberpunk 2077"
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  {/* Visual Recipe Builder */}
                  <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                    <VisualRecipeBuilder steps={steps} onChange={setSteps} defaultDownloadUrl="" defaultTitle={title} />
                  </div>
                </div>
              )}

              {/* TAB 5: DLCS & REQUISITOS & MATRIZ POR VERSIÓN */}
              {modalTab === 'dlc_reqs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* Master DLCs Header & Bulk Import */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Package size={18} style={{ color: '#818CF8' }} />
                        <label style={{ fontSize: '14px', color: '#E2E8F0', fontWeight: 700 }}>
                          Catálogo Maestro de DLCs ({dlcsList.length} DLCs)
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
                            gap: '5px',
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
                            gap: '5px',
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
                              cursor: 'pointer',
                            }}
                          >
                            🗑️ Vaciar ({dlcsList.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Bulk DLC Import Panel */}
                    {showBulkDlcImport && (
                      <div
                        style={{
                          padding: '14px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(245,158,11,0.06)',
                          border: '1px solid rgba(245,158,11,0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ color: '#FDE047', fontSize: '12px', fontWeight: 700 }}>
                          📋 Pegar Lista de DLCs (Formato AppID=Nombre o Texto plano)
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', lineHeight: '1.4' }}>
                          Pega tus líneas en formato <code style={{ color: '#A5B4FC' }}>2306801=Monster Hunter Rise - Special Stickers</code> o nombres directos.
                        </div>
                        <textarea
                          value={bulkDlcText}
                          onChange={(e) => setBulkDlcText(e.target.value)}
                          rows={6}
                          placeholder="2306801=Monster Hunter Rise - Special Stickers 14&#10;2306802=Monster Hunter Rise - Special Stickers 15&#10;Monster Hunter Rise - Sunbreak Expansion"
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            color: '#E2E8F0',
                            fontSize: '12px',
                            fontFamily: 'monospace',
                          }}
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

                    {/* Master DLC Items Edit / Remove List */}
                    {dlcsList.length > 0 && (
                      <details style={{ marginTop: '4px' }}>
                        <summary style={{ color: '#A5B4FC', fontSize: '11px', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                          ✏️ Ver / Editar títulos individuales de los {dlcsList.length} DLCs
                        </summary>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', marginTop: '8px', paddingRight: '4px' }}>
                          {dlcsList.map((dlc, idx) => (
                            <div key={dlc.id || idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <input
                                value={dlc.name}
                                onChange={(e) => handleUpdateDlc(idx, 'name', e.target.value)}
                                placeholder="Nombre del DLC"
                                style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', backgroundColor: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '11px' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveDlc(idx)}
                                title="Eliminar DLC"
                                style={{ padding: '4px 6px', borderRadius: '6px', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer' }}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>

                  {/* Matrix Component: Association per version */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                    <DlcVersionMatrix
                      versions={gameVersions}
                      dlcs={dlcsList.filter((d) => d.name.trim() !== '')}
                      versionDlcs={versionDlcs}
                      onChangeVersionDlcs={setVersionDlcs}
                    />
                  </div>

                  {/* Controller & System Requirements */}
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#E2E8F0', fontSize: '13px', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={controllerSupport}
                        onChange={(e) => setControllerSupport(e.target.checked)}
                        style={{ accentColor: '#6366F1', width: '18px', height: '18px' }}
                      />
                      🎮 Soporte para mando completo
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                          Requisitos Mínimos del Sistema
                        </label>
                        <input
                          value={reqMin}
                          onChange={(e) => setReqMin(e.target.value)}
                          placeholder="OS: Windows 10 64-bit | RAM: 8 GB"
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                          Requisitos Recomendados del Sistema
                        </label>
                        <input
                          value={reqRec}
                          onChange={(e) => setReqRec(e.target.value)}
                          placeholder="OS: Windows 11 64-bit | RAM: 16 GB"
                          style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', backgroundColor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#E2E8F0', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: '#161B26',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
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

      {/* Version Manager Sub-Modal */}
      <VersionManagerModal
        version={editingVersion}
        isOpen={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        onSave={handleSaveVersion}
        onDelete={handleDeleteVersion}
        allExistingVersions={gameVersions}
      />

      {/* Screenshot Lightbox Modal */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.92)',
            zIndex: 20000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            cursor: 'zoom-out',
          }}
        >
          <img
            src={lightboxUrl}
            alt="Enlarged screenshot"
            style={{
              maxWidth: '92vw',
              maxHeight: '92vh',
              borderRadius: '12px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)',
              objectFit: 'contain',
            }}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#FFF',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};
