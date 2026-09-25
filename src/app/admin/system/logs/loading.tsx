import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function SystemLogsLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10" role="status" aria-live="polite">
      <AdminTabbedHeader
        icon={ShieldAlert}
        title="Системные логи и аудит безопасности"
        description="Централизованный журнал событий безопасности, попыток авторизации, аудита персонала и сбоев интеграций без использования сторонних сервисов."
        tabs={SYSTEM_TABS}
        onboardingKey="logs"
        onboarding={ONBOARDING_CONFIGS.logs}
      />

      {/* Top 4 Stat Skeletons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
            <div className="h-6 w-12 bg-muted/40 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Filter Bar Skeleton */}
      <div className="p-3 rounded-xl border border-border bg-card flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="flex gap-2">
          <div className="h-7 w-24 bg-muted/60 rounded-md animate-pulse" />
          <div className="h-7 w-24 bg-muted/40 rounded-md animate-pulse" />
          <div className="h-7 w-24 bg-muted/40 rounded-md animate-pulse" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="h-7 w-48 bg-muted/60 rounded-lg animate-pulse" />
          <div className="h-7 w-28 bg-muted/40 rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-3 border-b border-border bg-muted/30">
          <div className="h-4 w-48 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-3 flex items-center justify-between gap-4">
              <div className="h-3.5 w-32 bg-muted/60 rounded animate-pulse" />
              <div className="h-3.5 w-44 bg-muted/40 rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted/50 rounded-full animate-pulse" />
              <div className="h-3.5 w-24 bg-muted/40 rounded animate-pulse hidden sm:block" />
              <div className="h-6 w-20 bg-muted/50 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
