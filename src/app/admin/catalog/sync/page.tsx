import { getGapAnalysisAction } from '@/actions/admin/catalog/sync';
import { SyncTable } from './sync-table';
import { ArrowLeftRight } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';

export const dynamic = 'force-dynamic';

export default async function CatalogSyncPage() {
  const result = await getGapAnalysisAction();
  const rows = result.rows ?? [];
  const stats = result.stats ?? { smmplan: 0, flux: 0, gap: 0, both: 0 };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={ArrowLeftRight}
        title="Синхронизация SMMplan & SMMflux"
        description="Анализ расхождений (gap analysis), копирование услуг и выравнивание цен между брендами."
        tabs={CATALOG_TABS}
        onboardingKey="catalog"
        onboarding={ONBOARDING_CONFIGS.catalog}
      />
      <SyncTable rows={rows} stats={stats} />
    </div>
  );
}

