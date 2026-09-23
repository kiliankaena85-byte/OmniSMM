import { ShoppingCart } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS } from '@/components/admin/navigation-data';

export default function CatalogLoading() {
  return (
    <div className="space-y-5 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка списка услуг и ценообразования...</span>
      <AdminTabbedHeader
        icon={ShoppingCart}
        title="Каталог услуг"
        description="Загрузка списка услуг и ценообразования..."
        tabs={CATALOG_TABS}
      />

      {/* Top Filter Bar Skeleton */}
      <div className="bg-card rounded-lg border border-border/70 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 w-64 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-9 w-40 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-9 w-36 bg-muted/40 animate-pulse rounded-lg" />
          <div className="h-9 w-32 bg-muted/40 animate-pulse rounded-lg ml-auto" />
        </div>
      </div>

      {/* Catalog Table Skeleton */}
      <div className="bg-card rounded-lg border border-border/70 overflow-hidden shadow-sm">
        <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="h-5 w-44 bg-muted/40 animate-pulse rounded" />
          <div className="h-7 w-28 bg-muted/40 animate-pulse rounded-md" />
        </div>
        <div className="p-0 divide-y divide-border/40">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="px-3.5 py-3 flex items-center gap-3">
              <div className="h-4 w-12 bg-muted/40 animate-pulse rounded shrink-0" />
              <div className="h-4 w-6 bg-muted/40 animate-pulse rounded-full shrink-0" />
              <div className="h-4 w-1/3 bg-muted/40 animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted/40 animate-pulse rounded ml-auto" />
              <div className="h-4 w-20 bg-muted/40 animate-pulse rounded" />
              <div className="h-7 w-16 bg-muted/40 animate-pulse rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
