'use client';
import { Skeleton } from "@heroui/react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Activity } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка аналитики и метрик...</span>
      <AdminPageHeader
        icon={Activity}
        title="Панель управления"
        description="Загрузка аналитики и метрик..."
      />
      
      <div className="bg-card rounded-lg border border-border/70 p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48 rounded-md" />
            <Skeleton className="h-3 w-72 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>

      {/* Wave Chart Skeleton */}
      <div className="bg-card rounded-lg border border-border/70 p-5 space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-border/50 pb-3">
          <Skeleton className="h-5 w-64 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md" />
        </div>
        <Skeleton className="h-48 w-full rounded-md" />
      </div>

      {/* 4 Bento Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border border-border/70 p-4 space-y-3 shadow-sm">
            <div className="flex justify-between items-center">
              <Skeleton className="h-3.5 w-28 rounded-md" />
              <Skeleton className="h-4 w-14 rounded-md" />
            </div>
            <Skeleton className="h-7 w-36 rounded-md" />
            <Skeleton className="h-3 w-44 rounded-md" />
          </div>
        ))}
      </div>

      {/* 2-Column Widgets Skeleton (6 + 6) */}
      <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
        <div className="bg-card rounded-lg border border-border/70 p-5 space-y-3 shadow-sm">
          <Skeleton className="h-5 w-48 rounded-md" />
          <div className="space-y-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
        <div className="bg-card rounded-lg border border-border/70 p-5 space-y-3 shadow-sm">
          <Skeleton className="h-5 w-48 rounded-md" />
          <div className="space-y-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
