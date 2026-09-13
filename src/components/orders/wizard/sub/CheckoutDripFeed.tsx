'use client';
import React from 'react';
import { Sparkles } from 'lucide-react';
import { PublicService } from '@/actions/order/catalog';

interface CheckoutDripFeedProps {
  selectedService: PublicService;
  isDripFeedEnabled: boolean;
  setIsDripFeedEnabled: (v: boolean) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  dripRuns: number;
  setDripRuns: (r: number) => void;
  dripInterval: number;
  setDripInterval: (i: number) => void;
  totalQuantity: number;
}

export function CheckoutDripFeed({
  selectedService, isDripFeedEnabled, setIsDripFeedEnabled, quantity, setQuantity,
  dripRuns, setDripRuns, dripInterval, setDripInterval, totalQuantity,
}: CheckoutDripFeedProps) {
  if (!selectedService.isDripFeedEnabled) return null;
  return (
    <div className="p-4 bg-muted/40 rounded-2xl border border-border/50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary shrink-0" /> Запускать частями (Drip-Feed)
        </span>
        <label className="relative inline-flex items-center cursor-pointer min-w-[44px] min-h-[44px] justify-center">
          <input
            type="checkbox"
            checked={isDripFeedEnabled}
            onChange={(e) => {
              const enabled = e.target.checked;
              setIsDripFeedEnabled(enabled);
              if (enabled && (!quantity || quantity < selectedService.minQty)) {
                setQuantity(selectedService.minQty);
              }
            }}
            className="sr-only peer"
          />
          <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[14px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
        </label>
      </div>
      {isDripFeedEnabled && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/30">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Количество запусков</label>
            <input type="number" min={2} max={100} value={dripRuns} onChange={(e) => setDripRuns(Math.max(2, parseInt(e.target.value) || 2))} className="w-full px-3 py-2.5 bg-background border border-border/60 rounded-xl text-base sm:text-sm font-bold text-foreground min-h-[44px]" />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Интервал (мин)</label>
            <input type="number" min={5} max={1440} value={dripInterval} onChange={(e) => setDripInterval(Math.max(1, parseInt(e.target.value) || 5))} className="w-full px-3 py-2.5 bg-background border border-border/60 rounded-xl text-base sm:text-sm font-bold text-foreground min-h-[44px]" />
          </div>
          <p className="col-span-2 text-xs text-muted-foreground font-medium">
            Заказ выполнится за {dripRuns} запусков по {quantity} шт. Всего: <strong className="text-foreground">{totalQuantity} шт.</strong>
          </p>
        </div>
      )}
    </div>
  );
}
