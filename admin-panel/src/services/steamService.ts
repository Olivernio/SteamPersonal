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

export interface SteamSearchResult {
  appId: number;
  name: string;
  tinyImage: string;
}

export interface SteamDbBuildItem {
  buildId: string;
  versionName: string;
  rawTitle: string;
  description: string;
  releaseDate: string;
  link: string;
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
 * Helper to fetch content with multi-tier proxy and fallback support.
 */
async function fetchWithFallback(urls: string[], options: RequestInit = {}): Promise<Response> {
  let lastError: any = null;
  for (const url of urls) {
    try {
      const resp = await fetch(url, options);
      if (resp.ok) return resp;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('No se pudo conectar con el servidor.');
}

/**
 * Fetches game metadata from the public Steam Store API.
 * Handles CORS via local proxy or public proxies and parses details in Spanish.
 */
export async function fetchSteamGameDetails(appId: string | number): Promise<SteamAppDetails> {
  const cleanAppId = String(appId).trim();
  if (!cleanAppId || isNaN(Number(cleanAppId))) {
    throw new Error('Steam AppID inválido. Debe ser un número (ej: 1091500)');
  }

  const directUrl = `https://store.steampowered.com/api/appdetails?appids=${cleanAppId}&l=spanish`;
  const localProxyUrl = `/api/steam-store/api/appdetails?appids=${cleanAppId}&l=spanish`;
  const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

  let response: Response;
  try {
    response = await fetchWithFallback([localProxyUrl, corsProxyUrl, directUrl]);
  } catch (err: any) {
    throw new Error(`Error de conexión con Steam: ${err.message}`);
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

/**
 * Searches Steam store for games matching a text query.
 */
export async function searchSteamGames(query: string): Promise<SteamSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const directUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(cleanQuery)}&l=spanish&cc=ES`;
  const localProxyUrl = `/api/steam-store/api/storesearch/?term=${encodeURIComponent(cleanQuery)}&l=spanish&cc=ES`;
  const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

  try {
    const response = await fetchWithFallback([localProxyUrl, corsProxyUrl, directUrl]);
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
 * Normalizes a version string for robust cross-referencing (e.g., 'v1.0.13' -> '1.0.13').
 */
export function normalizeVersionKey(v?: string | null): string {
  if (!v) return '';
  return v
    .toLowerCase()
    .replace(/^v(?:\.|\s*)/i, '')
    .replace(/^version\s*/i, '')
    .replace(/^patch\s*/i, '')
    .replace(/^hotfix\s*/i, '')
    .replace(/^update\s*/i, '')
    .trim();
}

/**
 * Extracts a clean SemVer or patch version name from text.
 */
export function extractVersionNameFromText(text: string, fallbackBuildId?: string): string {
  if (!text) return fallbackBuildId ? `Build ${fallbackBuildId}` : 'v1.0.0';

  // 1. SemVer pattern e.g. 1.0.13, v1.2.0-rc1, 0.9.4a
  const semVer = text.match(/\b(?:v|ver|version)?\.?\s*(\d+(?:\.\d+)+(?:[a-z]|-rc\d+|-beta\d+|\.hotfix\d*|-hotfix\d*)?)\b/i);
  if (semVer) {
    const num = semVer[1].replace(/^v\.?/i, '').trim();
    if (num && !/^\d{4}$/.test(num)) {
      return `v${num}`;
    }
  }

  // 2. Named patches (e.g. Patch 3, Hotfix 1.2, Update 5)
  const patchMatch = text.match(/\b(Patch|Hotfix|Update|Version|Ver)\s*#?\s*(\d+(?:\.\d+)*)\b/i);
  if (patchMatch) {
    return `${patchMatch[1]} ${patchMatch[2]}`;
  }

  // 3. Fallback to build ID
  if (fallbackBuildId) {
    return `Build ${fallbackBuildId}`;
  }

  return 'v1.0.0';
}

/**
 * Parses SteamDB RSS XML feed into structured build items.
 */
export function parseSteamDbRssXml(xmlText: string): SteamDbBuildItem[] {
  const items: SteamDbBuildItem[] = [];
  if (!xmlText) return items;

  // First try browser DOMParser if available
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'text/xml');
      const itemElements = doc.querySelectorAll('item');

      itemElements.forEach((el) => {
        const guid = el.querySelector('guid')?.textContent?.trim() || '';
        const title = el.querySelector('title')?.textContent?.trim() || '';
        const desc = el.querySelector('description')?.textContent?.trim() || '';
        const link = el.querySelector('link')?.textContent?.trim() || '';
        const pubDateRaw = el.querySelector('pubDate')?.textContent?.trim() || '';

        // Extract Build ID from guid (build#24263394), description or link
        const buildMatch = guid.match(/build#?(\d{5,12})/i) ||
          desc.match(/\b(?:Build|BuildId)\s*(\d{5,12})\b/i) ||
          link.match(/\/patchnotes\/(\d{5,12})/i);
        const buildId = buildMatch ? buildMatch[1] : '';

        // Extract Date in YYYY-MM-DD
        let releaseDate = new Date().toISOString().split('T')[0];
        if (pubDateRaw) {
          const parsed = new Date(pubDateRaw);
          if (!isNaN(parsed.getTime())) {
            releaseDate = parsed.toISOString().split('T')[0];
          }
        }

        const versionName = extractVersionNameFromText(`${desc} ${title}`, buildId);

        if (buildId) {
          items.push({
            buildId,
            versionName,
            rawTitle: title,
            description: desc,
            releaseDate,
            link,
          });
        }
      });

      if (items.length > 0) return items;
    } catch {
      // Fall through to regex parser below
    }
  }

  // Regex fallback parser
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemBlock = match[1];
    const guid = (itemBlock.match(/<guid[^>]*>(.*?)<\/guid>/i) || [])[1] || '';
    const title = (itemBlock.match(/<title[^>]*>(.*?)<\/title>/i) || [])[1] || '';
    const desc = (itemBlock.match(/<description[^>]*>(.*?)<\/description>/i) || [])[1] || '';
    const link = (itemBlock.match(/<link[^>]*>(.*?)<\/link>/i) || [])[1] || '';
    const pubDateRaw = (itemBlock.match(/<pubDate[^>]*>(.*?)<\/pubDate>/i) || [])[1] || '';

    const buildMatch = guid.match(/build#?(\d{5,12})/i) ||
      desc.match(/\b(?:Build|BuildId)\s*(\d{5,12})\b/i) ||
      link.match(/\/patchnotes\/(\d{5,12})/i);
    const buildId = buildMatch ? buildMatch[1] : '';

    let releaseDate = new Date().toISOString().split('T')[0];
    if (pubDateRaw) {
      const parsed = new Date(pubDateRaw);
      if (!isNaN(parsed.getTime())) {
        releaseDate = parsed.toISOString().split('T')[0];
      }
    }

    const versionName = extractVersionNameFromText(`${desc} ${title}`, buildId);

    if (buildId) {
      items.push({
        buildId,
        versionName,
        rawTitle: title,
        description: desc,
        releaseDate,
        link,
      });
    }
  }

  return items;
}

/**
 * Fetches builds directly from SteamDB Patchnotes RSS API.
 * https://steamdb.info/api/PatchnotesRSS/?appid={appid}
 */
export async function fetchSteamDbPatchnotes(appId: string | number): Promise<SteamDbBuildItem[]> {
  const cleanAppId = String(appId).trim();
  if (!cleanAppId || isNaN(Number(cleanAppId))) return [];

  const directUrl = `https://steamdb.info/api/PatchnotesRSS/?appid=${cleanAppId}`;
  const localProxyUrl = `/api/steamdb/PatchnotesRSS/?appid=${cleanAppId}`;
  const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

  try {
    const response = await fetchWithFallback([localProxyUrl, corsProxyUrl, directUrl]);
    const xmlText = await response.text();
    return parseSteamDbRssXml(xmlText);
  } catch (e) {
    console.warn(`[SteamDB RSS] No se pudo obtener el feed RSS para AppID ${cleanAppId}:`, e);
    return [];
  }
}

/**
 * Fetches raw partner events from Steam community events API.
 */
async function fetchSteamPartnerEvents(cleanAppId: string): Promise<any[]> {
  const directUrl = `https://store.steampowered.com/events/ajaxgetpartnereventspageable/?appid=${cleanAppId}&offset=0&count=50&l=english`;
  const localProxyUrl = `/api/steam-events/ajaxgetpartnereventspageable/?appid=${cleanAppId}&offset=0&count=50&l=english`;
  const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(directUrl)}`;

  try {
    const response = await fetchWithFallback([localProxyUrl, corsProxyUrl, directUrl]);
    const json = await response.json();
    if (json && Array.isArray(json.events)) {
      return json.events;
    }
  } catch (e) {
    console.warn(`[Steam Events] No se pudieron obtener eventos de Steam para AppID ${cleanAppId}:`, e);
  }
  return [];
}

/**
 * Enhanced Hybrid Synchronization:
 * Merges Steam Partner Events (rich changelogs/descriptions) with SteamDB RSS builds (accurate build_ids),
 * resolving genuine build_ids, versions and patch notes.
 */
export async function fetchSteamEventsAndVersions(appId: string | number): Promise<SteamVersionFetched[]> {
  const cleanAppId = String(appId).trim();
  if (!cleanAppId || isNaN(Number(cleanAppId))) return [];

  // Query both SteamDB RSS and Steam Community Events concurrently
  const [steamDbBuilds, steamEvents] = await Promise.all([
    fetchSteamDbPatchnotes(cleanAppId),
    fetchSteamPartnerEvents(cleanAppId)
  ]);

  const versions: SteamVersionFetched[] = [];
  const addedVersionKeys = new Set<string>();
  const usedSteamDbBuildIds = new Set<string>();

  // Process Steam Partner Events first
  steamEvents.forEach((item: any) => {
    const title = (item.event_name || '').replace(/<[^>]*>?/gm, '').trim();
    const body = item.announcement_body?.body
      ? item.announcement_body.body.replace(/\[\/?(b|i|u|url|img)\]/gi, '').replace(/<[^>]*>?/gm, '').trim()
      : '';
    const postTime = item.rtime32_start_time
      ? new Date(item.rtime32_start_time * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // 1. Try to extract build_id from jsondata or event text
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

    // 2. Extract version name
    const versionName = extractVersionNameFromText(`${title} ${body}`, buildId);
    const normKey = normalizeVersionKey(versionName);

    // 3. Cross-reference with SteamDB RSS builds to get exact build_id
    if (!buildId && steamDbBuilds.length > 0) {
      // a. Match by exact normalized version key
      const matchByVersion = steamDbBuilds.find((b) => normalizeVersionKey(b.versionName) === normKey);
      if (matchByVersion) {
        buildId = matchByVersion.buildId;
        usedSteamDbBuildIds.add(matchByVersion.buildId);
      } else {
        // b. Match by release date proximity (+/- 2 days)
        const eventTs = item.rtime32_start_time ? item.rtime32_start_time * 1000 : new Date(postTime).getTime();
        const matchByDate = steamDbBuilds.find((b) => {
          if (usedSteamDbBuildIds.has(b.buildId)) return false;
          const buildTs = new Date(b.releaseDate).getTime();
          return Math.abs(eventTs - buildTs) <= 2 * 24 * 60 * 60 * 1000;
        });
        if (matchByDate) {
          buildId = matchByDate.buildId;
          usedSteamDbBuildIds.add(matchByDate.buildId);
        }
      }
    } else if (buildId) {
      usedSteamDbBuildIds.add(buildId);
    }

    if (versionName && !addedVersionKeys.has(normKey)) {
      addedVersionKeys.add(normKey);
      versions.push({
        version_name: versionName,
        build_id: buildId,
        release_date: postTime,
        changelog_title: title,
        changelog_body: body,
        is_available: false,
      });
    }
  });

  // Include remaining SteamDB builds (silent updates or patches without separate community events)
  steamDbBuilds.forEach((build) => {
    const normKey = normalizeVersionKey(build.versionName);
    if (!usedSteamDbBuildIds.has(build.buildId) && !addedVersionKeys.has(normKey)) {
      addedVersionKeys.add(normKey);
      usedSteamDbBuildIds.add(build.buildId);
      versions.push({
        version_name: build.versionName,
        build_id: build.buildId,
        release_date: build.releaseDate,
        changelog_title: build.rawTitle,
        changelog_body: build.description,
        is_available: false,
      });
    } else if (usedSteamDbBuildIds.has(build.buildId)) {
      // If version exists in list but was missing build_id, assign it
      const existing = versions.find((v) => normalizeVersionKey(v.version_name) === normKey);
      if (existing && !existing.build_id) {
        existing.build_id = build.buildId;
      }
    }
  });

  return versions;
}

