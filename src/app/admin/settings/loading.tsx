import { Settings } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export default function SettingsLoading() {
  return (
    <div className="space-y-6 w-full min-w-0 animate-in fade-in duration-300 ease-out sm:px-2 md:px-0 min-h-full pb-10" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Загрузка параметров платформы и конфигурации...</span>
      <AdminTabbedHeader
        icon={Settings}
        title="Настройки системы"
        description="Загрузка параметров платформы и конфигурации..."
        tabs={SYSTEM_TABS}
        onboardingKey="settings"
        onboarding={ONBOARDING_CONFIGS.settings}
      />

      {/* Settings Tab Content Skeleton */}
      <div className="bg-card rounded-lg border border-border/70 p-6 shadow-xs space-y-6">
        <div className="space-y-2 border-b border-border/40 pb-4">
          <div className="h-6 w-48 bg-muted/40 animate-pulse rounded" />
          <div className="h-3.5 w-80 bg-muted/30 animate-pulse rounded" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-32 bg-muted/40 animate-pulse rounded" />
              <div className="h-10 w-full bg-muted/30 animate-pulse rounded-lg border border-border/30" />
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-border/40 flex justify-end">
          <div className="h-9 w-32 bg-muted/40 animate-pulse rounded-lg" />
        </div>
      </div>
    </div>
  );
}
