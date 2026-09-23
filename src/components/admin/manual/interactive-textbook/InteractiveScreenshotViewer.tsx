'use client';

import React, { useState } from 'react';
import { Maximize2, X, ZoomIn, ZoomOut, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { TextbookScreenshot } from './types';

interface InteractiveScreenshotViewerProps {
  screenshot: TextbookScreenshot;
}

export function InteractiveScreenshotViewer({ screenshot }: InteractiveScreenshotViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.75));
  const handleReset = () => setZoom(1);

  return (
    <figure className="my-4 rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs">
      <div className="relative group bg-muted/20 flex items-center justify-center min-h-[180px] p-2 overflow-hidden">
        {imgError ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
            <ImageIcon className="w-8 h-8 opacity-40" />
            <span className="text-xs font-semibold">{screenshot.altText}</span>
            <span className="text-[10px] opacity-75">(Скриншот сгенерирован на этапе стейджа)</span>
          </div>
        ) : (
          <div className="relative inline-block max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshot.src}
              alt={screenshot.altText}
              onError={() => setImgError(true)}
              className="w-full object-contain max-h-[400px] rounded-xl transition-transform duration-300 group-hover:scale-[1.005]"
              loading="lazy"
            />

            {/* Hotspots Overlay */}
            {screenshot.hotspots?.map((hs) => (
              <button
                key={hs.badgeNumber}
                type="button"
                onClick={() => setActiveHotspot(activeHotspot === hs.badgeNumber ? null : hs.badgeNumber)}
                style={{ left: `${hs.xPercent}%`, top: `${hs.yPercent}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full font-black text-xs flex items-center justify-center shadow-lg ring-2 ring-background hover:scale-125 transition-all cursor-pointer z-10 ${
                  activeHotspot === hs.badgeNumber
                    ? 'bg-amber-500 text-amber-950 scale-125 ring-amber-300 animate-pulse'
                    : 'bg-primary text-primary-foreground'
                }`}
                title={hs.title}
                aria-label={`Подсказка #${hs.badgeNumber}: ${hs.title}`}
              >
                {hs.badgeNumber}
              </button>
            ))}

            {/* Quick Enlarge Overlay Button */}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-xl bg-background/80 hover:bg-background text-foreground text-xs font-bold border border-border shadow-md backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Увеличить</span>
            </button>
          </div>
        )}
      </div>

      {/* Caption & Active Hotspot Info */}
      <figcaption className="p-3 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-foreground/90">{screenshot.caption}</span>
        {screenshot.hotspots && screenshot.hotspots.length > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md border border-border/50">
            Нажмите на маркеры #{screenshot.hotspots.map((h) => h.badgeNumber).join(', #')} для подсказок
          </span>
        )}
      </figcaption>

      {activeHotspot !== null && screenshot.hotspots && (
        <div className="p-3 bg-primary/5 border-t border-primary/20 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <span className="px-2 py-0.5 rounded-md bg-primary text-primary-foreground font-bold text-xs shrink-0 mt-0.5">
            #{activeHotspot}
          </span>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-foreground block">
              {screenshot.hotspots.find((h) => h.badgeNumber === activeHotspot)?.title}
            </span>
            <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
              {screenshot.hotspots.find((h) => h.badgeNumber === activeHotspot)?.description}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveHotspot(null)}
            className="text-muted-foreground hover:text-foreground text-xs font-bold px-1.5 py-0.5"
            aria-label="Закрыть подсказку"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal Fullscreen View */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={screenshot.caption}
        >
          <div className="w-full max-w-6xl flex items-center justify-between text-white pb-3 border-b border-white/20">
            <span className="text-xs font-bold truncate pr-4">{screenshot.caption}</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Увеличить"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Уменьшить"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Сброс масштаба"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setZoom(1);
                }}
                className="p-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white cursor-pointer ml-2 min-w-[36px] min-h-[36px] flex items-center justify-center"
                title="Закрыть"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center overflow-auto p-4">
            <div
              style={{ transform: `scale(${zoom})` }}
              className="relative inline-block transition-transform duration-150"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshot.src}
                alt={screenshot.altText}
                className="max-h-[85vh] max-w-full object-contain rounded-lg"
              />

              {/* Modal Hotspots */}
              {screenshot.hotspots?.map((hs) => (
                <button
                  key={hs.badgeNumber}
                  type="button"
                  onClick={() => setActiveHotspot(activeHotspot === hs.badgeNumber ? null : hs.badgeNumber)}
                  style={{ left: `${hs.xPercent}%`, top: `${hs.yPercent}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary text-primary-foreground font-black text-xs flex items-center justify-center shadow-lg ring-2 ring-background hover:scale-125 transition-all cursor-pointer z-20"
                  title={hs.title}
                >
                  {hs.badgeNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </figure>
  );
}
