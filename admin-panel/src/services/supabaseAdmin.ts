import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Legacy mirror type (kept for backwards compat) ───────────────────────────
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
  mirrors?: DownloadMirror[];         // legacy (from download_url text)
  version_mirrors?: VersionMirror[];  // new relational mirrors
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

// ─── New: Per-Mirror recipe ───────────────────────────────────────────────────

/** A mirror entry stored in the version_mirrors table */
export interface VersionMirror {
  id?: string;
  game_version_id: string;
  provider: string;
  url: string;
  display_order: number;
  /** 'inherit' = use the game's base recipe; 'override' = use recipe_steps below */
  recipe_mode: 'inherit' | 'override';
  recipe_steps: RecipeStep[] | null;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// ─── New: Reusable recipe fragments ──────────────────────────────────────────

/** A reusable block of recipe steps the admin can apply to any mirror */
export interface RecipeFragment {
  id?: string;
  name: string;
  description?: string;
  steps: RecipeStep[];
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

// ─── CRUD: version_mirrors ────────────────────────────────────────────────────

/** Fetch all mirrors for a given game_version id */
export async function fetchVersionMirrors(gameVersionId: string): Promise<VersionMirror[]> {
  const { data, error } = await supabase
    .from('version_mirrors')
    .select('*')
    .eq('game_version_id', gameVersionId)
    .order('display_order', { ascending: true });
  if (error) {
    console.error('Error fetching version_mirrors:', error.message);
    return [];
  }
  return (data ?? []) as VersionMirror[];
}

/** Replace all mirrors for a game_version (delete existing, insert new) */
export async function saveVersionMirrors(
  gameVersionId: string,
  mirrors: Omit<VersionMirror, 'id' | 'game_version_id' | 'created_at' | 'updated_at'>[]
): Promise<boolean> {
  const { error: delErr } = await supabase
    .from('version_mirrors')
    .delete()
    .eq('game_version_id', gameVersionId);
  if (delErr) {
    console.error('Error deleting version_mirrors:', delErr.message);
    return false;
  }

  if (mirrors.length === 0) return true;

  const rows = mirrors.map((m, idx) => ({
    game_version_id: gameVersionId,
    provider: m.provider,
    url: m.url,
    display_order: idx,
    recipe_mode: m.recipe_mode,
    recipe_steps: m.recipe_mode === 'override' ? m.recipe_steps : null,
    notes: m.notes ?? null,
  }));

  const { error: insErr } = await supabase.from('version_mirrors').insert(rows);
  if (insErr) {
    console.error('Error inserting version_mirrors:', insErr.message);
    return false;
  }
  return true;
}

// ─── CRUD: recipe_fragments ───────────────────────────────────────────────────

export async function fetchRecipeFragments(): Promise<RecipeFragment[]> {
  const { data, error } = await supabase
    .from('recipe_fragments')
    .select('*')
    .order('name', { ascending: true });
  if (error) {
    console.error('Error fetching recipe_fragments:', error.message);
    return [];
  }
  return (data ?? []) as RecipeFragment[];
}

export async function upsertRecipeFragment(
  fragment: Omit<RecipeFragment, 'created_at' | 'updated_at'>
): Promise<RecipeFragment | null> {
  const payload = {
    ...(fragment.id ? { id: fragment.id } : {}),
    name: fragment.name,
    description: fragment.description ?? null,
    steps: fragment.steps,
    tags: fragment.tags,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('recipe_fragments')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error('Error upserting recipe_fragment:', error.message);
    return null;
  }
  return data as RecipeFragment;
}

export async function deleteRecipeFragment(fragmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('recipe_fragments')
    .delete()
    .eq('id', fragmentId);
  if (error) {
    console.error('Error deleting recipe_fragment:', error.message);
    return false;
  }
  return true;
}

// ─── CRUD: system_settings ───────────────────────────────────────────────────

export interface SystemSetting {
  key: string;
  value: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export async function fetchSystemSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('key, value');
  if (error) {
    console.error('Error fetching system_settings:', error.message);
    return {};
  }
  const result: Record<string, string> = {};
  (data || []).forEach((row: any) => {
    result[row.key] = row.value;
  });
  return result;
}

export async function upsertSystemSetting(key: string, value: string, description?: string): Promise<boolean> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      key,
      value,
      description: description ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  if (error) {
    console.error('Error upserting system_setting:', error.message);
    return false;
  }
  return true;
}

// ─── Legacy helpers (kept for backward compat) ────────────────────────────────

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

/** Convert a VersionMirror[] to DownloadMirror[] for legacy display */
export const versionMirrorsToLegacy = (mirrors: VersionMirror[]): DownloadMirror[] =>
  mirrors.map(m => ({ provider: m.provider, url: m.url }));



