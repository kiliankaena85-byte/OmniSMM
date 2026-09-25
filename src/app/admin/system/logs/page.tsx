import { enforceSectionAccess } from '@/lib/server/rbac';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { getSystemLogs } from '@/actions/admin/system-logs';
import { SystemLogsClient } from './components/system-logs-client';
import { ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminSystemLogsPage() {
  await enforceSectionAccess('settings');

  const initialRes = await getSystemLogs({ category: 'security', page: 1, pageSize: 25 });

  const initialData = initialRes.success
    ? initialRes.data
    : {
        category: 'security' as const,
        items: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        stats: {
          securityCount: 0,
          failedLoginsCount: 0,
          auditCount: 0,
          telegramErrorsCount: 0,
        },
      };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out min-h-full pb-10">
      <AdminTabbedHeader
        icon={ShieldAlert}
        title="Системные логи и аудит безопасности"
        description="Централизованный журнал событий безопасности, попыток авторизации, аудита персонала и сбоев интеграций без использования сторонних сервисов."
        tabs={SYSTEM_TABS}
        onboardingKey="logs"
        onboarding={ONBOARDING_CONFIGS.logs}
      />
      <SystemLogsClient initialData={initialData} />
    </div>
  );
}
