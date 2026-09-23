'use client';

import React from 'react';
import { SparklesIcon } from 'lucide-react';
import type { FluxService } from '@/types/flux';

interface FluxCheckoutDripFeedProps {
  selectedService: FluxService;
  isDripFeedEnabled: boolean;
  setIsDripFeedEnabled: (enabled: boolean) => void;
  dripRuns: number;
  setDripRuns: (runs: number) => void;
  dripInterval: number;
  setDripInterval: (interval: number) => void;
  qtyNum: number;
  setQuantity: (qty: number | string) => void;
}

export function FluxCheckoutDripFeed({
  selectedService,
  isDripFeedEnabled,
  setIsDripFeedEnabled,
  dripRuns,
  setDripRuns,
  dripInterval,
  setDripInterval,
  qtyNum,
  setQuantity,
}: FluxCheckoutDripFeedProps) {
  if (!selectedService.isDripFeedEnabled) return null;

  return (
    <div className="p-4 bg-muted/40 rounded-2xl border border-border/40 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
          <SparklesIcon className="w-4 h-4 text-primary shrink-0" />
          Запускать частями (Drip-Feed)
        </span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isDripFeedEnabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              setIsDripFeedEnabled(enabled);
              if (enabled && qtyNum < selectedService.minQty) {
                setQuantity(selectedService.minQty);
              }
            }}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>

      {isDripFeedEnabled && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Запусков
            </label>
            <input
              type="number"
              min={2}
              max={100}
              value={dripRuns}
              onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value) || 2))}
              className="w-full h-10 px-3 bg-background border border-border/60 rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Интервал (мин)
            </label>
            <input
              type="number"
              min={5}
              max={1440}
              value={dripInterval}
              onChange={(e) => setDripInterval(Math.max(1, parseInt(e.target.value) || 5))}
              className="w-full h-10 px-3 bg-background border border-border/60 rounded-xl text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground font-medium">
            Заказ выполнится за {dripRuns} запусков по {dripRuns > 0 ? Math.floor(qtyNum / dripRuns) : 0} шт. Всего:{' '}
            <strong className="text-foreground">{qtyNum} шт.</strong>
          </p>
        </div>
      )}
    </div>
  );
}
