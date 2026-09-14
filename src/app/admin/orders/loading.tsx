'use client';
import { Skeleton } from "@heroui/react";
import { AdminTabbedHeader } from "@/components/admin/tabbed-header";
import { Package } from "lucide-react";

export default function OrdersLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка списка заказов...</span>
      <AdminTabbedHeader
        icon={Package}
        title="Заказы"
        description="Загрузка списка заказов..."
      />

      {/* Filter and Table Container Skeleton */}
      <div className="bg-card/60 backdrop-blur-md border border-border/70 rounded-lg shadow-sm overflow-hidden flex flex-col">
        <div className="p-3 sm:p-4 border-b border-border/50 bg-muted/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="col-span-1 lg:col-span-2 space-y-1">
              <Skeleton className="h-3 w-20 mb-2 rounded-md" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="col-span-1 space-y-1">
              <Skeleton className="h-3 w-20 mb-2 rounded-md" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="col-span-1 lg:col-span-2 space-y-1">
              <Skeleton className="h-3 w-20 mb-2 rounded-md" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="col-span-1 space-y-1">
              <Skeleton className="h-3 w-20 mb-2 rounded-md" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="col-span-1 lg:col-span-2 space-y-1">
              <Skeleton className="h-3 w-20 mb-2 rounded-md" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 pt-4">
          <div className="flex justify-between items-center pb-3 border-b border-border/40">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-7 w-28 rounded-md" />
          </div>
          <div className="divide-y divide-border/40">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-[180px]">
                  <Skeleton className="h-4 w-12 rounded-md" />
                  <Skeleton className="h-4 w-28 rounded-md" />
                </div>
                <Skeleton className="h-4 w-full max-w-sm rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-6 w-24 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
