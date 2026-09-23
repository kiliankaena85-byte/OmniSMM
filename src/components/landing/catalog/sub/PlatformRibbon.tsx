'use client';

import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CatalogPlatform } from '../catalog-data';

interface PlatformRibbonProps {
  platforms: CatalogPlatform[];
  selectedPlatformId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectPlatform: (platformId: string) => void;
}

export function PlatformRibbon({
  platforms,
  selectedPlatformId,
  isExpanded,
  onToggleExpand,
  onSelectPlatform,
}: PlatformRibbonProps) {
  const visiblePlatforms = isExpanded ? platforms : platforms.slice(0, 5);

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-card border border-border/80 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Выберите социальную сеть:
        </span>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline focus-visible:outline-none min-h-[44px] px-2"
        >
          <span>{isExpanded ? 'Свернуть' : 'Ещё 15+ соцсетей'}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
        {visiblePlatforms.map((platform) => {
          const isSelected = platform.id === selectedPlatformId;
          const Icon = platform.icon;

          return (
            <button
              key={platform.id}
              type="button"
              onClick={() => onSelectPlatform(platform.id)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 min-h-[44px] rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 border text-left ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-[1.02]'
                  : 'bg-muted/40 text-muted-foreground border-border hover:text-foreground hover:bg-muted active:scale-98'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center bg-gradient-to-tr ${platform.color} text-white shrink-0`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <span className="truncate min-w-0">{platform.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
