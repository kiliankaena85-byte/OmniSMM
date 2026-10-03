'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

export { 
  type SettingsMasterCluster,
  type SettingsSubTab,
  type SettingsClusterConfig,
  SETTINGS_CLUSTERS,
  resolveSettingsNavigation
} from './settings-navigation-config';
import { SETTINGS_CLUSTERS, resolveSettingsNavigation } from './settings-navigation-config';

interface SettingsClusterTabsProps {
  activeTab: string;
}

export function SettingsClusterTabs({ activeTab }: SettingsClusterTabsProps) {
  const { activeSubTab } = resolveSettingsNavigation(activeTab);
  const searchParams = useSearchParams();

  const createTabHref = React.useCallback(
    (subTabId: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', subTabId);
      return `?${params.toString()}`;
    },
    [searchParams]
  );

  // Flatten all 9 sub-tabs for direct, 1-click access without multi-level clicking
  const allSubTabs = React.useMemo(() => {
    return SETTINGS_CLUSTERS.flatMap(cluster => 
      cluster.subTabs.map(sub => ({
        ...sub,
        clusterId: cluster.id,
      }))
    );
  }, []);

  return (
    <div className="w-full">
      {/* ── High-Density Flat Settings Navigation (Zero-Clutter, 1-Click Access) ── */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/30 border border-border/70 rounded-xl overflow-x-auto no-scrollbar snap-x shadow-xs">
        {allSubTabs.map((subTab) => {
          const SubIcon = subTab.icon;
          const isSubActive = subTab.id === activeSubTab;

          return (
            <Link
              key={subTab.id}
              href={createTabHref(subTab.id)}
              scroll={false}
              className={cn(
                "flex items-center gap-2 py-2 px-3 sm:px-3.5 rounded-lg text-xs font-bold transition-all shrink-0 snap-start cursor-pointer border min-h-[38px] select-none",
                isSubActive
                  ? "bg-card text-foreground border-border shadow-xs scale-[1.01]"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40 border-transparent"
              )}
              title={subTab.description}
            >
              <div className={cn(
                "p-1 rounded-md border shrink-0 transition-colors",
                isSubActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/40"
              )}>
                <SubIcon className="w-3.5 h-3.5" />
              </div>
              <span className="whitespace-nowrap">{subTab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
