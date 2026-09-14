import React from 'react';
import { ToggleLeft } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function FeatureFlagsLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10" role="status" aria-live="polite">
      <AdminTabbedHeader
        icon={ToggleLeft}
        title="Управление фичами (Feature Flags)"
        description="Включение и отключение экспериментального или сервисного функционала без изменения кода."
        tabs={SYSTEM_TABS}
        onboardingKey="features"
        onboarding={ONBOARDING_CONFIGS.features}
      />

      {/* Legend Skeleton */}
      <div className="flex items-center gap-3 bg-card border border-border/70 rounded-lg p-3 shadow-xs">
        <div className="h-4 w-20 bg-muted/60 rounded animate-pulse" />
        <div className="h-5 w-16 bg-muted/40 rounded-md animate-pulse" />
        <div className="h-4 w-16 bg-muted/30 rounded animate-pulse" />
        <div className="h-5 w-14 bg-muted/40 rounded-md animate-pulse" />
        <div className="h-4 w-24 bg-muted/30 rounded animate-pulse" />
      </div>

      {/* Flag Groups Skeletons */}
      {[1, 2].map(g => (
        <div key={g} className="bg-card border border-border/70 rounded-lg overflow-hidden shadow-xs">
          <div className="px-4 py-2.5 border-b border-border/60 bg-muted/40">
            <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
          </div>
          <div className="divide-y divide-border/60">
            {[1, 2].map(i => (
              <div key={i} className="p-4 flex items-center justify-between gap-4">
                <div className="space-y-2 min-w-0">
                  <div className="h-4 w-40 bg-muted/60 rounded animate-pulse" />
                  <div className="h-3 w-64 bg-muted/40 rounded animate-pulse" />
                </div>
                <div className="h-4 w-24 bg-muted/40 rounded animate-pulse hidden sm:block" />
                <div className="h-4 w-20 bg-muted/30 rounded animate-pulse hidden sm:block" />
                <div className="h-7 w-20 bg-muted/50 rounded-full animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
