import { Plug } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function ProvidersLoading() {
  return (
    <div 
      className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" 
      role="status" 
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Загрузка поставщиков услуг и статусов синхронизации...</span>
      <AdminTabbedHeader
        icon={Plug}
        title="Провайдеры API"
        description="Загрузка поставщиков услуг и статусов синхронизации..."
        tabs={CATALOG_TABS}
        onboardingKey="providers"
        onboarding={ONBOARDING_CONFIGS.providers}
      />

      {/* Liquidity Widget Skeleton */}
      <div className="bg-card/60 border border-border/70 rounded-lg p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-muted/40 animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted/30 animate-pulse rounded" />
          </div>
          <div className="h-8 w-32 bg-muted/40 animate-pulse rounded-lg" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-20 bg-muted/30 animate-pulse rounded-lg border border-border/40" />
          <div className="h-20 bg-muted/30 animate-pulse rounded-lg border border-border/40" />
          <div className="h-20 bg-muted/30 animate-pulse rounded-lg border border-border/40" />
        </div>
      </div>

      {/* Toolbar Filter Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-2.5 rounded-lg border border-border/70 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="h-8 w-16 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-8 w-24 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-8 w-20 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-8 w-24 bg-muted/40 animate-pulse rounded-lg" />
        </div>
        <div className="h-8 w-60 bg-muted/40 animate-pulse rounded-lg" />
      </div>

      {/* Table Skeleton */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="h-4 w-32 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-28 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted/40 animate-pulse rounded text-right" />
        </div>
        <div className="divide-y divide-border/40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="h-4 w-40 bg-muted/40 animate-pulse rounded" />
                <div className="h-3 w-48 bg-muted/30 animate-pulse rounded font-mono" />
              </div>
              <div className="h-5 w-12 bg-muted/40 animate-pulse rounded" />
              <div className="h-5 w-24 bg-muted/40 animate-pulse rounded" />
              <div className="h-5 w-16 bg-muted/40 animate-pulse rounded" />
              <div className="h-5 w-16 bg-muted/40 animate-pulse rounded" />
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="h-8 w-20 bg-muted/40 animate-pulse rounded-lg" />
                <div className="h-8 w-8 bg-muted/40 animate-pulse rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
