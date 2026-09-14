'use client';

import { Skeleton } from "@heroui/react";
import { AdminTabbedHeader } from "@/components/admin/tabbed-header";
import { FINANCE_TABS, ONBOARDING_CONFIGS } from "@/components/admin/navigation-data";
import { ArrowLeftRight } from "lucide-react";

export default function TransactionsLoading() {
  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12 animate-in fade-in duration-500 ease-out" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка реестра транзакций платформы...</span>
      
      <AdminTabbedHeader
        icon={ArrowLeftRight}
        title="Транзакции платформы (Ledger)"
        description="Сквозной реестр финансовых операций, пополнений, оплат заказов и возвратов по всем клиентам"
        tabs={FINANCE_TABS}
        onboardingKey="finance"
        onboarding={ONBOARDING_CONFIGS.finance}
      />

      {/* 4 Summary Metric Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card/70 backdrop-blur-sm border border-border/70 rounded-lg p-3.5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="w-7 h-7 rounded-lg" />
            </div>
            <Skeleton className="h-6 w-28 rounded-md" />
            <Skeleton className="h-3 w-32 rounded-md" />
          </div>
        ))}
      </div>

      {/* Filter Toolbar Skeleton */}
      <div className="bg-card/90 backdrop-blur-sm border border-border/70 rounded-lg p-3 shadow-xs space-y-2.5">
        {/* Row 1: Search, Period, Status, Refresh/Export */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
          <Skeleton className="h-8 flex-1 min-w-[200px] rounded-lg" />
          <Skeleton className="h-8 w-60 rounded-lg shrink-0" />
          <Skeleton className="h-8 w-28 rounded-lg shrink-0" />
          <Skeleton className="h-8 w-20 rounded-lg shrink-0" />
          <Skeleton className="h-8 w-24 rounded-lg shrink-0" />
        </div>

        {/* Row 2: Type Filter Pills Skeleton */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-1 border-t border-border/40">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className="h-7 w-28 rounded-lg shrink-0" />
          ))}
        </div>
      </div>

      {/* Main Table Skeleton */}
      <div className="bg-card border border-border/70 rounded-lg overflow-hidden shadow-xs">
        <div className="p-3 sm:px-4 border-b border-border/60 bg-muted/15 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-36 rounded-md" />
          <Skeleton className="h-7 w-48 rounded-lg" />
        </div>

        <div className="p-4 space-y-3">
          <div className="border-b border-border/50 pb-2.5 flex items-center justify-between gap-2">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-3.5 w-16 rounded-md" />
            <Skeleton className="h-3.5 w-32 rounded-md" />
            <Skeleton className="h-3.5 w-16 rounded-md" />
            <Skeleton className="h-3.5 w-16 rounded-md" />
          </div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="border-b border-border/30 py-2.5 flex items-center justify-between gap-2">
              <div className="space-y-1 w-28">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <Skeleton className="h-2.5 w-16 rounded-md" />
              </div>
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-5 w-24 rounded-md" />
              <Skeleton className="h-4 w-16 rounded-md" />
              <Skeleton className="h-3.5 w-36 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          ))}
        </div>

        <div className="p-3 sm:px-4 border-t border-border/70 bg-muted/10 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-44 rounded-md" />
          <Skeleton className="h-8 w-56 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
