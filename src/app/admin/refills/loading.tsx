'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { RefreshCw } from 'lucide-react';
import { OPERATIONS_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function AdminRefillsLoading() {
  return (
    <div
      className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Загрузка реестра докруток...</span>

      {/* ── 1. Canonical Tabbed Header ── */}
      <AdminTabbedHeader
        icon={RefreshCw}
        title="Гарантийные Докрутки (Refills)"
        description="Загрузка реестра гарантийных докруток..."
        tabs={OPERATIONS_TABS}
        onboardingKey="refills"
        onboarding={ONBOARDING_CONFIGS.refills}
      />

      {/* ── 2. Kill-Switch Banner Skeleton ── */}
      <div className="p-4 rounded-lg border border-border/70 bg-card/60 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-48 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-full" />
            </div>
            <Skeleton className="h-3 w-80 max-w-full rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-36 rounded-lg shrink-0" />
      </div>

      {/* ── 3. Toolbar: Search & Filter Pills Skeleton ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card/40 p-2 rounded-lg border border-border/70 backdrop-blur-sm shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-24 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-8.5 w-64 rounded-lg" />
      </div>

      {/* ── 4. Table Card Skeleton ── */}
      <div className="bg-card/60 backdrop-blur-md border border-border/70 rounded-lg shadow-xs overflow-hidden">
        {/* Header row */}
        <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-36 rounded-md" />
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
        </div>

        {/* Rows */}
        <div className="divide-y divide-border/40 p-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="py-3 px-4 flex items-center justify-between gap-4">
              <div className="w-[12%] space-y-1">
                <Skeleton className="h-3.5 w-14 rounded-md" />
                <Skeleton className="h-2.5 w-16 rounded-md" />
              </div>
              <div className="w-[24%] space-y-1">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="h-2.5 w-40 rounded-md" />
              </div>
              <div className="w-[18%]">
                <Skeleton className="h-3.5 w-32 rounded-md" />
              </div>
              <div className="w-[22%] space-y-1">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-3.5 w-36 rounded-md" />
              </div>
              <div className="w-[12%]">
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="w-[12%] flex justify-end gap-1.5">
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}