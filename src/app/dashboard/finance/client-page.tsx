'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Wallet, Receipt, CreditCard, ShieldCheck } from 'lucide-react';
import AddFundsForm from '../add-funds/client-page';
import { TransactionsClient } from '@/components/dashboard/transactions/TransactionsClient';
import { FluxTransactionsView } from '@/components/dashboard/flux/FluxTransactionsView';

interface TransactionItem {
  id: string;
  amountCents: number;
  amountRub: number;
  runningBalanceCents?: number | null;
  runningBalanceRub?: number | null;
  reason: string;
  status: string;
  idempotencyKey: string | null;
  transactionType: string;
  orderNumericId: number | null;
  createdAt: string;
}

interface FinanceClientProps {
  userEmail: string;
  currentBalanceRub: number;
  initialEntries: TransactionItem[];
  tenantId?: string;
}

export default function FinanceClientPage({
  userEmail,
  currentBalanceRub,
  initialEntries,
  tenantId,
}: FinanceClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'history' ? 'history' : 'deposit';

  const handleTabChange = (tab: 'deposit' | 'history') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/dashboard/finance?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Balance Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Финансы и баланс
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Мгновенное пополнение, прозрачная бухгалтерия и полный журнал операций
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card border border-border/80 rounded-2xl px-4 py-2.5 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Текущий баланс
            </div>
            <div className="text-lg font-black text-foreground font-mono">
              {currentBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </div>
          </div>
        </div>
      </div>

      {/* Top Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-1">
        <button
          type="button"
          onClick={() => handleTabChange('deposit')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'deposit'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Пополнить баланс</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('history')}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Журнал операций ({initialEntries.length})</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'deposit' && (
        <div className="pt-2 animate-in fade-in duration-300">
          <AddFundsForm />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="pt-2 animate-in fade-in duration-300">
          {tenantId === 'flux' ? (
            <FluxTransactionsView
              initialEntries={initialEntries}
              userEmail={userEmail}
              currentBalanceRub={currentBalanceRub}
            />
          ) : (
            <TransactionsClient
              initialEntries={initialEntries}
              userEmail={userEmail}
            />
          )}
        </div>
      )}
    </div>
  );
}
