import { getFeatureFlags } from '@/actions/admin/feature-flags';
import { FeatureFlagsClient } from './feature-flags-client';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { ToggleLeft } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export const dynamic = 'force-dynamic';

export default async function FeatureFlagsPage() {
  await enforceSectionAccess('settings');
  const result = await getFeatureFlags();
  const flags = result.success ? result.data : [];

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10">
      <AdminTabbedHeader
        icon={ToggleLeft}
        title="Управление фичами (Feature Flags)"
        description="Включение и отключение экспериментального или сервисного функционала без изменения кода."
        tabs={SYSTEM_TABS}
        onboardingKey="features"
        onboarding={ONBOARDING_CONFIGS.features}
      />
      <FeatureFlagsClient initialFlags={flags} />
    </div>
  );
}
