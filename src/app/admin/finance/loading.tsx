'use client';

import { Wallet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { FINANCE_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function FinanceLoading() {
  return (
    <div className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка финансовых метрик и транзакций...</span>
      <AdminTabbedHeader
        icon={Wallet}
        title="Финансовый учёт & Касса"
        description="Метрики эффективности, P&L, реестр платежей, проводки и сверка счетов"
        tabs={FINANCE_TABS}
        onboardingKey="finance"
        onboarding={ONBOARDING_CONFIGS.finance}
      />

      {/* 4 Modular Tab Triggers Skeleton */}
      <div className="border-b border-border/80 pb-3">
        <div className="bg-muted/40 p-1.5 rounded-lg border border-border/70 gap-1.5 flex flex-wrap sm:inline-flex shadow-xs">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-36 rounded-md" />
          ))}
        </div>
      </div>

      {/* KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border border-border/70 p-5 space-y-2 shadow-xs">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-4 w-4 rounded-md" />
            </div>
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="h-3 w-28 rounded-md" />
          </div>
        ))}
      </div>

      {/* Breakdown & Settings Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-lg border border-border/70 shadow-xs bg-card/70 backdrop-blur-xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-border/50 pb-4 space-y-2">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3.5 w-80 rounded-md" />
          </div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-muted/20 border border-border/40">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="h-3 w-48 rounded-md" />
                </div>
                <Skeleton className="h-5 w-20 rounded-md" />
              </div>
            ))}
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
