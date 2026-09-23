import { getSmartCampaigns, getServiceConfigs, getSmartGlobalStatus } from '@/actions/admin/smart';
import { Cpu } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { OPERATIONS_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { SmartDripClient } from './smart-client';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const dynamic = 'force-dynamic';

export default async function SmartDripAdminPage() {
  await enforceSectionAccess('orders');
  const [campaignsResult, servicesResult, globalStatusResult] = await Promise.all([
    getSmartCampaigns(1, 100),
    getServiceConfigs(),
    getSmartGlobalStatus(),
  ]);

  const campaigns = campaignsResult.success ? campaignsResult.data.campaigns : [];
  const services = servicesResult.success ? servicesResult.data : [];
  const globalDisabled = globalStatusResult.success ? globalStatusResult.disabled : false;

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={Cpu}
        title="Умный Dripfeed 2.0"
        description="Управление постепенной раздачей, чанковыми распределениями и контролем качества"
        tabs={OPERATIONS_TABS}
        onboardingKey="smart"
        onboarding={ONBOARDING_CONFIGS.smart}
      />

      <SmartDripClient
        initialCampaigns={campaigns}
                initialServices={services}
        initialGlobalDisabled={globalDisabled}
      />
    </div>
  );
}
