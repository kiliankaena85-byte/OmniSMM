import { accountingService } from '@/services/financial/accounting.service';
import { escrowService } from '@/services/admin/escrow.service';
import { getLedgerAction } from '@/actions/admin/finance/ledger';
import { getPaymentsAction } from '@/actions/admin/finance/payments';
import { getReconciliationSummaryAction } from '@/actions/admin/finance/reconciliation';
import { AdminTabbedHeader } from '@/components/admin/tabbed-header';
import { FINANCE_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { enforceSectionAccess } from '@/lib/server/rbac';
import { FinanceClient } from './finance-client';
import { Wallet, AlertTriangle } from 'lucide-react';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ period?: string; tenant?: string }>;
};

export default async function FinanceDashboard({ searchParams }: Props) {
  // ADM-03 follow-up: the finance layout is now a coarse gate (finance OR balance-*),
  // so the main dashboard enforces 'finance' on its own.
  await enforceSectionAccess('finance');
  const session = await verifySession();
  const user = session ? await db.user.findUnique({ 
    where: { id: session.userId },
    include: { staffRole: { include: { permissions: true } } }
  }) : null;

  const isOwner = user?.role === 'OWNER';
  const isSupport = user?.role === 'SUPPORT';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const canSeeFinances = isOwner || !isSupport;

  const params = await searchParams;
  const period = (params.period as 'today' | 'week' | 'month' | 'all') ?? 'month';
  const selectedTenant = params.tenant;
  const activeTenantId = resolveAdminTenantContext(user, selectedTenant);

  const now = new Date();
  let periodStart: Date | undefined;
  if (period === 'today') { periodStart = new Date(now.setHours(0,0,0,0)); }
  else if (period === 'week') { periodStart = new Date(Date.now() - 7*86400000); }
  else if (period === 'month') { periodStart = new Date(Date.now() - 30*86400000); }

  const [metrics, settings, quarantineList, ledgerResult, paymentsResult, reconciliationSummaryResult] = await Promise.all([
    accountingService.getMetrics(periodStart, periodStart ? new Date() : undefined, activeTenantId),
    accountingService.getSettings(activeTenantId),
    escrowService.getQuarantineEntries(),
    getLedgerAction({ period, pageSize: 50, tenantId: activeTenantId }),
    getPaymentsAction({ period, pageSize: 50, tenantId: activeTenantId }),
    getReconciliationSummaryAction(activeTenantId),
  ]);

  if ('error' in ledgerResult) {
    return (
      <div className="p-10 text-center bg-background rounded-3xl border border-border">
        <div className="inline-flex p-4 bg-destructive/20 text-destructive rounded-2xl mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-foreground">Ошибка загрузки данных</h1>
        <p className="text-muted-foreground mt-2 font-medium">{ledgerResult.error}</p>
      </div>
    );
  }

  if ('error' in paymentsResult) {
    return (
      <div className="p-10 text-center bg-background rounded-3xl border border-border">
        <div className="inline-flex p-4 bg-destructive/20 text-destructive rounded-2xl mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-foreground">Ошибка загрузки данных</h1>
        <p className="text-muted-foreground mt-2 font-medium">{paymentsResult.error}</p>
      </div>
    );
  }

  const initialLedger = ledgerResult;
  const initialPayments = paymentsResult;

  return (
    <div className="space-y-6 pb-10 w-full animate-in fade-in duration-300">
      <AdminTabbedHeader
        icon={Wallet}
        title="Финансовый учёт & Касса"
        description="Метрики эффективности, P&L, реестр платежей, проводки и сверка счетов"
        tabs={FINANCE_TABS}
        onboardingKey="finance"
        onboarding={ONBOARDING_CONFIGS.finance}
      />

      {/* ── 4 Clean Modular Tabs: Overview (P&L), Payments, Ledger, Reconciliation ── */}
      <FinanceClient 
        initialLedger={initialLedger} 
        initialPayments={initialPayments} 
        initialPeriod={period} 
        tenantId={activeTenantId} 
        initialReconciliationSummary={'error' in reconciliationSummaryResult ? undefined : reconciliationSummaryResult}
        metrics={metrics}
        settings={settings}
        quarantineList={quarantineList}
        currentUserRole={user?.role || 'ADMIN'}
      />
    </div>
  );
}
