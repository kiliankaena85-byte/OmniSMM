'use client';

import React from 'react';
import { PLATFORM_TABS } from './types';

interface WizardPlatformTabsProps {
  platformCounts: Record<string, number>;
  selectedPlatform: string;
  onSelectPlatform: (platformId: string) => void;
}

export function WizardPlatformTabs({
  platformCounts,
  selectedPlatform,
  onSelectPlatform,
}: WizardPlatformTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-border">
      {PLATFORM_TABS.map((tab) => {
        const count = platformCounts[tab.id.toLowerCase()] || 0;
        const isActive = selectedPlatform.toLowerCase() === tab.id.toLowerCase();
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectPlatform(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.name}</span>
            {count > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
