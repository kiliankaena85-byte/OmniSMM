'use client';

import React from 'react';
import type { FluxNetwork, FluxCategory, FluxService } from '@/types/flux';
import { formatEtaSpeedBadge } from '@/utils/format-eta';
import { formatPricePerUnit } from '@/utils/format-price';

interface FluxCheckoutServiceHeaderProps {
  selectedService: FluxService;
  activeNetwork: FluxNetwork | null;
  activeCategory: FluxCategory | null;
}

export function FluxCheckoutServiceHeader({
  selectedService,
  activeNetwork,
  activeCategory,
}: FluxCheckoutServiceHeaderProps) {
  return (
    <>
      <div className="flex justify-between items-start gap-4 pb-4 border-b border-border/40">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/10 px-2.5 py-0.5 rounded-full">
            {activeNetwork?.name} • {activeCategory?.name}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight tracking-tight mt-1">
            {selectedService.name}
          </h2>
        </div>
        <div className="text-right shrink-0">
          <span className="text-primary font-black text-xl tabular-nums font-mono">
            {formatPricePerUnit(selectedService.pricePerUnitRub)} ₽
          </span>
          <span className="text-muted-foreground font-medium text-xs block">за 1 шт.</span>
        </div>
      </div>

      {/* Service Specs Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-2xl bg-background/90 border border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Мин. заказ</p>
          <p className="font-bold text-sm sm:text-base tabular-nums font-mono">{selectedService.minQty} шт</p>
        </div>
        <div className="p-3 rounded-2xl bg-background/90 border border-border/40">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Макс. заказ</p>
          <p className="font-bold text-sm sm:text-base tabular-nums font-mono">{selectedService.maxQty} шт</p>
        </div>
        <div className="p-3 rounded-2xl bg-background/90 border border-border/40 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Скорость / ETA</p>
          <p className="font-bold text-primary text-xs sm:text-sm">{formatEtaSpeedBadge(selectedService)}</p>
        </div>
      </div>
    </>
  );
}
