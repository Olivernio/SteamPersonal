export type GameStatus = 'updated' | 'update_available' | 'outdated';

export interface SystemRequirements {
  min: string;
  rec: string;
}

export interface Game {
  id: number;
  uuid?: string;
  gameKey?: string;
  title: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  genre: string;
  description: string;
  cover: string;
  banner: string;
  screenshots: string[];
  status: GameStatus;
  currentVersion: string;
  latestVersion: string;
  hoursPlayed: number;
  requirements: SystemRequirements;
  changelog: { version: string; date: string; notes: string[] }[];
  requestCount: number;
  dlcs: string[];
  controllerSupport: boolean;
  size: string;
  downloadUrl?: string;
  executableRelativePath?: string;
  logoUrl?: string;
  developerLogoUrl?: string;
  publisherLogoUrl?: string;
  recipeSteps?: any[];
}

export const GAMES: Game[] = [
  {
    id: 100,
    title: 'Librarian: Tidy Up the Arcane Library!',
    developer: 'Arcane Studio',
    publisher: 'Arcane Publishing',
    releaseDate: '2024-08-01',
    genre: 'Puzzle / Adventure',
    description:
      'Organiza y ordena pergaminos místico-mágicos y tomos antiguos en la biblioteca arcana más peligrosa del reino.',
    cover:
      'https://images.unsplash.com/photo-1507842217343-583bb7270b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1507842217343-583bb7270b66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'update_available',
    currentVersion: 'v1.0',
    latestVersion: 'v1.1 (Portable)',
    hoursPlayed: 0,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel Core i3 | RAM: 4 GB | Storage: 500 MB',
      rec: 'OS: Windows 11 64-bit | CPU: Intel Core i5 | RAM: 8 GB | Storage: 1 GB SSD',
    },
    changelog: [
      {
        version: 'v1.1',
        date: '2024-08-05',
        notes: ['Versión Portable lista para descarga directa de Google Drive.'],
      },
    ],
    requestCount: 0,
    dlcs: [],
    controllerSupport: true,
    size: '350 MB',
    downloadUrl: 'https://drive.google.com/file/d/1iK4zCpfqz-E8bsrCWo8knvHYZhzZRjX0/view?usp=drive_link',
  },
  {
    id: 1,
    title: 'Elden Nexus',
    developer: 'FromSoft Digital',
    publisher: 'Bandai Interactive',
    releaseDate: '2024-03-15',
    genre: 'Action RPG',
    description:
      'An epic dark fantasy action RPG set in a shattered world of ancient gods and ruthless warriors. Explore vast landscapes and face unimaginable horrors in your quest for the Nexus.',
    cover:
      'https://images.unsplash.com/photo-1640903581708-8d491706515b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHx2aWRlbyUyMGdhbWUlMjBkYXJrJTIwZmFudGFzeSUyMGFjdGlvbnxlbnwxfHx8fDE3ODU3OTMyODJ8MA&ixlib=rb-4.1.0&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1640903581708-8d491706515b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwyfHx2aWRlbyUyMGdhbWUlMjBkYXJrJTIwZmFudGFzeSUyMGFjdGlvbnxlbnwxfHx8fDE3ODU3OTMyODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1774060526589-ef13301f6e17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1698450998458-0bc1045788a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'updated',
    currentVersion: 'v2.12',
    latestVersion: 'v2.12',
    hoursPlayed: 147.3,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-8600K | RAM: 12 GB | GPU: GTX 1070 8GB | Storage: 60 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Intel i7-12700K | RAM: 16 GB | GPU: RTX 3080 10GB | Storage: 60 GB SSD',
    },
    changelog: [
      {
        version: 'v2.12',
        date: '2024-07-10',
        notes: [
          'Fixed boss collision bugs in Nexus Core',
          'Improved performance in open-world zones',
          'New armor set: Void Paladin',
          'Balancing adjustments for PvP mode',
        ],
      },
      {
        version: 'v2.11',
        date: '2024-05-22',
        notes: ['DLC: Shadow Realm expansion', 'Fixed multiplayer desync issues'],
      },
    ],
    requestCount: 0,
    dlcs: ['Shadow Realm', 'Colosseum Pack', 'Nightfall Armor'],
    controllerSupport: true,
    size: '62.4 GB',
  },
  {
    id: 2,
    title: 'Chrome Protocol',
    developer: 'NeonForge Studios',
    publisher: 'Cyber Collective',
    releaseDate: '2023-11-20',
    genre: 'Cyberpunk RPG',
    description:
      'Dive into a neon-soaked dystopian megacity where chrome and flesh collide. Hack, fight, and infiltrate your way through a corporate conspiracy that stretches across the city.',
    cover:
      'https://images.unsplash.com/photo-1762008387452-25fe91ab3f90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw3fHx2aWRlbyUyMGdhbWUlMjBkYXJrJTIwZmFudGFzeSUyMGFjdGlvbnxlbnwxfHx8fDE3ODU3OTMyODJ8MA&ixlib=rb-4.1.0&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1642345843526-6279c8880a49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'update_available',
    currentVersion: 'v2.12',
    latestVersion: 'v2.13',
    hoursPlayed: 89.1,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-10600 | RAM: 12 GB | GPU: GTX 1060 6GB | Storage: 70 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Ryzen 7 5800X | RAM: 16 GB | GPU: RTX 3070 8GB | Storage: 70 GB SSD',
    },
    changelog: [
      {
        version: 'v2.13',
        date: '2024-07-28',
        notes: [
          'New district: Neon Harbor',
          'Added 3 new weapon mods (Plasma Cutter, EMP Grenade, Arc Blade)',
          'Overhauled hacking minigame UI',
          'Performance optimizations for RTX 40 series GPUs',
          'Fixed memory leaks in open-world streaming',
        ],
      },
      {
        version: 'v2.12',
        date: '2024-06-05',
        notes: ['Fixed crash on mission "Ghost Signal"', 'Improved NPC pathfinding'],
      },
    ],
    requestCount: 0,
    dlcs: ['Neon Harbor', 'Chrome Arms Pack'],
    controllerSupport: true,
    size: '74.2 GB',
    downloadUrl: 'https://drive.google.com/file/d/1BziDPAqWT5N5jV-5A2nB3d2Z5g7_wKk3/view',
  },
  {
    id: 3,
    title: 'Phantom Edge',
    developer: 'Stealth Works',
    publisher: 'Shadow Games Inc.',
    releaseDate: '2024-01-08',
    genre: 'Stealth / Action',
    description:
      'A master assassin hunts through shadow-drenched cities, using cunning, gadgets, and a blade forged from darkness to eliminate high-value targets and unravel a global conspiracy.',
    cover:
      'https://images.unsplash.com/photo-1774060526589-ef13301f6e17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHx2aWRlbyUyMGdhbWUlMjBkYXJrJTIwZmFudGFzeSUyMGFjdGlvbnxlbnwxfHx8fDE3ODU3OTMyODJ8MA&ixlib=rb-4.1.0&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1774060526589-ef13301f6e17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1762008387452-25fe91ab3f90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1640903581708-8d491706515b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'outdated',
    currentVersion: 'v2.12',
    latestVersion: 'v2.13',
    hoursPlayed: 34.7,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-9600K | RAM: 8 GB | GPU: GTX 1060 6GB | Storage: 45 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Intel i7-11700K | RAM: 16 GB | GPU: RTX 3060 Ti 8GB | Storage: 45 GB SSD',
    },
    changelog: [
      {
        version: 'v2.13',
        date: '2024-07-15',
        notes: [
          'New mission: "The Glass Throne"',
          'Added Photo Mode',
          'Fixed stealth detection AI bugs',
          'New gadget: Sonic Disruptor',
        ],
      },
      {
        version: 'v2.12',
        date: '2024-04-30',
        notes: ['Improved enemy AI reactions', 'Fixed save corruption bug'],
      },
    ],
    requestCount: 14,
    dlcs: ['The Final Contract', 'Weapon Skin Pack'],
    controllerSupport: true,
    size: '48.6 GB',
  },
  {
    id: 4,
    title: 'Iron Legacy',
    developer: 'Arcane Pixel',
    publisher: 'Heritage Interactive',
    releaseDate: '2023-08-12',
    genre: 'Strategy RPG',
    description:
      'Command vast armies, forge alliances, and conquer a continent in this sprawling strategy RPG. Every decision shapes the fate of civilizations across generations.',
    cover:
      'https://images.unsplash.com/photo-1775171440118-a3306020fe5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw4fHx2aWRlbyUyMGdhbWUlMjBkYXJrJTIwZmFudGFzeSUyMGFjdGlvbnxlbnwxfHx8fDE3ODU3OTMyODJ8MA&ixlib=rb-4.1.0&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1775171440118-a3306020fe5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1774836967692-11fb50666964?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1775171440118-a3306020fe5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'updated',
    currentVersion: 'v1.8',
    latestVersion: 'v1.8',
    hoursPlayed: 312.5,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-8400 | RAM: 8 GB | GPU: GTX 970 4GB | Storage: 30 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Ryzen 5 5600X | RAM: 16 GB | GPU: RTX 3060 8GB | Storage: 30 GB SSD',
    },
    changelog: [
      {
        version: 'v1.8',
        date: '2024-06-18',
        notes: [
          'New faction: The Iron Brotherhood',
          'Diplomacy system overhaul',
          'Fixed province map rendering issues',
          'Improved multiplayer stability',
        ],
      },
    ],
    requestCount: 0,
    dlcs: ['Conquest of the North', 'Dynasty Pack', 'Siege Warfare'],
    controllerSupport: false,
    size: '28.3 GB',
  },
  {
    id: 5,
    title: 'Void Hunters',
    developer: 'Quantum Arc Games',
    publisher: 'Nebula Interactive',
    releaseDate: '2024-02-28',
    genre: 'Sci-Fi Shooter',
    description:
      'Elite interstellar hunters track monstrous alien life forms across the galaxy. Solo or co-op, build your loadout and take on increasingly deadly extraterrestrial prey.',
    cover:
      'https://images.unsplash.com/photo-1774060526585-19be7b4af255?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw0fHx2aWRlbyUyMGdhbWUlMjBkYXJrJTIwZmFudGFzeSUyMGFjdGlvbnxlbnwxfHx8fDE3ODU3OTMyODJ8MA&ixlib=rb-4.1.0&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1535391879778-3bae11d29a24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1535391879778-3bae11d29a24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1600748338443-f7ea1054ed6b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'update_available',
    currentVersion: 'v1.4',
    latestVersion: 'v1.5',
    hoursPlayed: 56.8,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-10400 | RAM: 12 GB | GPU: GTX 1070 8GB | Storage: 55 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Ryzen 7 5700X | RAM: 16 GB | GPU: RTX 3070 Ti 8GB | Storage: 55 GB SSD',
    },
    changelog: [
      {
        version: 'v1.5',
        date: '2024-07-20',
        notes: [
          'New alien world: Zephyr Prime',
          '3 new weapon types added',
          'Multiplayer lobby improvements',
          'Fixed client-side prediction errors',
        ],
      },
      {
        version: 'v1.4',
        date: '2024-05-10',
        notes: ['Crossplay support added', 'Balance pass on heavy armor builds'],
      },
    ],
    requestCount: 0,
    dlcs: ['Alien Apex Pack', 'Neon Armor Skin'],
    controllerSupport: true,
    size: '58.1 GB',
  },
  {
    id: 6,
    title: 'Midnight Protocol',
    developer: 'Persona Labs',
    publisher: 'Atlus Digital',
    releaseDate: '2023-09-05',
    genre: 'JRPG / Tactical',
    description:
      'A stylish tactical RPG about a group of rebels fighting a corrupt system from the shadows. Fuse personas, stage heists, and change hearts in this vibrant supernatural adventure.',
    cover:
      'https://images.unsplash.com/photo-1780811775368-efbc581b3bcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHw2fHx2aWRlbyUyMGdhbWUlMjBkYXJrJTIwZmFudGFzeSUyMGFjdGlvbnxlbnwxfHx8fDE3ODU3OTMyODJ8MA&ixlib=rb-4.1.0&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1780811775368-efbc581b3bcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1642345843526-6279c8880a49?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1600748338443-f7ea1054ed6b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'updated',
    currentVersion: 'v3.0',
    latestVersion: 'v3.0',
    hoursPlayed: 228.9,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-8400 | RAM: 8 GB | GPU: GTX 1060 6GB | Storage: 40 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Intel i7-10700K | RAM: 16 GB | GPU: RTX 3060 8GB | Storage: 40 GB SSD',
    },
    changelog: [
      {
        version: 'v3.0',
        date: '2024-07-01',
        notes: [
          'Royal Edition upgrade: New semester added',
          'New confidant: The Phantom',
          'Full NG+ content unlocked',
          'Performance improvements across all platforms',
        ],
      },
    ],
    requestCount: 0,
    dlcs: ['Royal Edition DLC', 'Costume Pack Vol. 4', 'BGM Special Selection'],
    controllerSupport: true,
    size: '42.7 GB',
  },
  {
    id: 7,
    title: 'Nexus Rising',
    developer: 'Horizon Labs',
    publisher: 'Eclipse Games',
    releaseDate: '2024-04-19',
    genre: 'Open World Action',
    description:
      'A post-apocalyptic open world where factions clash over a mysterious energy source called the Nexus. Build settlements, forge alliances, and reshape a broken world.',
    cover:
      'https://images.unsplash.com/photo-1774060526589-ef13301f6e17?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1698450998458-0bc1045788a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1698450998458-0bc1045788a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1774836967692-11fb50666964?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'outdated',
    currentVersion: 'v1.1',
    latestVersion: 'v1.2',
    hoursPlayed: 14.2,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-10600K | RAM: 16 GB | GPU: RTX 2070 8GB | Storage: 80 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Ryzen 9 5900X | RAM: 32 GB | GPU: RTX 3080 Ti 12GB | Storage: 80 GB NVMe',
    },
    changelog: [
      {
        version: 'v1.2',
        date: '2024-07-25',
        notes: [
          'New region: The Shattered Flats',
          'Vehicle combat system added',
          'Fixed critical save bug',
          'Improved draw distance',
        ],
      },
      {
        version: 'v1.1',
        date: '2024-05-28',
        notes: ['Launch patch: stability fixes', 'Optimized memory usage'],
      },
    ],
    requestCount: 7,
    dlcs: ['Frontier Pack'],
    controllerSupport: true,
    size: '84.9 GB',
  },
  {
    id: 8,
    title: 'Vanguard Protocol',
    developer: 'Striker Digital',
    publisher: 'Combat Studios',
    releaseDate: '2023-12-01',
    genre: 'Tactical FPS',
    description:
      'A realistic tactical FPS where precision, communication, and map knowledge are your greatest weapons. Compete in ranked matches or complete story-driven special operations.',
    cover:
      'https://images.unsplash.com/photo-1774836967692-11fb50666964?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
    banner:
      'https://images.unsplash.com/photo-1774836967692-11fb50666964?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    screenshots: [
      'https://images.unsplash.com/photo-1775171440118-a3306020fe5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
      'https://images.unsplash.com/photo-1780811775368-efbc581b3bcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600',
    ],
    status: 'update_available',
    currentVersion: 'v4.2',
    latestVersion: 'v4.3',
    hoursPlayed: 423.1,
    requirements: {
      min: 'OS: Windows 10 64-bit | CPU: Intel i5-8600K | RAM: 8 GB | GPU: GTX 1060 6GB | Storage: 35 GB',
      rec: 'OS: Windows 11 64-bit | CPU: Intel i7-12700K | RAM: 16 GB | GPU: RTX 3070 8GB | Storage: 35 GB SSD',
    },
    changelog: [
      {
        version: 'v4.3',
        date: '2024-07-30',
        notes: [
          'New map: Glacier Station',
          'Ranked Season 8 begins',
          'Weapon recoil adjustments',
          'Anti-cheat system v2.1 deployed',
          'Fixed hitbox inconsistencies on 3 agents',
        ],
      },
      {
        version: 'v4.2',
        date: '2024-06-12',
        notes: ['Agent rework: Phantom ability tuning', 'UI improvements for inventory'],
      },
    ],
    requestCount: 0,
    dlcs: ['Tactical Operator Pack', 'Legacy Weapon Bundle'],
    controllerSupport: false,
    size: '36.8 GB',
  },
];

export const ACTIVE_DOWNLOAD = {
  gameId: 2,
  gameTitle: 'Chrome Protocol',
  gameCover:
    'https://images.unsplash.com/photo-1762008387452-25fe91ab3f90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=200',
  version: 'v2.13',
  totalSize: '74.2 GB',
  downloadedSize: '42.1 GB',
  totalBytes: 74.2,
  downloadedBytes: 42.1,
  speed: '45.2 MB/s',
  eta: '3 mins',
  steps: ['Descargando parte 2/4', 'Descomprimiendo .rar', 'Montando ISO', 'Aplicando Medicina', 'Limpiando Temporales'],
  currentStep: 0,
};
