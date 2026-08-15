import { createClient } from '@supabase/supabase-js';
import { Game, GAMES } from '../data/games';

const SUPABASE_URL = import.meta.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface RecipeStep {
  action: string;
  provider?: string;
  url?: string;
  source_folder?: string;
  target_folder?: string;
  path?: string;
  shortcut_name?: string;
}

export interface SupabaseGame {
  id: string;
  game_key: string;
  title: string;
  steam_appid?: number;
  developer: string;
  publisher: string;
  developer_logo_url?: string;
  publisher_logo_url?: string;
  genre: string;
  release_date?: string;
  cover_image_url?: string;
  header_banner_url?: string;
  logo_image_url?: string;
  icon_url?: string;
  save_path_pattern?: string;
  description?: string;
  latest_official_version: string;
  size_bytes: number;
  download_url: string;
  executable_relative_path: string;
  is_active: boolean;
  request_count: number;
  available_versions?: { version: string; url: string; notes?: string; releaseDate?: string }[];
  dlcs?: { id: string; game_id: string; name: string }[];
  game_versions?: { id: string; version_name: string; game_version_dlcs?: { game_version_id: string; dlc_id: string }[] }[];
  controller_support?: boolean;
  requirements?: { min: string; rec: string };
  screenshots?: string[];
  installation_recipes?: {
    steps: RecipeStep[];
  }[];
}

export async function fetchGamesFromSupabase(): Promise<Game[]> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select(`
        *,
        installation_recipes (
          steps
        ),
        game_versions (
          *,
          game_version_dlcs (*)
        ),
        dlcs (*)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching from Supabase, falling back to local data:', error.message);
      return GAMES;
    }

    if (!data || data.length === 0) {
      console.log('No games found in Supabase table. Using local data.');
      return GAMES;
    }

    // Map Supabase rows to App Game models
    return data.map((row: any, index: number) => {
      const rawRecipe = row.installation_recipes;
      const recipeSteps = Array.isArray(rawRecipe)
        ? rawRecipe[0]?.steps || []
        : rawRecipe?.steps || [];

      const sizeNum = Number(row.size_bytes) || 0;
      const sizeMB = sizeNum > 0 ? (sizeNum / (1024 * 1024)).toFixed(0) + ' MB' : 'Varios MB';

      const screenshots = Array.isArray(row.screenshots) && row.screenshots.length > 0
        ? row.screenshots
        : [row.cover_image_url || 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600'];

      const dlcs = Array.isArray(row.dlcs) ? row.dlcs : [];
      let gameVersionDlcs: { game_version_id: string; dlc_id: string }[] = [];
      if (Array.isArray(row.game_versions)) {
        row.game_versions.forEach((v: any) => {
          if (Array.isArray(v.game_version_dlcs)) {
            gameVersionDlcs = gameVersionDlcs.concat(v.game_version_dlcs);
          }
        });
      }

      const reqs = row.requirements && typeof row.requirements === 'object'
        ? {
            min: row.requirements.min || 'OS: Windows 10 64-bit | RAM: 8 GB | DirectX 11',
            rec: row.requirements.rec || 'OS: Windows 11 64-bit | RAM: 16 GB | DirectX 12',
          }
        : {
            min: 'OS: Windows 10 64-bit | RAM: 8 GB | DirectX 11',
            rec: 'OS: Windows 11 64-bit | RAM: 16 GB | DirectX 12',
          };

      // Proceso de versiones y changelog
      const versions = Array.isArray(row.game_versions) ? row.game_versions : [];
      
      // Ordenar versiones de más nueva a más vieja por fecha
      versions.sort((a: any, b: any) => {
        const dateA = a.release_date ? new Date(a.release_date).getTime() : 0;
        const dateB = b.release_date ? new Date(b.release_date).getTime() : 0;
        return dateB - dateA;
      });

      const availableVersions: any[] = [];
      const changelog: any[] = [];

      versions.forEach((v: any) => {
        let vUrl = v.download_url || '';
        if (typeof vUrl === 'string' && vUrl.trim().startsWith('[') && vUrl.trim().endsWith(']')) {
          try {
            const parsed = JSON.parse(vUrl.trim());
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url) {
              vUrl = parsed[0].url;
            }
          } catch {
            // fallback
          }
        }

        let cleanBody = v.changelog_body || '';
        cleanBody = cleanBody.replace(/\[\/?(b|i|u|url|img)\]/gi, '').trim();

        const entryNotes: string[] = [];
        if (v.changelog_title && v.changelog_title.trim()) {
          entryNotes.push(v.changelog_title.trim());
        }
        if (cleanBody) {
          entryNotes.push(cleanBody);
        }

        // 1. SIEMPRE agregar a changelog (Notas de parche y comentarios de la comunidad para la pestaña 'Detalles')
        changelog.push({
          version: v.changelog_title || v.version_name || 'Actualización / Anuncio',
          date: v.release_date ? new Date(v.release_date).toISOString().split('T')[0] : '',
          notes: entryNotes.length > 0 ? entryNotes : [v.version_name || 'Actualización de Steam'],
        });

        // 2. Extracción de versión real para la pestaña 'Versiones' y selector
        const rawVer = (v.version_name || '').trim();
        const hasDl = Boolean(vUrl && vUrl.trim() !== '');

        // Verificar si es un nombre basado en fecha (ej: 'Update 2026-07-15')
        const isDatePlaceholder = /^update\s+\d{4}[-\/\.]\d{2}[-\/\.]\d{2}/i.test(rawVer) || /^\d{4}[-\/\.]\d{2}[-\/\.]\d{2}$/.test(rawVer);

        let realVersionName: string | null = null;

        if (hasDl) {
          // Si tiene enlace de descarga asignado por el admin, siempre se conserva
          realVersionName = rawVer;
        } else if (!isDatePlaceholder) {
          // Si no es fecha y tiene formato de versión semántica (v1.0.13, 1.0.13, Build 12345)
          const semVer = rawVer.match(/^v?\.?\s*(\d+(\.\d+)+([a-z]|\-rc\d+|\-beta\d+|\-hotfix\d*|\.hotfix\d*)?)$/i);
          if (semVer) {
            realVersionName = `v${semVer[1].replace(/^v\.?/i, '')}`;
          } else if (/^build\s*#?\s*\d+$/i.test(rawVer)) {
            realVersionName = rawVer;
          } else if (/^(patch|hotfix|version|ver)\s*#?\s*\d+(\.\d+)*$/i.test(rawVer)) {
            realVersionName = rawVer;
          }
        }

        // Si era un placeholder de fecha pero el título o body contiene la versión real (ej: "Patch Notes - Version 1.0.10")
        if (!realVersionName && isDatePlaceholder) {
          const searchTxt = `${v.changelog_title || ''} ${cleanBody}`;
          const found = searchTxt.match(/\b(v\.?\s*\d+(\.\d+)+|version\s*\d+(\.\d+)+|ver\.\s*\d+(\.\d+)+)/i);
          if (found) {
            const num = found[0].replace(/^(v|version|ver)\.?\s*/i, '').trim();
            if (num && !/^\d{4}$/.test(num)) {
              realVersionName = `v${num}`;
            }
          }
        }

        // Si es una versión real válida, agregarla a availableVersions
        if (realVersionName) {
          // Evitar duplicar la misma versión
          const exists = availableVersions.some((item) => item.version.toLowerCase() === realVersionName!.toLowerCase());
          if (!exists) {
            availableVersions.push({
              id: v.id,
              version: realVersionName,
              url: vUrl,
              downloadUrl: vUrl,
              hasDownload: hasDl,
              isAvailable: v.is_available !== false && hasDl,
              buildId: v.build_id || '',
              changelogTitle: v.changelog_title || '',
              changelogBody: cleanBody,
              notes: entryNotes,
              releaseDate: v.release_date ? new Date(v.release_date).toISOString().split('T')[0] : '',
            });
          }
        }
      });

      // La versión más reciente es la última versión con link de descarga, o la primera del historial
      const latestDownloadable = availableVersions.find((v) => v.url && v.url.trim() !== '');
      const resolvedLatestVersion = latestDownloadable?.version || availableVersions[0]?.version || row.latest_official_version || 'v1.0';
      const resolvedDownloadUrl = latestDownloadable?.url || row.download_url || '';

      return {
        id: index + 1, // Unique numeric ID for frontend list keying
        uuid: row.id,
        gameKey: row.game_key,
        title: row.title,
        developer: row.developer || 'Indie Developer',
        publisher: row.publisher || 'Indie Publisher',
        developerLogoUrl: row.developer_logo_url || undefined,
        publisherLogoUrl: row.publisher_logo_url || undefined,
        releaseDate: row.release_date || '2024',
        genre: row.genre || 'Aventura',
        description: row.description || 'Sin descripción disponible.',
        cover: row.cover_image_url || 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
        banner: row.header_banner_url || row.cover_image_url || 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
        screenshots,
        status: 'not_installed',
        currentVersion: '',
        installedVersions: [],
        latestVersion: resolvedLatestVersion,
        hoursPlayed: 0,
        requirements: reqs,
        changelog: changelog,
        requestCount: row.request_count || 0,
        dlcs,
        gameVersionDlcs,
        controllerSupport: row.controller_support ?? true,
        size: sizeMB,
        downloadUrl: resolvedDownloadUrl,
        executableRelativePath: row.executable_relative_path,
        steamAppId: row.steam_appid || undefined,
        availableVersions: availableVersions,
        logoUrl: row.logo_image_url || undefined,
        iconUrl: row.icon_url || undefined,
        savePathPattern: row.save_path_pattern || undefined,
        recipeSteps: recipeSteps
      };
    });
  } catch (err) {
    console.error('Exception connecting to Supabase:', err);
    return GAMES;
  }
}

export async function requestGameUpdate(gameUuid: string, currentCount: number = 0): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('games')
      .update({ request_count: currentCount + 1 })
      .eq('id', gameUuid);

    if (error) {
      console.error('Error requesting update from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception requesting update:', err);
    return false;
  }
}

export async function requestSpecificVersion(
  gameUuid: string,
  versionRequested: string,
  customMessage: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('version_requests')
      .insert({
        game_id: gameUuid,
        version_requested: versionRequested,
        custom_message: customMessage
      });

    if (error) {
      console.error('Error requesting specific version from Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Exception requesting specific version:', err);
    return false;
  }
}
