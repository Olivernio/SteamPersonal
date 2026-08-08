import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface DlcItem {
  id?: string;
  name: string;
  image?: string;
  description?: string;
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
  size_bytes: number;
  download_url: string;
  executable_relative_path: string;
  is_active: boolean;
  request_count?: number;
  dlcs?: (string | DlcItem)[];
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
