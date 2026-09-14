'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { ShieldCheck } from 'lucide-react';
import { SYSTEM_TABS } from '@/components/admin/navigation-data';

export default function RolesManagementLoading() {
  return (
    <div
      className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Загрузка матрицы ролей и прав доступа...</span>

      {/* ── 1. Canonical Tabbed Header ── */}
      <AdminTabbedHeader
        icon={ShieldCheck}
        title="Роли и матрица прав"
        description="Загрузка ролей сотрудников, гранулярных прав доступа и политик безопасности..."
        tabs={SYSTEM_TABS}
      />

      {/* ── 2. Top Action Bar Skeleton ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border/70 rounded-lg p-4 shadow-xs">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-44 rounded-md" />
          <Skeleton className="h-3 w-72 rounded-md" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg shrink-0" />
      </div>

      {/* ── 3. Roles Table Card Skeleton ── */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
        {/* Table header */}
        <div className="p-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <Skeleton className="h-3.5 w-28 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
          <Skeleton className="h-3.5 w-20 rounded-md" />
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-16 rounded-md" />
        </div>

        {/* Table rows */}
        <div className="divide-y divide-border/40 p-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="py-3 px-3 flex items-center justify-between gap-4">
              <div className="w-[25%] flex items-center gap-2">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
              <div className="w-[30%]">
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
              <div className="w-[15%]">
                <Skeleton className="h-5 w-12 rounded-md" />
              </div>
              <div className="w-[15%] flex gap-2">
                <Skeleton className="h-3 w-12 rounded-md" />
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
              <div className="w-[15%] flex justify-end gap-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-7 w-7 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}