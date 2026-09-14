import React from 'react';
import { FileText } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function AdminPagesLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10" role="status" aria-live="polite">
      <AdminTabbedHeader
        icon={FileText}
        title="CMS Страницы"
        description="Управление текстовым контентом публичного сайта (оферта, контакты, правила)."
        tabs={SYSTEM_TABS}
        onboardingKey="pages"
        onboarding={ONBOARDING_CONFIGS.pages}
      />

      {/* Table Container Skeleton */}
      <div className="rounded-lg border border-border/70 shadow-xs bg-card overflow-hidden">
        <div className="p-4 border-b border-border/60 flex items-center justify-between">
          <div className="h-4 w-32 bg-muted/60 rounded animate-pulse" />
          <div className="h-4 w-20 bg-muted/40 rounded animate-pulse" />
        </div>

        <div className="divide-y divide-border/60">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 min-w-0">
                <div className="h-4 w-48 bg-muted/60 rounded animate-pulse" />
                <div className="h-3 w-32 bg-muted/40 rounded animate-pulse" />
              </div>
              <div className="h-6 w-24 bg-muted/40 rounded-full animate-pulse" />
              <div className="h-4 w-32 bg-muted/40 rounded animate-pulse hidden sm:block" />
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
                <div className="h-4 w-20 bg-muted/50 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
