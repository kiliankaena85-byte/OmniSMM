import { BarChart3 } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка сводных отчетов и графиков активности...</span>
      <AdminTabbedHeader
        icon={BarChart3}
        title="Аналитика платформы"
        description="Загрузка сводных отчетов и графиков активности..."
      />

      {/* Date Filter & Metrics Skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-9 w-48 bg-muted/40 animate-pulse rounded-lg" />
        <div className="h-9 w-32 bg-muted/40 animate-pulse rounded-lg" />
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-xl border border-border/70 p-4 space-y-2 shadow-sm">
            <div className="h-3.5 w-24 bg-muted/40 animate-pulse rounded" />
            <div className="h-7 w-32 bg-muted/40 animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted/30 animate-pulse rounded" />
          </div>
        ))}
      </div>

      {/* Chart Canvas Skeleton */}
      <div className="bg-card rounded-xl border border-border/70 p-5 shadow-sm space-y-3">
        <div className="h-5 w-44 bg-muted/40 animate-pulse rounded" />
        <div className="h-64 w-full bg-muted/20 animate-pulse rounded-lg border border-border/30" />
      </div>
    </div>
  );
}
