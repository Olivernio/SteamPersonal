import React, { useState, useEffect } from 'react';

interface DynamicBackgroundProps {
  images: string[];
  enabled: boolean;
  intervalMs?: number;
  fadeMs?: number;
  altText: string;
}

export const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ 
  images, 
  enabled, 
  intervalMs = 10000, 
  fadeMs = 5000, 
  altText 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);

  // Filter out empty/invalid image strings just in case
  const validImages = images.filter(img => img && typeof img === 'string' && img.trim() !== '');

  useEffect(() => {
    if (!enabled || validImages.length <= 1) {
      setCurrentIndex(0);
      setPrevIndex(null);
      return;
    }

    let isMounted = true;

    const intervalId = setInterval(() => {
      if (!isMounted) return;
      
      setCurrentIndex((prev) => {
        setPrevIndex(prev);
        return (prev + 1) % validImages.length;
      });

      // Clear prevIndex after the fade out transition completes
      setTimeout(() => {
        if (isMounted) setPrevIndex(null);
      }, fadeMs);
      
    }, intervalMs); // Use the custom interval

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [enabled, validImages.length, intervalMs, fadeMs]);

  if (validImages.length === 0) {
    return <div className="w-full h-full bg-gray-900" />;
  }

  return (
    <>
      <style>
        {`
          @keyframes kenBurns {
            0% { transform: scale(1.02) translate(0, 0); }
            100% { transform: scale(1.10) translate(-1%, -1%); }
          }
          .ken-burns-active {
            /* 12s is just a baseline for slow movement, we can keep it hardcoded or make it intervalMs * 1.5 */
            animation: kenBurns ${Math.max(12, intervalMs / 1000 * 1.5)}s ease-out forwards;
          }
        `}
      </style>
      <div className="absolute inset-0 bg-black">
        {validImages.map((img, index) => {
          const isActive = index === currentIndex;
          const isPrev = index === prevIndex;
          
          if (!isActive && !isPrev && !(validImages.length === 1)) {
            return null; // Optimizamos el DOM renderizando solo la actual y la que está desvaneciéndose
          }

          let zIndex = 0;
          let opacityStyle = 0;
          let transitionStyle = '';

          if (isPrev) {
            // La imagen anterior se queda arriba y se desvanece
            zIndex = 10;
            opacityStyle = 0;
            transitionStyle = `opacity ${fadeMs}ms ease-in-out`;
          } else if (isActive) {
            // La nueva imagen se pone abajo y aparece de golpe
            zIndex = 1;
            opacityStyle = 1;
            transitionStyle = 'none';
          }

          return (
            <img
              key={`${img}-${index}`}
              src={img}
              alt={altText}
              className={`absolute inset-0 w-full h-full object-cover ${
                (enabled && (isActive || isPrev)) ? 'ken-burns-active' : ''
              }`}
              style={{
                filter: 'brightness(0.85) saturate(1.15)',
                zIndex,
                opacity: opacityStyle,
                transition: transitionStyle,
                pointerEvents: 'none',
                animationPlayState: (!enabled || validImages.length <= 1) ? 'paused' : 'running'
              }}
            />
          );
        })}
      </div>
    </>
  );
};
