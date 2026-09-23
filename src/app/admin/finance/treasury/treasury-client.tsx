'use client';

import React, { useState, useTransition } from 'react';
import { TreasurySimulationOutput } from '@/services/ai/harnesses/customer-liability-treasury.harness';
import { getTreasuryFinancialHealthAction } from '@/actions/admin/finance/treasury';
import { syncAlfaBankBalanceAction } from '@/actions/admin/finance/bank-sync';
import { AlfaBankAccountBalance } from '@/services/financial/bank-integrations/alfa-bank.service';
import { AlfaBankStatusCard } from '@/components/admin/finance/treasury/alfa-bank-status-card';
import { SafeOwnerDrawHero } from '@/components/admin/finance/treasury/safe-owner-draw-hero';
import { LiquidityWaterfallBar } from '@/components/admin/finance/treasury/liquidity-waterfall-bar';
import { TreasuryMetricGrid } from '@/components/admin/finance/treasury/treasury-metric-grid';
import { ReconciliationController } from '@/components/admin/finance/treasury/reconciliation-controller';
import { AccountingCausalityFeed } from '@/components/admin/finance/treasury/accounting-causality-feed';
import { toast } from 'sonner';

interface Props {
  initialReport: TreasurySimulationOutput;
  initialBankAccount?: AlfaBankAccountBalance;
  initialBankSource?: 'ALFA_BANK_API' | 'MANUAL_ENTRY';
  tenantId: string;
}

export function TreasuryClient({
  initialReport,
  initialBankAccount,
  initialBankSource = 'ALFA_BANK_API',
  tenantId,
}: Props) {
  const [report, setReport] = useState<TreasurySimulationOutput>(initialReport);
  const [bankAccount, setBankAccount] = useState<AlfaBankAccountBalance | undefined>(initialBankAccount);
  const [bankSource, setBankSource] = useState<'ALFA_BANK_API' | 'MANUAL_ENTRY'>(initialBankSource);
  const [bankRub, setBankRub] = useState<number>(initialBankAccount?.authorizedBalanceRub ?? 250000);
  const [gatewayRub, setGatewayRub] = useState<number>(150000);
  const [isPending, startTransition] = useTransition();
  const [isSyncingBank, startBankSync] = useTransition();

  const handleRecalculate = () => {
    startTransition(async () => {
      const res = await getTreasuryFinancialHealthAction(tenantId, bankRub, gatewayRub);
      if (res.success && res.data) {
        setReport(res.data);
        setBankAccount(res.bankAccount);
        if (res.bankSource) setBankSource(res.bankSource);
        if (res.error) {
          toast.warning(`Казначейство пересчитано с резервным балансом: ${res.error}`);
        } else {
          toast.success('Казначейский баланс пересчитан');
        }
      } else {
        toast.error(res.error || 'Ошибка расчета');
      }
    });
  };

  const handleSyncAlfaBank = () => {
    startBankSync(async () => {
      const res = await syncAlfaBankBalanceAction(tenantId, true);
      if (res.success && res.account) {
        setBankAccount(res.account);
        setBankRub(res.account.authorizedBalanceRub);
        setBankSource('ALFA_BANK_API');

        // Auto-recalculate with fresh bank balance
        const healthRes = await getTreasuryFinancialHealthAction(
          tenantId,
          res.account.authorizedBalanceRub,
          gatewayRub
        );
        if (healthRes.success && healthRes.data) {
          setReport(healthRes.data);
        }
        toast.success(
          `Баланс Альфа-Банка синхронизирован: ${res.account.authorizedBalanceRub.toLocaleString('ru-RU')} ₽`
        );
      } else {
        toast.error(res.error || 'Не удалось получить данные из Альфа-Банка');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. Alfa-Bank Live Status HUD Card */}
      <AlfaBankStatusCard
        bankAccount={bankAccount}
        bankRub={bankRub}
        isSyncingBank={isSyncingBank}
        onSync={handleSyncAlfaBank}
      />

      {/* 2. Top Banner — Safe Owner Draw Capacity */}
      <SafeOwnerDrawHero report={report} />

      {/* 3. Multi-Segment Liquidity Waterfall Bar */}
      <LiquidityWaterfallBar report={report} />

      {/* 4. Metric Cards Grid */}
      <TreasuryMetricGrid report={report} />

      {/* 5. Live Simulation Controller & Accounting Causality Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ReconciliationController
          bankRub={bankRub}
          gatewayRub={gatewayRub}
          bankSource={bankSource}
          isPending={isPending}
          onBankChange={(val) => {
            setBankRub(val);
            setBankSource('MANUAL_ENTRY');
          }}
          onGatewayChange={(val) => setGatewayRub(val)}
          onRecalculate={handleRecalculate}
        />

        <div className="lg:col-span-2">
          <AccountingCausalityFeed
            causalityBreakdown={report.accountingCausalityBreakdown}
            recommendations={report.recommendations}
          />
        </div>
      </div>
    </div>
  );
}
