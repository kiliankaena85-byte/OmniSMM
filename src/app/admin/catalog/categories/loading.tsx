import { Layers } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS } from '@/components/admin/navigation-data';

export default function CategoriesLoading() {
  return (
    <div className="space-y-5 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка структуры категорий...</span>
      <AdminTabbedHeader
        icon={Layers}
        title="Категории & Соцсети"
        description="Загрузка структуры категорий..."
        tabs={CATALOG_TABS}
      />

      {/* Network Chips Skeleton */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 w-24 bg-muted/40 animate-pulse rounded-lg" />
        ))}
      </div>

      {/* Categories Table Skeleton */}
      <div className="bg-card rounded-lg border border-border/70 overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="h-5 w-40 bg-muted/40 animate-pulse rounded" />
          <div className="h-8 w-32 bg-muted/40 animate-pulse rounded-lg" />
        </div>
        <div className="divide-y divide-border/40">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-7 w-7 bg-muted/40 animate-pulse rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-4 w-48 bg-muted/40 animate-pulse rounded" />
                  <div className="h-3 w-28 bg-muted/30 animate-pulse rounded" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-muted/40 animate-pulse rounded-full" />
                <div className="h-7 w-7 bg-muted/40 animate-pulse rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
