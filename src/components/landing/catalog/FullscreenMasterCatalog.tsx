'use client';

import React, { useState } from 'react';
import {
  ALL_PLATFORMS,
  CatalogPlatform,
  CatalogCategory,
  CatalogServiceItem,
} from './catalog-data';
import { PlatformRibbon } from './sub/PlatformRibbon';
import { CategoryRibbon } from './sub/CategoryRibbon';
import { CatalogServiceCard } from './sub/CatalogServiceCard';

export { ALL_PLATFORMS };
export type { CatalogPlatform, CatalogCategory, CatalogServiceItem };

interface FullscreenMasterCatalogProps {
  onSelectService?: (service: CatalogServiceItem, platformName: string, categoryName: string) => void;
}

export function FullscreenMasterCatalog({ onSelectService }: FullscreenMasterCatalogProps) {
  const [selectedPlatformId, setSelectedPlatformId] = useState<string>('telegram');
  const [isExpanded, setIsExpanded] = useState(false);

  const activePlatform = ALL_PLATFORMS.find((p) => p.id === selectedPlatformId) || ALL_PLATFORMS[0];
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(
    activePlatform.categories[0]?.id || ''
  );

  const activeCategory =
    activePlatform.categories.find((c) => c.id === selectedCategoryId) ||
    activePlatform.categories[0];

  const handlePlatformChange = (pId: string) => {
    setSelectedPlatformId(pId);
    const targetPlatform = ALL_PLATFORMS.find((p) => p.id === pId);
    if (targetPlatform && targetPlatform.categories.length > 0) {
      setSelectedCategoryId(targetPlatform.categories[0].id);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* ── 1. Top Platform Ribbon ── */}
      <PlatformRibbon
        platforms={ALL_PLATFORMS}
        selectedPlatformId={selectedPlatformId}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        onSelectPlatform={handlePlatformChange}
      />

      {/* ── 2. Category Selector Ribbon ── */}
      <CategoryRibbon
        categories={activePlatform.categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={setSelectedCategoryId}
      />

      {/* ── 3. Full-Width Services Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {activeCategory?.services.map((srv) => (
          <CatalogServiceCard
            key={srv.id}
            service={srv}
            platformName={activePlatform.name}
            categoryTitle={activeCategory.title}
            onSelectService={onSelectService}
          />
        ))}
      </div>
    </div>
  );
}
