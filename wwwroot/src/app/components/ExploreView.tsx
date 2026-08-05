import { useState } from 'react';
import { Search, TrendingUp, Star, Zap, Globe } from 'lucide-react';

const CATALOG = [
  { id: 101, title: 'Baldur\'s Gate IV', genre: 'RPG', rating: 9.8, cover: 'https://images.unsplash.com/photo-1698450998458-0bc1045788a1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', price: 'Gratis', hot: true },
  { id: 102, title: 'StarField 2', genre: 'Sci-Fi RPG', rating: 8.9, cover: 'https://images.unsplash.com/photo-1535391879778-3bae11d29a24?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', price: 'Gratis', hot: false },
  { id: 103, title: 'Doom: Eternal II', genre: 'FPS', rating: 9.5, cover: 'https://images.unsplash.com/photo-1774060526585-19be7b4af255?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', price: 'Gratis', hot: true },
  { id: 104, title: 'Horizon Zero IV', genre: 'Action RPG', rating: 9.1, cover: 'https://images.unsplash.com/photo-1640903581708-8d491706515b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', price: 'Gratis', hot: false },
  { id: 105, title: 'Hades III', genre: 'Roguelite', rating: 9.7, cover: 'https://images.unsplash.com/photo-1762008387452-25fe91ab3f90?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', price: 'Gratis', hot: true },
  { id: 106, title: 'Kingdom Come III', genre: 'RPG Medieval', rating: 8.7, cover: 'https://images.unsplash.com/photo-1775171440118-a3306020fe5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400', price: 'Gratis', hot: false },
];

const GENRES = ['Todos', 'RPG', 'FPS', 'Sci-Fi', 'Roguelite', 'Action', 'Strategy', 'Indie'];

export function ExploreView() {
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('Todos');
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const filtered = CATALOG.filter((g) => {
    const matchSearch = g.title.toLowerCase().includes(search.toLowerCase());
    const matchGenre = genre === 'Todos' || g.genre.toLowerCase().includes(genre.toLowerCase());
    return matchSearch && matchGenre;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="px-6 py-4 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 style={{ color: '#E2E8F0', fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em' }}>Explorar Catálogo</h1>
            <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>Descubre nuevos juegos disponibles para descargar</p>
          </div>
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', width: '220px' }}
          >
            <Search size={14} style={{ color: 'rgba(255,255,255,0.35)' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en catálogo..."
              className="bg-transparent border-none outline-none flex-1"
              style={{ color: '#E2E8F0', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Genre pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setGenre(g)}
              className="px-3 py-1.5 rounded-lg whitespace-nowrap transition-all duration-200 shrink-0"
              style={{
                backgroundColor: genre === g ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)',
                border: genre === g ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: genre === g ? '#A5B4FC' : 'rgba(255,255,255,0.45)',
                fontSize: '12px',
                fontWeight: genre === g ? 600 : 400,
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Featured banner */}
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ height: '180px', backgroundColor: '#151922' }}
        >
          <img
            src="https://images.unsplash.com/photo-1672872476232-da16b45c9001?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080"
            alt="featured"
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.45) saturate(1.3)' }}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(11,14,20,0.95) 0%, rgba(11,14,20,0.4) 60%, transparent 100%)' }}
          />
          <div className="absolute inset-0 flex items-center px-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="px-2 py-0.5 rounded-md flex items-center gap-1"
                  style={{ background: 'rgba(249,115,22,0.9)', color: '#fff', fontSize: '10px', fontWeight: 700 }}
                >
                  <Zap size={9} fill="currentColor" />
                  DESTACADO
                </span>
                <span style={{ background: 'rgba(99,102,241,0.7)', color: '#fff', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>
                  GRATIS
                </span>
              </div>
              <h2 style={{ color: '#fff', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em' }}>Chrome City: Origins</h2>
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', marginTop: '4px', marginBottom: '12px' }}>
                Precuela del universo Chrome Protocol · NeonForge Studios
              </p>
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
                  boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 700,
                }}
              >
                <Globe size={14} />
                Ver en catálogo
              </button>
            </div>
          </div>
        </div>

        {/* Trending */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} style={{ color: '#F59E0B' }} />
            <h3 style={{ color: '#E2E8F0', fontSize: '14px', fontWeight: 600 }}>Tendencias</h3>
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}
          >
            {filtered.map((game) => (
              <div
                key={game.id}
                className="relative rounded-xl overflow-hidden cursor-pointer transition-all duration-300"
                style={{
                  backgroundColor: '#151922',
                  border: hoveredId === game.id ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(255,255,255,0.07)',
                  transform: hoveredId === game.id ? 'translateY(-3px)' : 'none',
                  boxShadow: hoveredId === game.id ? '0 12px 32px rgba(0,0,0,0.5)' : 'none',
                }}
                onMouseEnter={() => setHoveredId(game.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="relative" style={{ aspectRatio: '2/3' }}>
                  <img
                    src={game.cover}
                    alt={game.title}
                    className="w-full h-full object-cover"
                    style={{ transform: hoveredId === game.id ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.4s' }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'linear-gradient(to top, rgba(10,14,20,0.9) 0%, transparent 60%)' }}
                  />
                  {game.hot && (
                    <div
                      className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md flex items-center gap-1"
                      style={{ background: 'rgba(249,115,22,0.9)', color: '#fff', fontSize: '9px', fontWeight: 700 }}
                    >
                      🔥 HOT
                    </div>
                  )}
                  <div
                    className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md flex items-center gap-1"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: '#F59E0B', fontSize: '10px', fontWeight: 700 }}
                  >
                    <Star size={8} fill="currentColor" />
                    {game.rating}
                  </div>
                  <div
                    className="absolute bottom-0 left-0 right-0 p-2 transition-all duration-300"
                    style={{ opacity: hoveredId === game.id ? 1 : 0 }}
                  >
                    <button
                      className="w-full py-1.5 rounded-lg"
                      style={{ background: 'rgba(99,102,241,0.85)', color: '#fff', fontSize: '11px', fontWeight: 700 }}
                    >
                      + Agregar
                    </button>
                  </div>
                </div>
                <div className="p-2.5">
                  <div style={{ color: '#E2E8F0', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>{game.title}</div>
                  <div className="flex items-center justify-between">
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>{game.genre}</span>
                    <span style={{ color: '#10B981', fontSize: '10px', fontWeight: 700 }}>{game.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.3); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
      `}</style>
    </div>
  );
}
