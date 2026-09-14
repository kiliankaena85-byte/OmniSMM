import { Download } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function ImportLoading() {
  return (
    <div 
      className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" 
      role="status" 
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Загрузка мастера импорта услуг провайдеров...</span>
      <AdminTabbedHeader
        icon={Download}
        title="Импорт Услуг"
        description="Загрузка мастера синхронизации и сопоставления каталога..."
        tabs={CATALOG_TABS}
        onboardingKey="providers"
        onboarding={ONBOARDING_CONFIGS.providers}
      />

      {/* Import Wizard Steps Bar Skeleton */}
      <div className="bg-card/60 border border-border/70 rounded-lg p-4 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 rounded-full bg-primary/20 animate-pulse" />
          <div className="space-y-1">
            <div className="h-4 w-32 bg-muted/40 animate-pulse rounded" />
            <div className="h-3 w-48 bg-muted/30 animate-pulse rounded" />
          </div>
        </div>
        <div className="h-8 w-44 bg-muted/40 animate-pulse rounded-lg" />
      </div>

      {/* Provider Selector / Filter Card Skeleton */}
      <div className="bg-card border border-border/70 rounded-lg p-5 space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 bg-muted/40 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/30 animate-pulse rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3.5 w-28 bg-muted/40 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/30 animate-pulse rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3.5 w-20 bg-muted/40 animate-pulse rounded" />
            <div className="h-9 w-full bg-muted/30 animate-pulse rounded-lg" />
          </div>
        </div>
      </div>

      {/* Services Table Skeleton */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="h-4 w-32 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-24 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-28 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted/40 animate-pulse rounded text-right" />
        </div>
        <div className="divide-y divide-border/40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-4 w-4 bg-muted/40 animate-pulse rounded" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-4 w-2/3 bg-muted/40 animate-pulse rounded" />
                  <div className="h-3 w-40 bg-muted/30 animate-pulse rounded" />
                </div>
              </div>
              <div className="h-5 w-20 bg-muted/40 animate-pulse rounded" />
              <div className="h-5 w-24 bg-muted/40 animate-pulse rounded" />
              <div className="h-7 w-28 bg-muted/40 animate-pulse rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
