'use client';

import React from 'react';
import { Search, SlidersHorizontal, RotateCcw, ListChecks, Layers } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import type { CategoryItem } from '../../types';

interface WizardBulkToolbarProps {
  localSearch: string;
  setLocalSearch: (val: string) => void;
  showFilters: boolean;
  setShowFilters: (val: boolean | ((prev: boolean) => boolean)) => void;
  isFiltersActive: boolean;
  resetFilters: () => void;
  incompatibleCount: number;
  handleSelectAllFiltered: () => void;
  selectingAllFiltered: boolean;
  loading: boolean;
  bulkCategory: string;
  setBulkCategory: (val: string) => void;
  localCategories: CategoryItem[];
  categoriesByNetwork: Array<{ network: string; items: CategoryItem[] }>;
  handleApplyBulkCategory: () => void;
  selectedCount: number;
  totalServicesCount: number;
}

export function WizardBulkToolbar({
  localSearch,
  setLocalSearch,
  showFilters,
  setShowFilters,
  isFiltersActive,
  resetFilters,
  incompatibleCount,
  handleSelectAllFiltered,
  selectingAllFiltered,
  loading,
  bulkCategory,
  setBulkCategory,
  localCategories,
  categoriesByNetwork,
  handleApplyBulkCategory,
  selectedCount,
  totalServicesCount,
}: WizardBulkToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Поиск по названию услуги..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          onClick={() => setShowFilters((p) => !p)}
          className={`p-2 rounded-lg border text-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
            isFiltersActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-muted'
          }`}
          aria-expanded={showFilters}
          aria-controls="import-filters-panel"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="hidden sm:inline">Фильтры</span>
        </button>
        {isFiltersActive && (
          <button
            onClick={resetFilters}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Сбросить все фильтры"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        {incompatibleCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
            ⚠️ {incompatibleCount} конфликт типов
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSelectAllFiltered}
          disabled={selectingAllFiltered || loading}
          title="Выбрать все услуги, соответствующие текущим фильтрам (до 5000)"
          className="px-3 py-2 bg-card border border-border hover:bg-muted disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          {selectingAllFiltered ? (
            <span className="animate-spin text-xs">⏳</span>
          ) : (
            <ListChecks className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Выбрать все по фильтрам</span>
          <span className="sm:hidden">Все</span>
        </button>
        <Select value={bulkCategory} onValueChange={(val) => setBulkCategory(val || '')}>
          <SelectTrigger className="w-[200px] h-9 text-xs">
            <SelectValue placeholder="Массовая категория...">
              {(val: string) => {
                const cat = localCategories.find((c) => c.id === val);
                return cat ? `${cat.network?.name || ''} • ${cat.name}` : val || 'Массовая категория...';
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categoriesByNetwork.map((group) => (
              <SelectGroup key={group.network}>
                <SelectLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
                  {group.network}
                </SelectLabel>
                {group.items.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} label={cat.name} className="text-xs cursor-pointer">
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <button
          onClick={handleApplyBulkCategory}
          disabled={!bulkCategory}
          title="Категория будет назначена всем выбранным услугам (включая выбранные на других страницах)"
          className="px-3 py-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          Назначить ({selectedCount || totalServicesCount})
        </button>
        <a
          href="/admin/catalog/categories"
          target="_blank"
          rel="noopener noreferrer"
          title="Открыть управление категориями и соцсетями в новой вкладке"
          className="px-2.5 py-2 bg-card border border-border hover:bg-muted text-muted-foreground hover:text-primary text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">+ Категории</span>
        </a>
      </div>
    </div>
  );
}
