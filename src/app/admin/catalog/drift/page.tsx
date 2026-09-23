import { getDriftCandidatesAction } from '@/actions/admin/catalog/price-drift';
import { DriftClient } from './drift-client';
import { TrendingUp } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export const metadata = {
  title: 'Монитор дрейфа цен | OmniSMM 1.0',
};

export default async function DriftPage() {
  const result = await getDriftCandidatesAction();
  
  if (!result.success) {
    return (
      <div className="p-6">
        <div className="text-danger">Ошибка загрузки: {result.error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={TrendingUp}
        title="Монитор дрейфа цен"
        description="Мониторинг постепенного повышения цен провайдеров (дрейф от 5% до 20% за 30 дней)"
        tabs={CATALOG_TABS}
        onboardingKey="quarantine"
        onboarding={ONBOARDING_CONFIGS.quarantine}
      />

      <DriftClient initialData={result.data || []} />
    </div>
  );
}
