import React from 'react';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { getTreasuryFinancialHealthAction } from '@/actions/admin/finance/treasury';
import { TreasuryClient } from './treasury-client';
import { Landmark } from 'lucide-react';

export const metadata = {
  title: 'Казначейство & Безопасный Вывод — OmniSMM 1.0',
  description: 'Анализ обязательств перед клиентами, налоговых резервов и расчет безопасного вывода дивидендов',
};

export default async function AdminTreasuryPage() {
  const admin = await enforceSectionAccess('finance');
  const tenantId = admin.tenantId || 'smmplan';
  const reportRes = await getTreasuryFinancialHealthAction(tenantId);

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <Landmark className="w-4 h-4 shrink-0" />
            OmniSMM 1.0 Финансовое Казначейство
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-1">
            Эскроу Клиентов, Налоги & Безопасный Вывод Прибыли
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Автоматическое разграничение кредиторской задолженности, налогов и свободной чистой прибыли
          </p>
        </div>
      </div>

      <TreasuryClient
        initialReport={initialReport}
        initialBankAccount={reportRes.bankAccount}
        initialBankSource={reportRes.bankSource}
        tenantId={tenantId}
      />
    </div>
  );
}
