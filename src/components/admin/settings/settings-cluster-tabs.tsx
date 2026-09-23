'use client';

import * as React from 'react';
import Link from 'next/link';
import { 
  Store, 
  CreditCard, 
  ShieldCheck, 
  Settings, 
  Database, 
  Link as LinkIcon, 
  Bot, 
  Server, 
  Users, 
  MessageSquare, 
  History 
} from 'lucide-react';

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
  const { activeCluster, activeSubTab } = resolveSettingsNavigation(activeTab);

  const currentClusterConfig = SETTINGS_CLUSTERS.find(c => c.id === activeCluster) || SETTINGS_CLUSTERS[0];

  return (
    <div className="space-y-4">
      {/* ── LEVEL 1: Master Clusters (3 Segmented Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 bg-muted/20 border border-border/70 rounded-lg shadow-xs">
        {SETTINGS_CLUSTERS.map((cluster) => {
          const Icon = cluster.icon;
          const isSelected = cluster.id === activeCluster;
          // When clicking a master cluster, default to its first sub-tab
          const targetHref = `?tab=${cluster.subTabs[0].id}`;

          return (
            <Link
              key={cluster.id}
              href={targetHref}
              scroll={false}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-200 cursor-pointer ${
                isSelected
                  ? 'bg-card text-foreground shadow-xs border border-border font-bold scale-[1.01]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card/40 border border-transparent'
              }`}
            >
              <div className={`p-2 rounded-lg border shrink-0 transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/60 text-muted-foreground border-border/40'
              }`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs uppercase tracking-wider truncate">
                    {cluster.label}
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border ${
                    isSelected
                      ? 'bg-primary/10 text-primary border-primary/20'
                      : 'bg-muted text-muted-foreground border-border/30'
                  }`}>
                    {cluster.subTabs.length}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-normal truncate mt-0.5">
                  {cluster.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ── LEVEL 2: Sub-tabs within the Active Cluster ── */}
      <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 overflow-x-auto no-scrollbar snap-x">
        {currentClusterConfig.subTabs.map((subTab) => {
          const SubIcon = subTab.icon;
          const isSubActive = subTab.id === activeSubTab;

          return (
            <Link
              key={subTab.id}
              href={`?tab=${subTab.id}`}
              scroll={false}
              className={`flex items-center gap-2 py-2 px-4 rounded-lg text-xs font-bold transition-all shrink-0 snap-start cursor-pointer border ${
                isSubActive
                  ? 'bg-primary/10 text-primary border-primary/30 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border-transparent'
              }`}
              title={subTab.description}
            >
              <SubIcon className="w-3.5 h-3.5 shrink-0" />
              <span>{subTab.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
