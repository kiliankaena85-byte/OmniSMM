'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import type { FluxTransaction } from './sub/types';
import { FluxTransactionsHeader } from './sub/FluxTransactionsHeader';
import { FluxTransactionsSummaryBanner } from './sub/FluxTransactionsSummaryBanner';
import { FluxTransactionRow } from './sub/FluxTransactionRow';

export type { FluxTransaction };

export function FluxTransactionsView({
  initialEntries = [],
  currentBalanceRub = 0,
}: {
  initialEntries: FluxTransaction[];
  userEmail: string;
  currentBalanceRub?: number;
}) {
  const [filterType, setFilterType] = useState<'ALL' | 'DEPOSIT' | 'ORDER' | 'REFUND'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('ID скопирован');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const summary = useMemo(() => {
    let totalDeposited = 0;
    let totalSpentGross = 0;
    let totalRefunded = 0;
    let depositCount = 0;
    let orderCount = 0;
    let refundCount = 0;

    initialEntries.forEach((entry) => {
      if (entry.status !== 'APPROVED' && entry.status !== 'SUCCESS') return;
      if (entry.amountRub > 0) {
        if (entry.transactionType === 'REFUND' || entry.reason.toLowerCase().includes('возврат')) {
          totalRefunded += entry.amountRub;
          refundCount++;
        } else {
          totalDeposited += entry.amountRub;
          depositCount++;
        }
      } else {
        totalSpentGross += Math.abs(entry.amountRub);
        orderCount++;
      }
    });

    const totalSpentNet = Math.max(0, totalSpentGross - totalRefunded);
    return { totalDeposited, totalSpentGross, totalRefunded, totalSpentNet, depositCount, orderCount, refundCount };
  }, [initialEntries]);

  const filteredEntries = useMemo(() => {
    return initialEntries.filter((item) => {
      const isRefund = item.transactionType === 'REFUND' || item.reason.toLowerCase().includes('возврат');
      const isDeposit = item.amountRub > 0 && !isRefund;
      const isOrder = item.amountRub < 0;

      if (filterType === 'DEPOSIT' && !isDeposit) return false;
      if (filterType === 'ORDER' && !isOrder) return false;
      if (filterType === 'REFUND' && !isRefund) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesReason = item.reason.toLowerCase().includes(query);
        const matchesId = item.id.toLowerCase().includes(query);
        const matchesOrder = item.orderNumericId?.toString().includes(query) ?? false;
        const matchesKey = item.idempotencyKey?.toLowerCase().includes(query) ?? false;
        if (!matchesReason && !matchesId && !matchesKey && !matchesOrder) return false;
      }

      return true;
    });
  }, [initialEntries, filterType, searchQuery]);

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString('ru-RU', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-foreground font-sans print:text-black">
      <FluxTransactionsHeader onPrint={handlePrint} />

      <FluxTransactionsSummaryBanner summary={summary} currentBalanceRub={currentBalanceRub} />

      {/* Controls: Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
        <div className="flex p-1 bg-card/70 backdrop-blur-xl border border-border/50 rounded-2xl gap-1 overflow-x-auto">
          {[
            { key: 'ALL', label: `Все операции (${initialEntries.length})` },
            { key: 'DEPOSIT', label: `Пополнения (${summary.depositCount})` },
            { key: 'ORDER', label: `Списания (${summary.orderCount})` },
            { key: 'REFUND', label: `Возвраты (${summary.refundCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterType(tab.key as typeof filterType)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                filterType === tab.key ? 'bg-foreground text-background shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Поиск по описанию, номеру заказа (#10429) или ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-2xl bg-card/60 backdrop-blur-xl border border-border/40 text-sm font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
          />
        </div>
      </div>

      {/* Transactions List */}
      {filteredEntries.length === 0 ? (
        <div className="p-12 text-center rounded-[2.5rem] bg-card/50 backdrop-blur-xl border border-border/30 space-y-4">
          <div className="text-4xl">💳</div>
          <h3 className="text-base font-black text-foreground">Операций не найдено</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto font-medium">
            {searchQuery 
              ? 'По вашему запросу нет операций. Проверьте правильность введенного номера заказа или текста.'
              : 'В этом разделе фиксируются все ваши пополнения счета, оплаты заказов и автоматические возвраты.'}
          </p>
          {!searchQuery && (
            <Link
              href="/dashboard/add-funds"
              className="inline-flex h-10 px-5 items-center text-xs font-bold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all shadow-sm"
            >
              Пополнить баланс
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((tx) => (
            <FluxTransactionRow
              key={tx.id}
              tx={tx}
              copiedId={copiedId}
              onCopy={handleCopy}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
