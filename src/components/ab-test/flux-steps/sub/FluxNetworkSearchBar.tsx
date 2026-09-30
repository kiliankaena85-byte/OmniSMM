'use client';

import React from "react";
import { Search, X } from "lucide-react";
import { TAXONOMY_CHIPS, type TaxonomyId } from "../flux-network-helpers";

export interface FluxNetworkSearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeTaxonomy: TaxonomyId;
  setActiveTaxonomy: (tax: TaxonomyId) => void;
}

export function FluxNetworkSearchBar({
  searchQuery,
  setSearchQuery,
  activeTaxonomy,
  setActiveTaxonomy,
}: FluxNetworkSearchBarProps) {
  return (
    <div className="w-full">
      {/* Title & Instant Search Input */}
      <div className="w-full mb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
            Выберите соцсеть
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Более 25+ платформ с розничной тарификацией за 1 единицу
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск платформы..."
            aria-label="Поиск соцсети"
            className="w-full h-10 sm:h-9 pl-9 pr-9 text-base sm:text-xs bg-white/95 dark:bg-zinc-900 border border-neutral-300/80 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-foreground placeholder:text-muted-foreground shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Очистить поиск"
              className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg cursor-pointer transition-colors active:scale-90"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Taxonomy Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-2">
        {TAXONOMY_CHIPS.map((chip) => {
          const isActive = activeTaxonomy === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveTaxonomy(chip.id)}
              aria-pressed={isActive}
              className={`min-h-[44px] sm:min-h-[36px] px-4 py-2 sm:py-1.5 text-xs font-bold rounded-full border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                isActive
                  ? "bg-purple-600 text-white border-purple-600 shadow-xs"
                  : "bg-white/90 dark:bg-zinc-900/90 border-neutral-200/90 dark:border-zinc-800 text-neutral-700 dark:text-neutral-300 hover:text-foreground hover:bg-neutral-100 dark:hover:bg-zinc-800 shadow-2xs"
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
