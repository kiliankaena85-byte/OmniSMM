import { Code2 } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS } from '@/components/admin/navigation-data';

export default function PatternsLoading() {
  return (
    <div 
      className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" 
      role="status" 
      aria-busy="true" 
      aria-live="polite"
    >
      <span className="sr-only">Загрузка паттернов валидации ссылок...</span>
      <AdminTabbedHeader
        icon={Code2}
        title="Паттерны валидации ссылок"
        description="Настройка регулярных выражений для автоматического распознавания соцсетей и типов контента (посты, каналы, профили)."
        tabs={CATALOG_TABS}
      />

      {/* Top Filter & Action Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/70 rounded-lg p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-4 w-20 bg-muted/40 animate-pulse rounded" />
          <div className="h-8 w-44 bg-muted/40 animate-pulse rounded-lg" />
        </div>
        <div className="h-9 w-40 bg-muted/40 animate-pulse rounded-lg shrink-0" />
      </div>

      {/* Patterns Table Skeleton */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div className="h-4 w-24 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-28 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-20 bg-muted/40 animate-pulse rounded" />
          <div className="h-4 w-16 bg-muted/40 animate-pulse rounded text-right" />
        </div>
        <div className="divide-y divide-border/40">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="h-6 w-28 bg-muted/40 animate-pulse rounded-md shrink-0" />
              <div className="h-5 w-20 bg-muted/40 animate-pulse rounded shrink-0" />
              <div className="h-6 w-1/3 bg-muted/40 animate-pulse rounded font-mono" />
              <div className="h-4 w-8 bg-muted/40 animate-pulse rounded text-center mx-auto" />
              <div className="flex items-center gap-1 shrink-0">
                <div className="h-7 w-7 bg-muted/40 animate-pulse rounded" />
                <div className="h-7 w-7 bg-muted/40 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
