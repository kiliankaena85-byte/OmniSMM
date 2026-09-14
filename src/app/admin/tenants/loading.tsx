import React from 'react';
import { Globe } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS } from '@/components/admin/navigation-data';

export default function AdminTenantsLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10" role="status" aria-live="polite">
      {/* Tabbed Header with SYSTEM_TABS */}
      <AdminTabbedHeader
        icon={Globe}
        title="Бренды и Мульти-арендаторы"
        description="Управление изолированными витринами (SMMplan, SMMflux), доменами и отдельными настройками."
        tabs={SYSTEM_TABS}
      />

      {/* Top Banner Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/70 rounded-lg p-5 shadow-xs">
        <div className="space-y-2">
          <div className="h-5 w-64 bg-muted/60 rounded-md animate-pulse" />
          <div className="h-3.5 w-96 bg-muted/40 rounded-md animate-pulse" />
        </div>
        <div className="h-9 w-36 bg-muted/60 rounded-lg animate-pulse shrink-0" />
      </div>

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border border-border/70 rounded-lg p-5 shadow-xs space-y-3">
            <div className="h-3 w-24 bg-muted/40 rounded animate-pulse" />
            <div className="flex items-center justify-between">
              <div className="h-7 w-16 bg-muted/60 rounded animate-pulse" />
              <div className="h-5 w-5 bg-muted/40 rounded-full animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Tenants Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-card border border-border/70 rounded-lg p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-5 w-32 bg-muted/60 rounded animate-pulse" />
                <div className="h-3 w-20 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="h-6 w-20 bg-muted/40 rounded-full animate-pulse" />
            </div>

            <div className="p-3 rounded-lg bg-secondary/30 border border-border/40 space-y-2">
              <div className="h-4 w-40 bg-muted/50 rounded animate-pulse" />
            </div>

            <div className="pt-4 border-t border-border/60 flex items-center justify-between">
              <div className="h-8 w-24 bg-muted/40 rounded-lg animate-pulse" />
              <div className="h-8 w-24 bg-muted/40 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
