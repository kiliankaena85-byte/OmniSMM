'use client';

import React from 'react';
import { CatalogCategory } from '../catalog-data';

interface CategoryRibbonProps {
  categories: CatalogCategory[];
  selectedCategoryId: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryRibbon({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: CategoryRibbonProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {categories.map((cat) => {
        const isCatActive = cat.id === selectedCategoryId;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`px-4 py-2.5 min-h-[44px] rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 border ${
              isCatActive
                ? 'bg-foreground text-background border-foreground shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted'
            }`}
          >
            {cat.title}
          </button>
        );
      })}
    </div>
  );
}
