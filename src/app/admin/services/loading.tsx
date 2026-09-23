'use client';
import { Skeleton } from "@heroui/react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { List } from "lucide-react";

export default function ServicesLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0">
      <AdminPageHeader
        icon={List}
        title="Услуги"
        description="Загрузка каталога услуг..."
      />

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border/50">
           <Skeleton className="h-10 w-full max-w-md" />
        </div>
        <div className="p-0">
           <div className="border-b border-border/50 px-6 py-4 flex gap-4">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
           </div>
           {[...Array(10)].map((_, i) => (
             <div key={i} className="border-b border-border/50 px-6 py-5 flex gap-4">
                <Skeleton className="h-6 w-12" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-8 w-16 rounded-lg" />
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
