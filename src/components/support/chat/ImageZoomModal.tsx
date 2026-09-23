import { useState } from 'react';

export const ImageZoomModal = ({ url, onClose }: { url: string; onClose: () => void }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isZoomed) return;
    const { left, top, width, height } = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setPosition({ x, y });
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-foreground/95 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-7xl max-h-[90vh] flex items-center justify-center overflow-hidden rounded-xl"
        onClick={(e) => {
          e.stopPropagation();
          setIsZoomed(!isZoomed);
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setIsZoomed(false)}
        style={{ cursor: isZoomed ? 'zoom-out' : 'zoom-in' }}
      >
        <img
          src={`/api/media/${encodeURIComponent(url)}`}
          alt="zoomed"
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={
            isZoomed
              ? { transform: 'scale(2.5)', transformOrigin: `${position.x}% ${position.y}%` }
              : { transform: 'scale(1)', transformOrigin: 'center center' }
          }
        />
      </div>
      <button
        className="absolute top-6 right-6 text-primary-foreground/50 text-4xl p-4 hover:text-primary-foreground transition-colors"
        aria-label="Закрыть"
      >
        ✕
      </button>
      {!isZoomed && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 px-4 py-2 bg-foreground/50 text-primary-foreground/80 rounded-full text-sm font-medium backdrop-blur-md">
          Кликните для увеличения
        </div>
      )}
    </div>
  );
};
