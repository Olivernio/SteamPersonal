import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface DownloadMirror {
  provider: string;
  url: string;
}

export interface DlcItem {
  id?: string;
  game_id?: string;
  name: string;
  created_at?: string;
}

export interface DbGameVersion {
  id?: string;
  game_id: string;
  version_name: string;
  build_id?: string;
  release_date?: string;
  download_url?: string;
  is_available?: boolean;
  changelog_title?: string;
  changelog_body?: string;
  source?: string;
  event_id?: string;
  created_at?: string;
  updated_at?: string;
  mirrors?: DownloadMirror[];
}

export interface DbGame {
  id?: string;
  game_key: string;
  title: string;
  steam_appid?: number;
  developer?: string;
  publisher?: string;
  developer_logo_url?: string;
  publisher_logo_url?: string;
  genre?: string;
  release_date?: string;
  cover_image_url?: string;
  header_banner_url?: string;
  logo_image_url?: string;
  icon_url?: string;
  save_path_pattern?: string;
  description?: string;
  latest_official_version: string;
  size_bytes?: number;
  download_url: string;
  executable_relative_path: string;
  is_active: boolean;
  request_count?: number;
  controller_support?: boolean;
  requirements?: { min: string; rec: string };
  screenshots?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface RecipeStep {
  action: string;
  provider?: string;
  url?: string;
  source_folder?: string;
  target_folder?: string;
  path?: string;
  shortcut_name?: string;
}

export interface DbRecipe {
  id?: string;
  game_id: string;
  steps: RecipeStep[];
}

export const parseMirrors = (raw?: string): DownloadMirror[] => {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((m: any) => ({
          provider: typeof m === 'object' && m.provider ? m.provider : 'Servidor',
          url: typeof m === 'object' && m.url ? m.url : String(m),
        })).filter(m => m.url.trim() !== '');
      }
    } catch {
      // Fallback
    }
  }
  return trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, idx) => {
      if (line.includes('|')) {
        const [prov, url] = line.split('|');
        return { provider: prov.trim(), url: url.trim() };
      }
      return { provider: idx === 0 ? 'Principal' : `Mirror ${idx + 1}`, url: line };
    });
};

export const serializeMirrors = (mirrors: DownloadMirror[]): string => {
  const clean = mirrors.filter(m => m.url && m.url.trim() !== '');
  if (clean.length === 0) return '';
  if (clean.length === 1 && (clean[0].provider === 'Principal' || !clean[0].provider)) {
    return clean[0].url;
  }
  return JSON.stringify(clean);
};
