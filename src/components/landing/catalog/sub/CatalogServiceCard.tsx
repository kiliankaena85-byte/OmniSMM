'use client';

import React from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Flame,
  CheckCircle2,
} from 'lucide-react';
import { CatalogServiceItem } from '../catalog-data';

interface CatalogServiceCardProps {
  service: CatalogServiceItem;
  platformName: string;
  categoryTitle: string;
  onSelectService?: (service: CatalogServiceItem, platformName: string, categoryName: string) => void;
}

export function CatalogServiceCard({
  service,
  platformName,
  categoryTitle,
  onSelectService,
}: CatalogServiceCardProps) {
  return (
    <div
      className={`flex flex-col justify-between p-6 rounded-3xl bg-card border transition-all duration-200 relative group hover:shadow-lg ${
        service.isPopular ? 'border-primary/60 shadow-md shadow-primary/5' : 'border-border hover:border-primary/40'
      }`}
    >
      {service.badge && (
        <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
          <Flame className="w-3 h-3 shrink-0" />
          {service.badge}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-black text-foreground group-hover:text-primary transition-colors">
            {service.title}
          </h3>
        </div>

        {/* Characteristics Matrix */}
        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500 shrink-0" />
            <span>{service.speed}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{service.guarantee}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
            <span>{service.minMax}</span>
          </div>
        </div>
      </div>

      {/* Bottom Pricing & Action */}
      <div className="pt-5 mt-5 border-t border-border/80 flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            Розничная цена
          </span>
          <span className="text-base sm:text-lg font-mono font-black text-foreground tabular-nums">
            {service.pricePerUnit}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onSelectService?.(service, platformName, categoryTitle)}
          className="px-5 py-2.5 min-h-[44px] text-xs sm:text-sm font-bold bg-primary text-primary-foreground rounded-xl shadow-sm shadow-primary/20 hover:opacity-95 active:scale-98 transition-all flex items-center gap-2"
        >
          <span>Оформить</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
}
