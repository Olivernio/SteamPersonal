export interface SteamAppDetails {
  title: string;
  developer: string;
  publisher: string;
  genre: string;
  description: string;
  coverUrl: string;
  bannerUrl: string;
  iconUrl: string;
  releaseDate: string;
  gameKey: string;
  controllerSupport?: boolean;
  requirements?: { min: string; rec: string };
  screenshots?: string[];
}

/**
 * Fetches game metadata from the public Steam Store API.
 * Handles CORS via proxy if needed and parses details in Spanish.
 */
export async function fetchSteamGameDetails(appId: string | number): Promise<SteamAppDetails> {
  const cleanAppId = String(appId).trim();
  if (!cleanAppId || isNaN(Number(cleanAppId))) {
    throw new Error('Steam AppID inválido. Debe ser un número (ej: 1091500)');
  }

  const targetUrl = `https://store.steampowered.com/api/appdetails?appids=${cleanAppId}&l=spanish`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

  let response: Response;
  try {
    // Try CORS proxy first for local dev environment
    response = await fetch(proxyUrl);
    if (!response.ok) {
      // Fallback to direct fetch
      response = await fetch(targetUrl);
    }
  } catch {
    // Fallback to direct fetch
    response = await fetch(targetUrl);
  }

  if (!response.ok) {
    throw new Error(`Error de conexión con Steam (HTTP ${response.status})`);
  }

  const json = await response.json();
  const appData = json[cleanAppId];

  if (!appData || !appData.success || !appData.data) {
    throw new Error(`No se encontraron datos para el Steam AppID ${cleanAppId}. Verifica que exista en Steam.`);
  }

  const data = appData.data;

  // Clean HTML tags from description
  const rawDesc = data.short_description || data.about_the_game || '';
  const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '').trim();

  const developer = Array.isArray(data.developers) && data.developers.length > 0
    ? data.developers.join(', ')
    : 'Indie Developer';

  const publisher = Array.isArray(data.publishers) && data.publishers.length > 0
    ? data.publishers.join(', ')
    : 'Indie Publisher';

  const genre = Array.isArray(data.genres) && data.genres.length > 0
    ? data.genres.map((g: any) => g.description).join(' / ')
    : 'Acción / Aventura';

  const coverUrl = data.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${cleanAppId}/header.jpg`;
  const bannerUrl = data.background || data.header_image || '';
  const iconUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${cleanAppId}/capsule_sm_120.jpg`;
  const releaseDate = data.release_date?.date || new Date().toISOString().split('T')[0];

  const title = data.name || 'Juego Importado';
  const gameKey = title.toLowerCase().replace(/[^a-z0-9]/g, '');

  const controllerSupport = data.controller_support === 'full' || data.controller_support === 'partial';

  const screenshots: string[] = Array.isArray(data.screenshots)
    ? data.screenshots.map((s: any) => s.path_full || s.path_thumbnail).filter(Boolean)
    : [];

  const parseReqHtml = (htmlStr?: string) => {
    if (!htmlStr) return '';
    return htmlStr.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  };

  const pcReq = data.pc_requirements || {};
  const reqMin = parseReqHtml(pcReq.minimum) || 'OS: Windows 10 64-bit | CPU: Intel Core i3 | RAM: 8 GB';
  const reqRec = parseReqHtml(pcReq.recommended) || 'OS: Windows 11 64-bit | CPU: Intel Core i5 | RAM: 16 GB';

  return {
    title,
    developer,
    publisher,
    genre,
    description: cleanDesc,
    coverUrl,
    bannerUrl,
    iconUrl,
    releaseDate,
    gameKey,
    controllerSupport,
    requirements: { min: reqMin, rec: reqRec },
    screenshots
  };
}

export interface SteamSearchResult {
  appId: number;
  name: string;
  tinyImage: string;
}

export interface SteamVersionFetched {
  version_name: string;
  build_id?: string;
  release_date: string;
  changelog_title: string;
  changelog_body: string;
  is_available: boolean;
}

/**
 * Searches Steam store for games matching a text query.
 */
export async function searchSteamGames(query: string): Promise<SteamSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const targetUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanQuery)}&l=spanish&cc=ES`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

  let response: Response;
  try {
    response = await fetch(proxyUrl);
    if (!response.ok) response = await fetch(targetUrl);
  } catch {
    response = await fetch(targetUrl);
  }

  if (!response.ok) return [];

  try {
    const json = await response.json();
    if (!json || !Array.isArray(json.items)) return [];

    return json.items.map((item: any) => ({
      appId: item.id,
      name: item.name,
      tinyImage: item.tiny_image || `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/header.jpg`
    }));
  } catch {
    return [];
  }
}

/**
 * Fetches recent Steam Events/Updates directly from Steam Partner Events API,
 * extracting genuine versions, build_ids, and changelog notes.
 */
export async function fetchSteamEventsAndVersions(appId: string | number): Promise<SteamVersionFetched[]> {
  const cleanAppId = String(appId).trim();
  if (!cleanAppId || isNaN(Number(cleanAppId))) return [];

  const targetUrl = `https://store.steampowered.com/events/ajaxgetpartnereventspageable/?appid=${cleanAppId}&offset=0&count=50&l=english`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;

  let response: Response;
  try {
    response = await fetch(proxyUrl);
    if (!response.ok) response = await fetch(targetUrl);
  } catch {
    response = await fetch(targetUrl);
  }

  if (!response.ok) return [];

  try {
    const json = await response.json();
    if (!json || !Array.isArray(json.events)) return [];

    const versions: SteamVersionFetched[] = [];
    const addedVersionNames = new Set<string>();

    json.events.forEach((item: any) => {
      const title = (item.event_name || '').replace(/<[^>]*>?/gm, '').trim();
      const body = item.announcement_body?.body
        ? item.announcement_body.body.replace(/\[\/?(b|i|u|url|img)\]/gi, '').replace(/<[^>]*>?/gm, '').trim()
        : '';
      const postTime = item.rtime32_start_time ? new Date(item.rtime32_start_time * 1000).toISOString().split('T')[0] : '';

      // Extract build_id from jsondata or text
      let buildId: string | undefined = undefined;
      if (item.jsondata) {
        try {
          const js = typeof item.jsondata === 'string' ? JSON.parse(item.jsondata) : item.jsondata;
          if (js.build_id) buildId = String(js.build_id).trim();
          else if (js.buildid) buildId = String(js.buildid).trim();
          else if (js.published_build_id) buildId = String(js.published_build_id).trim();
        } catch { }
      }

      if (!buildId) {
        const buildMatch = `${title} ${body}`.match(/\b(?:Build|BuildId|Build-ID)\s*[:#\s]?\s*(\d{5,12})\b/i);
        if (buildMatch) buildId = buildMatch[1];
      }

      // Extract genuine version name
      let versionName: string | null = null;
      const semVer = `${title} ${body}`.match(/\bv?\.?\s*(\d+(\.\d+)+([a-z]|\-rc\d+|\-beta\d+|\-hotfix\d*|\.hotfix\d*)?)\b/i);
      if (semVer) {
        const num = semVer[1].replace(/^v\.?/i, '').trim();
        if (num && !/^\d{4}$/.test(num)) {
          versionName = `v${num}`;
        }
      } else {
        const patchMatch = `${title}`.match(/\b(Patch|Hotfix|Update|Build|Version|Ver)\s*#?\s*(\d+(\.\d+)*)\b/i);
        if (patchMatch) {
          versionName = `${patchMatch[1]} ${patchMatch[2]}`;
        } else if (buildId) {
          versionName = `Build ${buildId}`;
        }
      }

      if (versionName && !addedVersionNames.has(versionName.toLowerCase())) {
        addedVersionNames.add(versionName.toLowerCase());
        versions.push({
          version_name: versionName,
          build_id: buildId,
          release_date: postTime || new Date().toISOString().split('T')[0],
          changelog_title: title,
          changelog_body: body,
          is_available: false,
        });
      }
    });

    return versions;
  } catch {
    return [];
  }
}
