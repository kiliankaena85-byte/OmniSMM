'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  RotateCcw, 
  Search, 
  Wallet, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TrendingDown, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TrendingUp, 
  Receipt, 
  Copy, 
  Check, 
  ShieldCheck,
  Info,
  Printer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Sparkles,
  ExternalLink,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Gift
} from 'lucide-react';
import { toast } from 'sonner';

export interface FluxTransaction {
  id: string;
  amountCents: number;
  amountRub: number;
  runningBalanceCents?: number | null;
  runningBalanceRub?: number | null;
  reason: string;
  status: string;
  idempotencyKey: string | null;
  transactionType: string;
  orderNumericId?: number | null;
  createdAt: string;
}

export function FluxTransactionsView({
  initialEntries = [],
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userEmail,
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

  // Metrics summary
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

    // Net spent = Gross spent - Refunds
    const totalSpentNet = Math.max(0, totalSpentGross - totalRefunded);

    return { 
      totalDeposited, 
      totalSpentGross, 
      totalRefunded, 
      totalSpentNet,
      depositCount,
      orderCount,
      refundCount
    };
  }, [initialEntries]);

  // Filtered transactions
  const filteredEntries = useMemo(() => {
    return initialEntries.filter((item) => {
      const isRefund = item.transactionType === 'REFUND' || item.reason.toLowerCase().includes('возврат');
      const isDeposit = item.amountRub > 0 && !isRefund;
      const isOrder = item.amountRub < 0;

      // 1. Type filter
      if (filterType === 'DEPOSIT' && !isDeposit) return false;
      if (filterType === 'ORDER' && !isOrder) return false;
      if (filterType === 'REFUND' && !isRefund) return false;

      // 2. Search query filter
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
    const d = new Date(isoString);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-foreground font-sans print:text-black">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black uppercase tracking-wider mb-2 print:hidden">
            <Receipt className="w-3.5 h-3.5" />
            Прозрачная бухгалтерия
          </div>
          <h1 className="text-3xl font-black tracking-tight">Финансовый журнал</h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Детализированный аудит баланса: сколько внесено, потрачено и возвращено.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto print:hidden">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-2xl bg-card border border-border/80 text-foreground font-bold text-sm hover:bg-muted/50 transition-all cursor-pointer shadow-sm"
            title="Распечатать или сохранить выписку в PDF"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Печать выписки</span>
          </button>

          <Link
            href="/dashboard/add-funds"
            className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-md hover:opacity-90 active:scale-95 transition-all"
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>Пополнить</span>
          </Link>
        </div>
      </div>

      {/* ── TRANSPARENCY FORMULA BANNER (БУХГАЛТЕРИЯ НА ПАЛЬЦАХ) ── */}
      <div className="p-6 sm:p-7 rounded-[2.5rem] bg-card/85 backdrop-blur-2xl border border-border/60 shadow-lg shadow-black/5 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Формула вашего баланса</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase">
                100% Прозрачно
              </span>
            </div>
            <h2 className="text-xl font-black text-foreground">
              Чистые расходы на продвижение: {summary.totalSpentNet.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
            </h2>
            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
              Рассчитывается как: <strong>Пополнено ({summary.totalDeposited.toFixed(0)} ₽)</strong> минус <strong>Фактически выполненные заказы ({summary.totalSpentNet.toFixed(0)} ₽)</strong> = <strong>Текущий остаток ({currentBalanceRub.toFixed(2)} ₽)</strong>.
            </p>
          </div>

          {/* Balance Breakdown Pills */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
            <div className="flex-1 sm:flex-initial p-3.5 rounded-2xl bg-muted/40 border border-border/30 text-center min-w-[110px]">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">Пополнено</span>
              <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                +{summary.totalDeposited.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
              </span>
            </div>

            <div className="text-muted-foreground font-bold text-lg hidden sm:block">-</div>

            <div className="flex-1 sm:flex-initial p-3.5 rounded-2xl bg-muted/40 border border-border/30 text-center min-w-[110px]">
              <span className="text-[10px] font-bold text-muted-foreground block uppercase">Чистые траты</span>
              <span className="text-base font-black text-rose-500 tabular-nums">
                -{summary.totalSpentNet.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₽
              </span>
            </div>

            <div className="text-muted-foreground font-bold text-lg hidden sm:block">=</div>

            <div className="flex-1 sm:flex-initial p-3.5 rounded-2xl bg-primary/10 border border-primary/20 text-center min-w-[120px]">
              <span className="text-[10px] font-black text-primary block uppercase">На счете</span>
              <span className="text-base font-black text-primary tabular-nums">
                {currentBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
              </span>
            </div>
          </div>
        </div>

        {/* Refund Peace of Mind Notice */}
        {summary.totalRefunded > 0 && (
          <div className="mt-5 pt-4 border-t border-border/40 flex items-center gap-3 text-xs text-muted-foreground font-medium">
            <div className="w-6 h-6 rounded-full bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0">
              <Info className="w-3.5 h-3.5" />
            </div>
            <span>
              Вам возвращено <strong>+{summary.totalRefunded.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</strong> за отмененные остатки. Эти средства уже зачислены на баланс и готовы к повторным заказам.
            </span>
          </div>
        )}
      </div>

      {/* ── CONTROLS: FILTERS & SEARCH ── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 print:hidden">
        {/* Filter Tabs */}
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
                filterType === tab.key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
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

      {/* ── TRANSACTIONS TIMELINE ── */}
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
          {filteredEntries.map((tx) => {
            const isRefund = tx.transactionType === 'REFUND' || tx.reason.toLowerCase().includes('возврат');
            const isCredit = tx.amountRub > 0;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const isOrder = tx.amountRub < 0;

            const Icon = isRefund ? RotateCcw : isCredit ? ArrowDownLeft : ArrowUpRight;
            const iconBg = isRefund 
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
              : isCredit 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';

            const amountColor = isRefund 
              ? 'text-sky-600 dark:text-sky-400' 
              : isCredit 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-foreground';

            const typeBadgeText = isRefund ? 'Возврат' : isCredit ? 'Пополнение' : 'Списание';

            return (
              <div
                key={tx.id}
                className="p-4 sm:p-5 rounded-2xl bg-card/75 backdrop-blur-xl border border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-primary/30 transition-all duration-200"
              >
                {/* Left: Icon & Description */}
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${iconBg}`}>
                    <Icon className="w-5 h-5 shrink-0" />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md border ${iconBg}`}>
                        {typeBadgeText}
                      </span>

                      <span className="text-[11px] text-muted-foreground font-mono font-bold">
                        {formatDate(tx.createdAt)}
                      </span>

                      {/* Order link badge if available */}
                      {tx.orderNumericId && (
                        <Link
                          href={`/dashboard/orders?search=${tx.orderNumericId}`}
                          className="inline-flex items-center gap-1 text-[11px] font-mono font-black text-primary bg-primary/10 hover:bg-primary/20 px-2 py-0.5 rounded-md transition-colors"
                          title="Посмотреть этот заказ"
                        >
                          <span>Заказ #{tx.orderNumericId}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </Link>
                      )}

                      {/* 54-FZ Receipt indicator for deposits */}
                      {isCredit && !isRefund && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3 shrink-0" />
                          Чек 54-ФЗ
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-bold text-foreground truncate max-w-xl">
                      {tx.reason || 'Операция по счету'}
                    </div>

                    {/* Running balance audit trail (null для не-APPROVED — баланс не менялся) */}
                    {tx.runningBalanceRub != null && (
                      <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                        <span>Остаток после операции:</span>
                        <span className="font-bold text-foreground tabular-nums">
                          {tx.runningBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Amount & Copy ID */}
                <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-border/30">
                  <div className="text-left sm:text-right">
                    <div className={`text-base sm:text-lg font-black tabular-nums ${amountColor}`}>
                      {isCredit ? '+' : ''}{tx.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      {tx.status === 'APPROVED' || tx.status === 'SUCCESS' ? 'Исполнено' : tx.status}
                    </div>
                  </div>

                  {tx.idempotencyKey && (
                    <button
                      onClick={() => handleCopy(tx.idempotencyKey!, tx.id)}
                      className="p-2 rounded-xl bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer print:hidden"
                      title="Скопировать ID транзакции"
                    >
                      {copiedId === tx.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
