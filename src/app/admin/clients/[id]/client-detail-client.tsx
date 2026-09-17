'use client';

/**
 * ClientDetailClient — Enterprise FinTech CRM Client Workspace
 * For SUPPORT: renders SupportCommandCenter (single-pane, all actions visible at once)
 * For OWNER/ADMIN: renders the full 5-tab layout
 */

import { useState } from 'react';
import {
  Shield,
  Wallet,
  Percent,
  CreditCard,
  Building2,
} from 'lucide-react';
import { UserDTO, PaymentDTO, OrderDTO, LoginLogDTO, ClientLedgerEntryDTO, ClientLedgerSummaryDTO, UserNoteDTO } from './tabs/types';
import { BalanceTab } from './tabs/balance-tab';
import { PaymentsTab } from './tabs/payments-tab';
import { ApiTab } from './tabs/api-tab';
import { NotesTab } from './tabs/notes-tab';
import { SecurityTab } from './tabs/security-tab';
import { SupportCommandCenter } from './support-command-center';

export type { UserDTO, PaymentDTO, OrderDTO, LoginLogDTO, ClientLedgerEntryDTO, ClientLedgerSummaryDTO, UserNoteDTO };

interface Props {
  user: UserDTO;
  loginLogs: LoginLogDTO[];
  payments: PaymentDTO[];
  orders: OrderDTO[];
  ledgerEntries?: ClientLedgerEntryDTO[];
  ledgerSummary?: ClientLedgerSummaryDTO;
  initialNotes?: UserNoteDTO[];
  canSeeFinances: boolean;
  /** Current operator's role (passed from Server Component) */
  operatorRole?: string;
}

export function ClientDetailClient({ 
  user, 
  loginLogs, 
  payments, 
  orders, 
  ledgerEntries = [], 
  ledgerSummary = { totalDepositedRub: 0, totalSpentRub: 0, totalRefundedRub: 0, totalAdjustedRub: 0 }, 
  initialNotes = [],
  canSeeFinances, 
  operatorRole 
}: Props) {
  // Navigation tabs (only for non-SUPPORT operators)
  const [activeTab, setActiveTab] = useState<'balance' | 'api' | 'payments' | 'security' | 'notes'>('balance');

  const isApiEnabled = user.apiConfig?.isApiEnabled ?? Boolean(user.inn);

  // SUPPORT gets a compact single-pane command center
  if (operatorRole === 'SUPPORT') {
    return (
      <SupportCommandCenter
        user={user}
        loginLogs={loginLogs}
        payments={payments}
        orders={orders}
        ledgerEntries={ledgerEntries}
        ledgerSummary={ledgerSummary}
        initialNotes={initialNotes}
        operatorRole={operatorRole}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto scrollbar-hide">
        {[
          { id: 'balance', label: 'Баланс & Начисление', icon: Wallet },
          { id: 'payments', label: `Платежи & Возвраты (${user.paymentsCount ?? payments.length})`, icon: CreditCard },
          { id: 'api', label: 'API & Реквизиты', icon: Building2, badge: isApiEnabled ? 'API' : null },
          { id: 'notes', label: 'Скидки & Заметки', icon: Percent },
          { id: 'security', label: 'Безопасность', icon: Shield },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as unknown as typeof activeTab)}
              className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all select-none cursor-pointer whitespace-nowrap border ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-card/60 backdrop-blur-md text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
              {t.badge && (
                <span className="px-1.5 py-0.2 bg-warning/20 text-warning-text border border-warning/30 rounded text-[9px] font-black uppercase">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'balance' && (
        <BalanceTab
          user={user}
          orders={orders}
          payments={payments}
          canSeeFinances={canSeeFinances}
          onNavigateToPayments={() => setActiveTab('payments')}
          ledgerSummary={ledgerSummary}
        />
      )}
      {activeTab === 'payments' && (
        <PaymentsTab 
          user={user} 
          payments={payments} 
          canSeeFinances={canSeeFinances} 
          ledgerEntries={ledgerEntries}
          ledgerSummary={ledgerSummary}
        />
      )}
      {activeTab === 'api' && <ApiTab user={user} />}
      {activeTab === 'notes' && <NotesTab user={user} canSeeFinances={canSeeFinances} initialNotes={initialNotes} />}
      {activeTab === 'security' && <SecurityTab user={user} loginLogs={loginLogs} />}
    </div>
  );
}
