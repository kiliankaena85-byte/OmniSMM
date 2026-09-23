import React from 'react';
import { BookOpen } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function AdminKnowledgeLoading() {
  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10" role="status" aria-live="polite">
      <AdminTabbedHeader
        icon={BookOpen}
        title="База знаний & Блог"
        description="Публикуйте обучающие руководства, статьи по продвижению и новости платформы SMMplan."
        tabs={SYSTEM_TABS}
        onboardingKey="knowledge"
        onboarding={ONBOARDING_CONFIGS.knowledge}
      />

      {/* Metrics Widgets block */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card border border-border/70 rounded-lg p-5 shadow-xs relative overflow-hidden space-y-3">
            <div className="flex justify-between items-start">
              <div className="h-3 w-24 bg-muted/40 rounded animate-pulse" />
              <div className="h-4 w-16 bg-muted/40 rounded-full animate-pulse" />
            </div>
            <div className="h-7 w-20 bg-muted/60 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Main Table section */}
      <div className="bg-card border border-border/70 rounded-lg shadow-xs overflow-hidden">
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
              <div className="h-6 w-20 bg-muted/40 rounded-lg animate-pulse" />
              <div className="h-6 w-24 bg-muted/40 rounded-lg animate-pulse" />
              <div className="h-4 w-12 bg-muted/50 rounded animate-pulse text-center" />
              <div className="h-4 w-28 bg-muted/40 rounded animate-pulse hidden sm:block" />
              <div className="flex items-center gap-2 shrink-0">
                <div className="h-8 w-20 bg-muted/50 rounded-lg animate-pulse" />
                <div className="h-8 w-24 bg-muted/50 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
