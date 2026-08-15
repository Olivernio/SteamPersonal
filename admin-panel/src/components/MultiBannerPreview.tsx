import React, { useState, useEffect } from 'react';
import { Image as ImageIcon, Plus, Trash2, ChevronLeft, ChevronRight, Play, Pause, Layers } from 'lucide-react';

interface MultiBannerPreviewProps {
  bannerUrlsText: string;
  onChange: (newText: string) => void;
}

export const MultiBannerPreview: React.FC<MultiBannerPreviewProps> = ({
  bannerUrlsText,
  onChange,
}) => {
  const [newUrl, setNewUrl] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [bulkMode, setBulkMode] = useState(false);

  const banners = bannerUrlsText
    ? bannerUrlsText.split('\n').map((s) => s.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    if (currentIndex >= banners.length) {
      setCurrentIndex(Math.max(0, banners.length - 1));
    }
  }, [banners.length, currentIndex]);

  useEffect(() => {
    if (!autoRotate || banners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [autoRotate, banners.length]);

  const handleAddBanner = () => {
    if (!newUrl.trim()) return;
    const cleanUrl = newUrl.trim();
    if (!banners.includes(cleanUrl)) {
      const updated = [...banners, cleanUrl];
      onChange(updated.join('\n'));
      setCurrentIndex(updated.length - 1);
    }
    setNewUrl('');
  };

  const handleRemoveBanner = (indexToRemove: number) => {
    const updated = banners.filter((_, idx) => idx !== indexToRemove);
    onChange(updated.join('\n'));
    if (currentIndex >= updated.length) {
      setCurrentIndex(Math.max(0, updated.length - 1));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header & Stats */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ImageIcon size={16} style={{ color: '#818CF8' }} />
          <label style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 700 }}>
            Fondos Rotativos del Juego ({banners.length} {banners.length === 1 ? 'banner' : 'banners'})
          </label>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {banners.length > 1 && (
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              style={{
                padding: '5px 10px',
                borderRadius: '8px',
                backgroundColor: autoRotate ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                border: autoRotate ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.1)',
                color: autoRotate ? '#10B981' : 'rgba(255,255,255,0.6)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {autoRotate ? <Play size={12} fill="currentColor" /> : <Pause size={12} />}
              {autoRotate ? 'Auto-rotación ON' : 'Pausado'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setBulkMode(!bulkMode)}
            style={{
              padding: '5px 10px',
              borderRadius: '8px',
              backgroundColor: bulkMode ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: bulkMode ? '#A5B4FC' : 'rgba(255,255,255,0.7)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {bulkMode ? 'Vista Visual' : 'Edición Texto'}
          </button>
        </div>
      </div>

      {bulkMode ? (
        /* Textarea Bulk Mode */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
            Ingresa una URL de banner por línea (formato HD 16:9 recomendado):
          </p>
          <textarea
            value={bannerUrlsText}
            onChange={(e) => onChange(e.target.value)}
            rows={5}
            placeholder="https://cdn.akamai.steamstatic.com/steam/apps/.../library_hero.jpg&#10;https://.../wallpaper2.jpg"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '10px',
              backgroundColor: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#E2E8F0',
              fontSize: '12px',
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />
        </div>
      ) : (
        /* Visual Preview + Interactive Carousel */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Main 16:9 Banner Live Preview */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '180px',
              borderRadius: '14px',
              overflow: 'hidden',
              backgroundColor: '#07090E',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {banners.length > 0 && banners[currentIndex] ? (
              <>
                <img
                  src={banners[currentIndex]}
                  alt={`Banner ${currentIndex + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transition: 'opacity 0.3s ease',
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0.3';
                  }}
                />
                {/* Vignette Overlay */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(11,14,20,0.85) 0%, transparent 60%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Left/Right Controls if multiple */}
                {banners.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => (prev === 0 ? banners.length - 1 : prev - 1))}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#FFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentIndex((prev) => (prev + 1) % banners.length)}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.65)',
                        border: '1px solid rgba(255,255,255,0.2)',
                        color: '#FFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        backdropFilter: 'blur(4px)',
                      }}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}

                {/* Bottom indicators */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '14px',
                    right: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {banners.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        style={{
                          width: currentIndex === idx ? '20px' : '6px',
                          height: '6px',
                          borderRadius: '4px',
                          backgroundColor: currentIndex === idx ? '#6366F1' : 'rgba(255,255,255,0.4)',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>

                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      backdropFilter: 'blur(6px)',
                      color: '#A5B4FC',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    Fondo {currentIndex + 1} de {banners.length}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.3)' }}>
                <Layers size={32} />
                <span style={{ fontSize: '12px' }}>Sin fondos configurados. Agrega uno o más abajo.</span>
              </div>
            )}
          </div>

          {/* Quick Add URL Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddBanner();
                }
              }}
              placeholder="Pegar URL de nuevo fondo / banner HD (ej: https://.../hero.jpg)..."
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: '10px',
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: '#E2E8F0',
                fontSize: '12px',
              }}
            />
            <button
              type="button"
              onClick={handleAddBanner}
              disabled={!newUrl.trim()}
              style={{
                padding: '9px 16px',
                borderRadius: '10px',
                backgroundColor: newUrl.trim() ? '#6366F1' : 'rgba(99,102,241,0.2)',
                border: 'none',
                color: '#FFF',
                fontWeight: 700,
                fontSize: '12px',
                cursor: newUrl.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={14} /> Añadir Fondo
            </button>
          </div>

          {/* Thumbnails Row */}
          {banners.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
              {banners.map((url, idx) => (
                <div
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  style={{
                    position: 'relative',
                    height: '65px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    border: currentIndex === idx ? '2px solid #6366F1' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                    boxShadow: currentIndex === idx ? '0 0 12px rgba(99,102,241,0.4)' : 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <img
                    src={url}
                    alt={`Thumb ${idx + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3'; }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '3px',
                      left: '3px',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      color: '#FFF',
                      fontSize: '9px',
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: '4px',
                    }}
                  >
                    #{idx + 1}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveBanner(idx);
                    }}
                    title="Eliminar este fondo"
                    style={{
                      position: 'absolute',
                      top: '3px',
                      right: '3px',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(239,68,68,0.85)',
                      border: 'none',
                      color: '#FFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
