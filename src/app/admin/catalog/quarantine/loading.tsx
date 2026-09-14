import { AlertTriangle } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function QuarantineLoading() {
  return (
    <div 
      className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" 
      role="status" 
      aria-busy="true" 
      aria-live="polite"
    >
      <span className="sr-only">Загрузка данных карантина и аномалий каталога...</span>
      <AdminTabbedHeader
        icon={AlertTriangle}
        title="Карантин цен и аномалий"
        description="Загрузка списка ценовых скачков, зомби-услуг и сбоев API..."
        tabs={CATALOG_TABS}
        onboardingKey="quarantine"
        onboarding={ONBOARDING_CONFIGS.quarantine}
      />

      {/* Tabs List Skeleton */}
      <div className="border-b border-border/70 pb-3 flex items-center gap-6">
        <div className="h-5 w-32 bg-muted/40 animate-pulse rounded" />
        <div className="h-5 w-28 bg-muted/40 animate-pulse rounded" />
        <div className="h-5 w-24 bg-muted/40 animate-pulse rounded" />
        <div className="h-5 w-44 bg-muted/40 animate-pulse rounded" />
      </div>

      {/* Top Action / Status Bar Skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-48 bg-muted/40 animate-pulse rounded" />
        <div className="h-8 w-28 bg-muted/40 animate-pulse rounded-lg" />
      </div>

      {/* Quarantine Table Skeleton */}
      <div className="bg-card rounded-lg border border-border/70 overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="h-4 w-24 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted/40 animate-pulse rounded ml-auto" />
          <div className="h-4 w-28 bg-muted/40 animate-pulse rounded ml-8" />
        </div>
        <div className="divide-y divide-border/40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-6 w-6 bg-muted/40 animate-pulse rounded shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-4 w-3/5 bg-muted/40 animate-pulse rounded" />
                  <div className="h-3 w-40 bg-muted/30 animate-pulse rounded" />
                </div>
              </div>
              <div className="h-6 w-28 bg-muted/40 animate-pulse rounded-md shrink-0" />
              <div className="h-6 w-20 bg-muted/40 animate-pulse rounded shrink-0 text-right" />
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="h-8 w-24 bg-muted/40 animate-pulse rounded-lg" />
                <div className="h-8 w-20 bg-muted/40 animate-pulse rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
