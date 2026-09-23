'use client';

import React from 'react';
import { List, LayoutGrid } from 'lucide-react';

export type OrderViewMode = 'table' | 'cards';

interface OrderViewModeSwitcherProps {
  viewMode: OrderViewMode;
  onChange: (mode: OrderViewMode) => void;
  className?: string;
}

export function OrderViewModeSwitcher({
  viewMode,
  onChange,
  className = '',
}: OrderViewModeSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Режим отображения заказов"
      className={`inline-flex items-center p-1 bg-muted/80 rounded-xl border border-border/60 shadow-2xs select-none ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={viewMode === 'table'}
        onClick={() => onChange('table')}
        title="Отображать компактным списком / таблицей"
        className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-[36px] ${
          viewMode === 'table'
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
        }`}
      >
        <List className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Список</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={viewMode === 'cards'}
        onClick={() => onChange('cards')}
        title="Отображать карточками"
        className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-[36px] ${
          viewMode === 'cards'
            ? 'bg-card text-foreground shadow-xs'
            : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
        }`}
      >
        <LayoutGrid className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Карточки</span>
      </button>
    </div>
  );
}
