import React from 'react';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { getTreasuryFinancialHealthAction } from '@/actions/admin/finance/treasury';
import { TreasuryClient } from './treasury-client';
import { Landmark } from 'lucide-react';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { FINANCE_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Казначейство & Безопасный Вывод — OmniSMM 1.0',
  description: 'Анализ обязательств перед клиентами, налоговых резервов и расчет безопасного вывода дивидендов',
};

interface Props {
  searchParams: Promise<{ tenant?: string }>;
}

export default async function AdminTreasuryPage({ searchParams }: Props) {
  await enforceSectionAccess('finance');
  const session = await verifySession();
  const user = session ? await db.user.findUnique({ 
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  }) : null;

  const cookieStore = await cookies();
  const cookieTenant = cookieStore.get('x_admin_tenant')?.value;
  const params = await searchParams;
  const activeTenantId = resolveAdminTenantContext(user, params.tenant, cookieTenant);

  const reportRes = await getTreasuryFinancialHealthAction(activeTenantId);

  const initialReport = reportRes.data || {
    totalLiquidAssetsRub: 400000,
    totalCustomerEscrowLiabilityRub: 120000,
    customerRealDepositsRub: 100000,
    customerBonusCreditsRub: 15000,
    estimatedQuarterlyTaxDueRub: 24000,
    gatewayRollingReserveRub: 7500,
    minimumWorkingCapitalBufferRub: 100000,
    safeOwnerDrawCapacityRub: 148500,
    liquidityHealthStatus: 'SOLVENT_GREEN' as const,
    accountingCausalityBreakdown: ['Инициализация отчета казначейства...'],
    recommendations: ['Система готова к расчету.'],
  };

  return (
    <div className="space-y-6 pb-10 w-full max-w-full animate-in fade-in duration-300">
      <AdminTabbedHeader
        icon={Landmark}
        title="Казначейство & Банковский счет"
        description="Анализ обязательств перед клиентами, налоговых резервов и расчет безопасного вывода прибыли"
        tabs={FINANCE_TABS}
        onboardingKey="finance"
        onboarding={ONBOARDING_CONFIGS.finance}
      />

      <TreasuryClient
        initialReport={initialReport}
        initialBankAccount={reportRes.bankAccount}
        initialBankSource={reportRes.bankSource}
        tenantId={activeTenantId}
      />
    </div>
  );
}
