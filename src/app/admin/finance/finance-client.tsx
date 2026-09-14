'use client';

/**
 * FinanceClient v4 — Clean FinTech Operating Hub for SMMpanel 1.0
 * Decomposed into dedicated tab modules (each <= 300 lines)
 *
 * Tabs:
 *   1. Overview — Обзор P&L, 4 KPI, EBITDA, Порог НДС 2026, Настройки OPEX
 *   2. Payments — Реестр платежей кассы (ЮKassa, CryptoBot, Robokassa) + CSV
 *   3. Ledger — История транзакций и бухгалтерских проводок + CSV
 *   4. Reconciliation — Сверка счетов пользователей vs Ledger + Коррекция баланса
 */

import { useState } from 'react';
import { type LedgerPageResult } from '@/actions/admin/finance/ledger';
import { type PaymentsPageResult } from '@/actions/admin/finance/payments';
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from '@/components/ui/tabs';
import { 
  PieChart, 
  Receipt, 
  FileSpreadsheet, 
  Scale 
} from 'lucide-react';
import { ReconciliationTab } from './components/reconciliation-tab';
import type { ReconciliationSummaryDTO } from '@/services/financial/ledger-reconciliation.service';
import { type QuarantineEntry } from './quarantine-list';
import { FinanceOverviewTab, type FinanceMetricsDTO } from './components/finance-overview-tab';
import { FinancePaymentsTab } from './components/finance-payments-tab';
import { FinanceLedgerTab } from './components/finance-ledger-tab';

export type { FinanceMetricsDTO };

export interface FinanceClientProps {
  initialLedger: LedgerPageResult;
  initialPayments: PaymentsPageResult;
  initialPeriod: string;
  tenantId?: string;
  initialReconciliationSummary?: ReconciliationSummaryDTO;
  metrics: FinanceMetricsDTO;
  settings: {
    taxRate: number;
    opexMonthly: number;
  };
  quarantineList: QuarantineEntry[];
}

export function FinanceClient({
  initialLedger,
  initialPayments,
  initialPeriod,
  tenantId,
  initialReconciliationSummary,
  metrics,
  settings,
  quarantineList
}: FinanceClientProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'ledger' | 'reconciliation'>('overview');

  return (
    <div className="space-y-6 w-full">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
        {/* Navigation Tabs Header */}
        <div className="border-b border-border/80 pb-3">
          <TabsList className="bg-muted/40 p-1.5 rounded-lg border border-border/70 gap-1.5 flex flex-wrap sm:inline-flex shadow-xs">
            <TabsTrigger 
              value="overview" 
              className="gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-md data-[state=active]:bg-card data-[state=active]:shadow-xs data-[state=active]:text-primary transition-all duration-200 cursor-pointer"
            >
              <PieChart className="w-4 h-4" />
              <span>1. Обзор & P&L</span>
            </TabsTrigger>

            <TabsTrigger 
              value="payments" 
              className="gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-md data-[state=active]:bg-card data-[state=active]:shadow-xs data-[state=active]:text-primary transition-all duration-200 cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>2. Реестр Платежей</span>
            </TabsTrigger>

            <TabsTrigger 
              value="ledger" 
              className="gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-md data-[state=active]:bg-card data-[state=active]:shadow-xs data-[state=active]:text-primary transition-all duration-200 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>3. Проводки Ledger</span>
            </TabsTrigger>

            <TabsTrigger 
              value="reconciliation" 
              className="gap-2 px-3.5 py-2 text-xs font-bold uppercase tracking-wider rounded-md data-[state=active]:bg-card data-[state=active]:shadow-xs data-[state=active]:text-primary transition-all duration-200 cursor-pointer"
            >
              <Scale className="w-4 h-4" />
              <span>4. Сверка & Балансы</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── TAB 1: OVERVIEW & P&L ── */}
        <TabsContent value="overview" className="mt-6">
          <FinanceOverviewTab 
            metrics={metrics} 
            settings={settings} 
            quarantineList={quarantineList} 
          />
        </TabsContent>

        {/* ── TAB 2: PAYMENTS ── */}
        <TabsContent value="payments" className="mt-6">
          <FinancePaymentsTab 
            initial={initialPayments} 
            period={initialPeriod} 
            tenantId={tenantId} 
          />
        </TabsContent>

        {/* ── TAB 3: LEDGER ── */}
        <TabsContent value="ledger" className="mt-6">
          <FinanceLedgerTab 
            initial={initialLedger} 
            period={initialPeriod} 
            tenantId={tenantId} 
          />
        </TabsContent>

        {/* ── TAB 4: RECONCILIATION ── */}
        <TabsContent value="reconciliation" className="mt-6">
          <ReconciliationTab 
            tenantId={tenantId} 
            initialSummary={initialReconciliationSummary} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
