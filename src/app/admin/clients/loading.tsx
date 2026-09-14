'use client';
import { Skeleton } from "@heroui/react";
import { AdminTabbedHeader } from "@/components/admin/tabbed-header";
import { FINANCE_TABS, ONBOARDING_CONFIGS } from "@/components/admin/navigation-data";
import { Users } from "lucide-react";

export default function ClientsLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка списка клиентов платформы...</span>
      <AdminTabbedHeader
        icon={Users}
        title="Клиенты платформы"
        description={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground font-medium text-xs">
            <Skeleton className="h-3.5 w-16 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-3.5 w-20 rounded-md" />
            <Skeleton className="h-3.5 w-32 rounded-md" />
          </div>
        }
        action={
          <Skeleton className="h-8 w-28 rounded-lg" />
        }
        tabs={FINANCE_TABS}
        onboardingKey="clients"
        onboarding={ONBOARDING_CONFIGS.clients}
      />

      {/* Filter Tabs & Search / Sort Bar Skeleton */}
      <div className="bg-card/60 backdrop-blur-md border border-border/70 shadow-xs rounded-lg p-4 sm:p-5 ring-1 ring-border/5 space-y-4">
        {/* Fast Filter Pills Skeleton */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg shrink-0" />
          ))}
        </div>

        {/* Search Bar & Quick Sort Controls Skeleton */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-20 rounded-lg" />
          </div>
          <Skeleton className="h-9 w-44 rounded-lg shrink-0" />
        </div>
      </div>

      {/* Main Clients Table Skeleton */}
      <div className="bg-card/60 backdrop-blur-md border border-border/70 shadow-xs rounded-lg ring-1 ring-border/5 overflow-hidden">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="border-b border-border/50 pb-3 flex items-center justify-between gap-4">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-20 rounded-md" />
          </div>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="border-b border-border/40 py-3 flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1 max-w-[200px]">
                <Skeleton className="h-4 w-36 rounded-md" />
                <Skeleton className="h-3 w-24 rounded-md" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-4 w-12 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
          ))}

          {/* Pagination Skeleton */}
          <div className="pt-2 flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-8 w-48 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
