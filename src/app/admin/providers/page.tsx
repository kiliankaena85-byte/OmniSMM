import { adminProviderService } from '@/services/admin/provider.service';
import Link from 'next/link';
import { Plug } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { CATALOG_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { ProvidersTable } from './client-table';
import { LiquidityDashboard } from './components/liquidity-dashboard';
import { enforceSectionAccess } from '@/lib/server/rbac';

export const dynamic = 'force-dynamic';

export default async function ProvidersAdminPage() {
  // AUD-09 (4.1): provider management requires the 'providers' section
  await enforceSectionAccess('providers');

  // Fast database query (< 10ms) without blocking on external provider network roundtrips
  const providers = await adminProviderService.listProviders();

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out sm:px-2 md:px-0 min-h-full pb-10">
      <AdminTabbedHeader
        icon={Plug}
        title="Провайдеры API"
        description="Управление поставщиками услуг (панелями SMM)"
        action={(
          <div className="flex gap-2.5">
            <Link href="/admin/providers/import" className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold text-foreground bg-card/60 backdrop-blur-xs border border-border/70 shadow-xs rounded-lg hover:bg-muted/80 hover:text-primary transition-all duration-200 active:scale-95">
              ⏬ Импорт Услуг
            </Link>
            <Link href="/admin/providers/new" className="inline-flex items-center justify-center px-3.5 py-2 text-xs font-bold text-primary-foreground bg-primary shadow-xs rounded-lg hover:bg-primary/90 transition-all duration-200 active:scale-95">
              + Подключить Панель
            </Link>
          </div>
        )}
        tabs={CATALOG_TABS}
        onboardingKey="providers"
        onboarding={ONBOARDING_CONFIGS.providers}
      />

      {/* Глобальная ликвидность поверх таблицы (асинхронная загрузка с кэшированием) */}
      <LiquidityDashboard />

      <ProvidersTable providers={providers} />
    </div>
  );
}
