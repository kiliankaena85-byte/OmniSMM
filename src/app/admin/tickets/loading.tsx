import { MessageSquare } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { OPERATIONS_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function TicketsLoading() {
  return (
    <div className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true">
      <AdminTabbedHeader
        icon={MessageSquare}
        title="Тикеты поддержки"
        description="Загрузка обращений клиентов..."
        tabs={OPERATIONS_TABS}
        onboardingKey="tickets"
        onboarding={ONBOARDING_CONFIGS.tickets}
      />

      {/* Tickets Search & Filter Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-64 bg-muted/40 animate-pulse rounded-lg" />
        <div className="h-9 w-36 bg-muted/40 animate-pulse rounded-lg" />
        <div className="h-9 w-32 bg-muted/40 animate-pulse rounded-lg" />
      </div>

      {/* Tickets List Skeleton */}
      <div className="bg-card rounded-lg border border-border/70 overflow-hidden shadow-xs divide-y divide-border/40">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2">
                <div className="h-4 w-12 bg-muted/40 animate-pulse rounded" />
                <div className="h-4 w-48 bg-muted/40 animate-pulse rounded" />
              </div>
              <div className="h-3 w-64 bg-muted/30 animate-pulse rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-6 w-20 bg-muted/40 animate-pulse rounded-full" />
              <div className="h-3 w-16 bg-muted/30 animate-pulse rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
