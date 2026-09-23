'use client';

import React from 'react';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_FILTERS } from './types';

interface WizardFilterDrawerProps {
  showFilters: boolean;
  onClose: () => void;
  filters: typeof DEFAULT_FILTERS;
  setFilters: React.Dispatch<React.SetStateAction<typeof DEFAULT_FILTERS>>;
  providerCategories: Array<{ name: string; count: number }>;
}

export function WizardFilterDrawer({
  showFilters,
  onClose,
  filters,
  setFilters,
  providerCategories,
}: WizardFilterDrawerProps) {
  if (!showFilters) return null;

  return (
    <div
      id="import-filters-panel"
      className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl p-4 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">Расширенные фильтры</span>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label="Закрыть фильтры"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Категория провайдера</label>
          <Select
            value={filters.providerCategory}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, providerCategory: val || 'ALL', page: 1 }))}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Все категории" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="ALL" className="text-xs">Все категории</SelectItem>
              {providerCategories.map((pc) => (
                <SelectItem key={pc.name} value={pc.name} className="text-xs">
                  {pc.name} ({pc.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Статус импорта</label>
          <Select
            value={filters.importStatus}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, importStatus: (val as any) || 'NOT_IMPORTED', page: 1 }))}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NOT_IMPORTED" className="text-xs">Не импортированы</SelectItem>
              <SelectItem value="IMPORTED" className="text-xs">Уже импортированы</SelectItem>
              <SelectItem value="ALL" className="text-xs">Все</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Скорость выполнения</label>
          <Select
            value={filters.velocity}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, velocity: val || 'ALL', page: 1 }))}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">Любая</SelectItem>
              <SelectItem value="FAST" className="text-xs">Быстрая (50+ шт/ч)</SelectItem>
              <SelectItem value="MEDIUM" className="text-xs">Средняя (10–50 шт/ч)</SelectItem>
              <SelectItem value="SLOW" className="text-xs">Медленная (до 10 шт/ч)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">ГЕО</label>
          <Select
            value={filters.geo}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, geo: val || 'ALL', page: 1 }))}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Любое" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="ALL" className="text-xs">Любое ГЕО</SelectItem>
              <SelectItem value="RU" className="text-xs">🇷🇺 Россия</SelectItem>
              <SelectItem value="UA" className="text-xs">🇺🇦 Украина</SelectItem>
              <SelectItem value="KZ" className="text-xs">🇰🇿 Казахстан</SelectItem>
              <SelectItem value="BY" className="text-xs">🇧🇾 Беларусь</SelectItem>
              <SelectItem value="WORLDWIDE" className="text-xs">🌍 Весь мир</SelectItem>
              <SelectItem value="REAL" className="text-xs">👤 Реальные</SelectItem>
              <SelectItem value="MIXED" className="text-xs">🔄 Смешанное</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Цена закупки (₽/шт)</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="от"
              value={filters.minPrice}
              onChange={(e) => setFilters((prev) => ({ ...prev, minPrice: e.target.value, page: 1 }))}
              className="w-full h-9 px-2 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
            />
            <span className="text-muted-foreground text-xs">—</span>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="до"
              value={filters.maxPrice}
              onChange={(e) => setFilters((prev) => ({ ...prev, maxPrice: e.target.value, page: 1 }))}
              className="w-full h-9 px-2 text-xs rounded-lg bg-background border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 tabular-nums"
            />
          </div>
        </div>

        <div className="space-y-2 pt-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hasRefill}
              onChange={(e) => setFilters((prev) => ({ ...prev, hasRefill: e.target.checked, page: 1 }))}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-xs font-medium text-foreground">С гарантией / рефиллом</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.hasAnomaly}
              onChange={(e) => setFilters((prev) => ({ ...prev, hasAnomaly: e.target.checked, page: 1 }))}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-xs font-medium text-foreground">С аномалией цены</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filters.retailReady}
              onChange={(e) => setFilters((prev) => ({ ...prev, retailReady: e.target.checked, page: 1 }))}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
            />
            <span className="text-xs font-medium text-foreground">Мин. заказ ≤ 100 шт</span>
          </label>
        </div>
      </div>
    </div>
  );
}
