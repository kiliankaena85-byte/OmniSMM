'use client';

import { Gift } from 'lucide-react';
import { Skeleton } from '@heroui/react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { FINANCE_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function MarketingLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка данных маркетинга и промокодов...</span>
      <AdminTabbedHeader
        icon={Gift}
        title="Маркетинг"
        description="Управление промокодами и аналитика партнерской программы"
        tabs={FINANCE_TABS}
        onboardingKey="marketing"
        onboarding={ONBOARDING_CONFIGS.marketing}
      />

      {/* Tabs Selector Skeleton */}
      <div className="bg-muted/50 p-1 rounded-lg inline-flex gap-1">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-44 rounded-md" />
      </div>

      {/* Promocodes Card Skeleton */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
        <div className="border-b border-border/70 bg-muted/20 p-4 flex items-center justify-between">
          <Skeleton className="h-4 w-40 rounded-md" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        
        {/* Table Filters Skeleton */}
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-center bg-muted/20 p-4 rounded-lg border border-border/40">
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>

          <div className="border border-border/50 rounded-lg overflow-hidden">
            <div className="p-3 border-b border-border/40 bg-muted/10 flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-3 border-b border-border/30 flex items-center justify-between">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-4 w-28 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-6 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
