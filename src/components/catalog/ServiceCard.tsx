'use client';

import React from 'react';
import { sanitizeServiceDescription } from '@/lib/sanitize';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Zap } from 'lucide-react';

export interface ServiceCardData {
  id: string;
  name: string;
  description?: string | null;
  price?: number;
  pricePerUnitRub?: number;
  minQty?: number;
  maxQty?: number;
  badge?: string;
  speed?: string;
  qualityLabel?: string | null;
}

interface ServiceCardProps {
  service: ServiceCardData;
  onSelect?: (service: ServiceCardData) => void;
}

export function SafeDescription({ html }: { html?: string | null }) {
  if (!html) return null;
  const clean = sanitizeServiceDescription(html);
  return (
    <div
      className="text-xs text-muted-foreground line-clamp-3 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

export function ServiceCard({ service, onSelect }: ServiceCardProps) {
  const displayPrice = service.pricePerUnitRub !== undefined
    ? `${service.pricePerUnitRub} ₽ / шт`
    : typeof service.price === 'number'
    ? `${service.price} ₽`
    : 'По запросу';

  return (
    <div className="group relative flex flex-col justify-between h-full p-4.5 bg-card border border-border rounded-2xl shadow-2xs hover:shadow-md hover:border-primary/40 transition-all duration-200">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {service.name}
          </h3>
          {service.badge && (
            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20">
              {service.badge}
            </span>
          )}
        </div>

        {service.description && (
          <SafeDescription html={service.description} />
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs text-muted-foreground block text-[11px]">Стоимость</span>
          <span className="text-base font-extrabold text-foreground font-mono">
            {displayPrice}
          </span>
        </div>

        <Button
          size="sm"
          type="button"
          onClick={() => onSelect?.(service)}
          className="w-full sm:w-auto font-bold text-xs h-8 px-4 cursor-pointer"
          aria-label={`Заказать услугу ${service.name}`}
        >
          В корзину
        </Button>
      </div>
    </div>
  );
}
