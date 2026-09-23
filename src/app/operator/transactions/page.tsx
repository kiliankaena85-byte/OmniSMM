import * as React from 'react';
import { enforceOperatorAccess } from '@/lib/operator/rbac';
import { getTransactionsListAction } from '@/actions/operator/transactions/get-transactions-list.action';
import { TransactionsFilter } from './components/transactions-filter';
import { TransactionsTable } from './components/transactions-table';
import { CreditCard, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{
    search?: string;
    period?: string;
    status?: string;
    cursor?: string;
    userId?: string;
  }>;
};

export default async function OperatorTransactionsPage({ searchParams }: Props) {
  // Enforce operator staff context
  await enforceOperatorAccess();

  const params = await searchParams;
  const search = params.search || '';
  const period = params.period || 'month';
  const status = params.status || 'ALL';
  const cursor = params.cursor || undefined;
  const userId = params.userId || '';

  // Query ledger entries list via guarded server action
  const result = await getTransactionsListAction({
    search: search || undefined,
    period: period as 'today' | 'week' | 'month' | 'all',
    status: status as 'ALL' | 'APPROVED' | 'QUARANTINE' | 'REJECTED',
    cursor,
    pageSize: 50,
    userId: userId || undefined,
  });

  if ('error' in result) {
    return (
      <div className="p-10 text-center bg-card border border-border/40 rounded-3xl shadow-sm ring-1 ring-border/5">
        <div className="inline-flex p-4 bg-destructive/15 text-destructive rounded-2xl mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Ошибка загрузки транзакций</h1>
        <p className="text-muted-foreground mt-2 font-medium">{result.error}</p>
      </div>
    );
  }

  const { items: transactions, nextCursor, hasMore, totals } = result;

  // Preserves URL parameters during pagination steps
  const buildQueryString = (extraParams: Record<string, string> = {}) => {
    const qParams = new URLSearchParams();

    Object.entries(params).forEach(([key, val]) => {
      if (val && key !== 'cursor') {
        qParams.set(key, String(val));
      }
    });

    Object.entries(extraParams).forEach(([key, val]) => {
      if (val) {
        qParams.set(key, val);
      } else {
        qParams.delete(key);
      }
    });

    const str = qParams.toString();
    return str ? `?${str}` : '';
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500 ease-out pb-10">
      {/* Header section with Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card/40 backdrop-blur-md border border-border/40 p-6 rounded-2xl ring-1 ring-border/5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground font-sans">
              История транзакций
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-muted-foreground font-medium text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
                Пополнения: <span className="text-success font-bold font-mono">{(totals.approved / 100).toLocaleString('ru-RU')} ₽</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-warning rounded-full"></span>
                Карантин: <span className="text-warning-foreground font-bold font-mono">{(totals.quarantine / 100).toLocaleString('ru-RU')} ₽</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-destructive rounded-full"></span>
                Возвраты/Списания: <span className="text-foreground font-bold font-mono">{(totals.refunds / 100).toLocaleString('ru-RU')} ₽</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Form */}
      <TransactionsFilter />

      {/* Transactions List Table Container */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 rounded-2xl shadow-sm ring-1 ring-border/5 overflow-hidden flex flex-col">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground">
              Записи Ledger-реестра
              <span className="text-muted-foreground ml-1.5 font-medium text-xs">
                ({transactions.length}
                {hasMore ? '+' : ''})
              </span>
            </h3>
          </div>

          <TransactionsTable data={transactions} />

          {/* Simple Pagination Footer */}
          {(cursor || hasMore) && (
            <div className="flex justify-between items-center mt-6 pt-4 border-t border-border/40">
              {cursor ? (
                <Link
                  href={`/operator/transactions${buildQueryString({ cursor: '' })}`}
                  className="px-4 py-2 text-xs font-bold text-foreground bg-background border border-border rounded-xl hover:bg-muted/50 transition-all active:scale-95 shadow-sm"
                >
                  ← В начало
                </Link>
              ) : (
                <div />
              )}
              {hasMore && nextCursor && (
                <Link
                  href={`/operator/transactions${buildQueryString({ cursor: nextCursor })}`}
                  className="px-4 py-2 text-xs font-bold text-primary-foreground bg-primary rounded-xl hover:bg-primary/95 transition-all active:scale-95 shadow-sm"
                >
                  Следующая →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
