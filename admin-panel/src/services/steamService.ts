export interface SteamAppDetails {
  title: string;
  developer: string;
  publisher: string;
  genre: string;
  description: string;
  coverUrl: string;
  bannerUrl: string;
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
    releaseDate,
    gameKey,
    controllerSupport,
    requirements: { min: reqMin, rec: reqRec },
    screenshots
  };
}
