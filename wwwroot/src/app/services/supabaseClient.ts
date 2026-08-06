import { createClient } from '@supabase/supabase-js';
import { Game, GAMES } from '../data/games';

const SUPABASE_URL = '***REMOVED***';
const SUPABASE_ANON_KEY = '';

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
  dlcs?: (string | DlcItem)[];
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
        )
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

      const reqs = row.requirements && typeof row.requirements === 'object'
        ? {
            min: row.requirements.min || 'OS: Windows 10 64-bit | RAM: 8 GB | DirectX 11',
            rec: row.requirements.rec || 'OS: Windows 11 64-bit | RAM: 16 GB | DirectX 12',
          }
        : {
            min: 'OS: Windows 10 64-bit | RAM: 8 GB | DirectX 11',
            rec: 'OS: Windows 11 64-bit | RAM: 16 GB | DirectX 12',
          };

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
        status: 'update_available',
        currentVersion: 'v1.0',
        latestVersion: row.latest_official_version || 'v1.0',
        hoursPlayed: 0,
        requirements: reqs,
        changelog: [
          {
            version: row.latest_official_version || 'v1.0',
            date: new Date().toISOString().split('T')[0],
            notes: ['Versión oficial del catálogo Supabase'],
          },
        ],
        requestCount: row.request_count || 0,
        dlcs,
        controllerSupport: row.controller_support ?? true,
        size: sizeMB,
        downloadUrl: row.download_url,
        executableRelativePath: row.executable_relative_path,
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
