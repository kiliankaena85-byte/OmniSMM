'use client';
// audit-disable STR-002

import React, { useState, useMemo } from 'react';
import { 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Receipt, 
  Search, 
  Copy, 
  Check, 
  Printer, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  HelpCircle,
  ToggleLeft,
  ToggleRight,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ChevronRight,
  Briefcase
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { resolveLedgerTypeForDisplay } from '@/lib/financial/ledger-types';

interface Transaction {
  id: string;
  amountCents: number;
  amountRub: number;
  runningBalanceCents?: number | null;
  runningBalanceRub?: number | null;
  reason: string;
  status: string;
  idempotencyKey: string | null;
  transactionType: string;
  adminId?: string | null;
  orderNumericId?: number | null;
  createdAt: string;
}

// FIX(BUG-A2): статус QUARANTINE существует в схеме (LedgerEntry.status),
// раньше отображался как «Отклонено» — вводим полный словарь статусов.
const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Успешно',
  PENDING: 'В обработке',
  QUARANTINE: 'На проверке',
  REJECTED: 'Отклонено',
};
const getStatusLabel = (status: string): string => STATUS_LABELS[status] ?? status;

/**
 * FIX(BUG-A1): группировка транзакции по фильтру на основе КАНОНИЧЕСКИХ типов
 * из @/lib/financial/ledger-types (TOPUP, ORDER_CHARGE, ORDER_CANCEL, REFUND,
 * ADJUSTMENT, COMPENSATION, REROUTE, legacy PAYMENT).
 *
 * Раньше фильтр сравнивал с legacy-типами ('PAYMENT'), которые WalletOps больше
 * не пишет (credit → TOPUP, charge → ORDER_CHARGE, refund → REFUND/ORDER_CANCEL,
 * adminAdjust → ADJUSTMENT), из-за чего «Пополнения» и «Списания» были пустыми.
 */
function matchesTransactionTypeFilter(
  item: Transaction,
  typeFilter: 'ALL' | 'DEPOSIT' | 'SPENT' | 'REFUND'
): boolean {
  if (typeFilter === 'ALL') return true;

  const normalizedType = resolveLedgerTypeForDisplay(
    item.transactionType,
    item.amountRub,
    item.adminId ?? null
  );

  if (typeFilter === 'DEPOSIT') {
    // Любые зачисления: пополнения кассы, бонусы/компенсации, ручные корректировки «+»
    return item.amountRub > 0 &&
      ['TOPUP', 'COMPENSATION', 'ADJUSTMENT', 'PAYMENT'].includes(normalizedType);
  }
  if (typeFilter === 'SPENT') {
    // Любые списания: оплата заказов, перезапуски, ручные корректировки «−»
    return item.amountRub < 0 &&
      ['ORDER_CHARGE', 'REROUTE', 'ADJUSTMENT', 'PAYMENT'].includes(normalizedType);
  }
  // REFUND: авто-возвраты И ручные отмены заказов администратором
  return ['REFUND', 'ORDER_CANCEL'].includes(normalizedType);
}

interface MobileTransactionListProps {
  entries: Transaction[];
  isAccountantMode: boolean;
  formatDate: (isoString: string, full?: boolean) => string;
  handleCopy: (text: string, id: string) => void;
  copiedId: string | null;
}

function MobileTransactionList({
  entries,
  isAccountantMode,
  formatDate,
  handleCopy,
  copiedId,
}: MobileTransactionListProps) {
  if (entries.length === 0) return null;

  return (
    <div className="lg:hidden divide-y divide-border/40 select-none">
      {entries.map((item) => {
        const isCredit = item.amountRub > 0;
        const isRefund = item.transactionType === 'REFUND';
        const typeLabel = isRefund ? 'Возврат' : isCredit ? 'Пополнение' : 'Списание';
        const typeColor = isRefund ? 'text-info bg-info/10 border-info/20' 
          : isCredit ? 'text-success-text bg-success/10 border-success/20' 
          : 'text-destructive bg-destructive/10 border-destructive/20';

        if (!isAccountantMode) {
          const orderMatch = /#(\d{3,9})/.exec(item.reason);
          const orderId = orderMatch ? orderMatch[1] : null;

          return (
            <div
              key={item.id}
              className="p-4 space-y-2.5 hover:bg-muted/10 transition-colors"
            >
              {/* Header: Type Badge & Status */}
              <div className="flex justify-between items-center">
                <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border tracking-wider ${typeColor}`}>
                  {typeLabel}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md ${
                  item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                  : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  {getStatusLabel(item.status)}
                </span>
              </div>

              {/* Description & Order Link */}
              <div className="text-xs font-semibold text-foreground leading-normal">
                {item.reason}
                {orderId && (
                  <Link
                    href={`/dashboard/orders/${orderId}`}
                    className="inline-flex items-center gap-1 ml-2 text-primary hover:underline text-[11px] font-bold"
                  >
                    Открыть заказ #{orderId} ↗
                  </Link>
                )}
              </div>

              {/* Footer: Date, Amount & Running Balance */}
              <div className="flex justify-between items-center pt-1 text-xs border-t border-border/20">
                <span className="text-muted-foreground font-semibold tabular-nums text-[11px]">
                  {formatDate(item.createdAt)}
                </span>
                <div className="flex flex-col items-end gap-0.5">
                  <span className={`font-black tabular-nums text-sm ${isCredit ? 'text-success' : 'text-destructive'}`}>
                    {isCredit ? '+' : ''}{item.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                  </span>
                  {typeof item.runningBalanceRub === 'number' && (
                    <span className="text-[10px] text-muted-foreground font-mono font-medium">
                      Баланс стал: <span className="font-bold text-foreground">{item.runningBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        } else {
          // Accountant mode card
          return (
            <div
              key={item.id}
              className="p-4 space-y-3 font-mono text-[10px]"
            >
              {/* CUID Row */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-muted-foreground uppercase font-bold">ID:</span>
                  <span className="text-[10px] text-foreground select-all font-semibold max-w-[120px] truncate min-w-0" title={item.id}>
                    {item.id}
                  </span>
                  <button
                    onClick={() => handleCopy(item.id, `id-mob-${item.id}`)}
                    className="w-11 h-11 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                    title="Скопировать Transaction ID"
                  >
                    {copiedId === `id-mob-${item.id}` ? (
                      <Check className="w-3 h-3 text-success animate-in zoom-in shrink-0" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
                <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded ${
                  item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                  : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
                }`}>
                  {item.status}
                </span>
              </div>

              {/* Precise ISO Time & Type */}
              <div className="grid grid-cols-2 gap-2 text-[9px] border-b border-border/20 pb-2">
                <div>
                  <div className="text-muted-foreground font-bold">Precise Time</div>
                  <div className="text-foreground mt-0.5">{formatDate(item.createdAt, true)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground font-bold">DB Type</div>
                  <div className="text-foreground mt-0.5">{item.transactionType}</div>
                </div>
              </div>

              {/* Idempotency Key */}
              <div className="text-[9px] border-b border-border/20 pb-2">
                <div className="text-muted-foreground font-bold">Idempotency Key</div>
                <div className="mt-0.5">
                  {item.idempotencyKey ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-foreground select-all max-w-[180px] truncate min-w-0" title={item.idempotencyKey}>
                        {item.idempotencyKey}
                      </span>
                      <button
                        onClick={() => handleCopy(item.idempotencyKey!, `idmp-mob-${item.id}`)}
                        className="w-11 h-11 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                        title="Скопировать Idempotency Key"
                      >
                        {copiedId === `idmp-mob-${item.id}` ? (
                          <Check className="w-3 h-3 text-success shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div>
                <div className="text-[9px] text-muted-foreground font-bold">Reason</div>
                <div className="text-foreground font-semibold mt-0.5 leading-relaxed">{item.reason}</div>
              </div>

              {/* Raw Cents */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-muted-foreground font-bold">Raw Cents</span>
                <span className={`font-bold text-xs ${isCredit ? 'text-success-text' : 'text-destructive'}`}>
                  {isCredit ? '+' : ''}{item.amountCents.toLocaleString('ru-RU')} коп.
                </span>
              </div>
            </div>
          );
        }
      })}
    </div>
  );
}

interface TransactionsClientProps {
  initialEntries: Transaction[];
  userEmail: string;
}

export function TransactionsClient({ initialEntries, userEmail }: TransactionsClientProps) {
  const [entries] = useState<Transaction[]>(initialEntries);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filters state
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'DEPOSIT' | 'SPENT' | 'REFUND'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  
  // Layout Profile Toggle
  const [isAccountantMode, setIsAccountantMode] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Скопировано в буфер обмена!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 1. Apply Dynamic Client-Side Filtering
  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    // FIX(BUG-A3b): поиск дополнительно матчит номер заказа (#10429 или 10429)
    const digitsOnly = query.replace(/^#/, '');

    return entries.filter(item => {
      // Search text filter
      const matchesSearch =
        !query ||
        item.reason.toLowerCase().includes(query) ||
        item.id.toLowerCase().includes(query) ||
        (item.idempotencyKey && item.idempotencyKey.toLowerCase().includes(query)) ||
        (/^#?\d+$/.test(digitsOnly) && item.orderNumericId === Number(digitsOnly));

      // Operation Type filter (канонические типы — см. matchesTransactionTypeFilter)
      const matchesType = matchesTransactionTypeFilter(item, typeFilter);

      // Date filter — FIX(BUG-A3c): календарные окна вместо Math.ceil( abs diff ),
      // исключаем «будущие» даты, которые раньше попадали в любые окна.
      let matchesDate = true;
      if (dateFilter !== 'ALL') {
        const itemDate = new Date(item.createdAt);
        const now = new Date();

        if (dateFilter === 'TODAY') {
          matchesDate = itemDate.toDateString() === now.toDateString();
        } else {
          const windowDays = dateFilter === 'WEEK' ? 7 : 30;
          const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          start.setDate(start.getDate() - (windowDays - 1));
          matchesDate = itemDate >= start && itemDate <= now;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [entries, search, typeFilter, dateFilter]);

  // 2. Calculations for Financial KPI Dashboard
  const stats = useMemo(() => {
    let totalDeposited = 0; // Total added
    let totalSpent = 0;     // Total debited
    let totalRefunds = 0;   // Total refunded

    entries.forEach(item => {
      if (item.status !== 'APPROVED') return; // only calculate approved entries

      // FIX(KPI-align): семантика KPI = семантика вкладок.
      // REFUND-семейство (авто-возвраты + ручные отмены) → «Возвращено»,
      // иначе положительные суммы → «Зачислено», отрицательные → «Потрачено».
      // Раньше ORDER_CANCEL(+RUB) ошибочно попадал в «Всего зачислено».
      if (item.transactionType === 'REFUND' || item.transactionType === 'ORDER_CANCEL') {
        totalRefunds += Math.abs(item.amountRub);
      } else if (item.amountRub > 0) {
        totalDeposited += item.amountRub;
      } else if (item.amountRub < 0) {
        totalSpent += Math.abs(item.amountRub);
      }
    });

    return {
      totalDeposited,
      totalSpent,
      totalRefunds,
      balanceDiff: totalDeposited - totalSpent + totalRefunds
    };
  }, [entries]);

  // Format Helper
  const formatDate = (isoString: string, full = false) => {
    const d = new Date(isoString);
    if (full) return d.toLocaleString('ru-RU');
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      
      {/* ── SECTION 1: FINANCIAL KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        
        {/* KPI: Deposits */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-success/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Всего зачислено</span>
            <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {stats.totalDeposited.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Пополнения через кассу</p>
        </div>

        {/* KPI: Spent */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Всего потрачено</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <ArrowDownRight className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {stats.totalSpent.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Списания за услуги продвижения</p>
        </div>

        {/* KPI: Refunds */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-violet-600/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Возвращено</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground tabular-nums">
            {stats.totalRefunds.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Компенсации при отменах</p>
        </div>

        {/* KPI: Ledger Sum (Credit/Debit Balance check) */}
        <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-primary/5 rounded-full blur-xl" />
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">Итог движения</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Briefcase className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <p className={`text-2xl font-black tabular-nums ${stats.balanceDiff >= 0 ? 'text-success' : 'text-destructive'}`}>
            {stats.balanceDiff >= 0 ? '+' : ''}{stats.balanceDiff.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 font-medium">Сальдо балансового счета</p>
        </div>
      </div>

      {/* ── PRINT-ONLY LEDGER REPORT BANNER ── */}
      <div className="hidden print:block border-b-2 border-border pb-6 mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">SMMplan Financial Statement</h2>
            <p className="text-sm text-muted-foreground mt-1">Клиент: <span className="font-semibold text-foreground">{userEmail}</span></p>
            <p className="text-xs text-muted-foreground mt-0.5">Дата генерации: {new Date().toLocaleString('ru-RU')}</p>
          </div>
          <div className="text-right text-sm">
            <div className="font-bold">Итоги сводки:</div>
            <div>Пополнено: {stats.totalDeposited.toFixed(2)} ₽</div>
            <div>Потрачено: {stats.totalSpent.toFixed(2)} ₽</div>
            <div>Возвращено: {stats.totalRefunds.toFixed(2)} ₽</div>
            <div className="font-bold border-t border-border mt-1 pt-0.5">Сальдо: {stats.balanceDiff.toFixed(2)} ₽</div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: INTERACTIVE CONTROLS (FILTERS + PROFILE TOGGLE) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card border border-border/60 rounded-2xl p-4 shadow-sm print:hidden">
        
        {/* Left: Type and Date Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
          
          {/* Type filters */}
          <div className="flex bg-muted p-1 rounded-xl border border-border/40 select-none w-full sm:w-auto shrink-0">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'ALL' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setTypeFilter('DEPOSIT')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'DEPOSIT' ? 'bg-success text-success-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Пополнения
            </button>
            <button
              onClick={() => setTypeFilter('SPENT')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'SPENT' ? 'bg-background text-foreground shadow-sm border border-rose-500/10' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Списания
            </button>
            <button
              onClick={() => setTypeFilter('REFUND')}
              className={`flex-1 sm:flex-none px-2 sm:px-4 py-2 text-xs sm:text-sm font-bold min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
                typeFilter === 'REFUND' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Возвраты
            </button>
          </div>

          {/* Date Selector */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as "ALL" | "TODAY" | "WEEK" | "MONTH")}
            className="h-11 w-full sm:w-auto bg-content2 border border-border/60 rounded-xl px-3 py-2 text-base sm:text-sm font-semibold text-foreground outline-none focus:border-primary cursor-pointer select-none"
            aria-label="Фильтр по дате"
          >
            <option value="ALL">За всё время</option>
            <option value="TODAY">За сегодня</option>
            <option value="WEEK">За последние 7 дней</option>
            <option value="MONTH">За последние 30 дней</option>
          </select>
        </div>

        {/* Right: Search & Profile Toggles */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1 md:w-60 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Поиск по ID или причине..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-muted border border-border/60 rounded-xl text-base sm:text-sm font-medium placeholder:text-muted-foreground outline-none focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          {/* Unofficial Statement Printer Button */}
          <button
            onClick={handlePrint}
            className="h-11 px-4 flex items-center justify-center gap-2 bg-content2 border border-border/60 hover:bg-content3 rounded-xl text-sm font-bold text-foreground transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Распечатать финансовый отчет"
          >
            <Printer className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Печать</span>
          </button>

          {/* Dual-Mode Accountant Toggle */}
          <div className="flex items-center gap-2 bg-muted/60 border border-border/40 px-3 h-11 rounded-xl select-none">
            <span className="text-[10px] font-extrabold uppercase text-muted-foreground">Бухгалтер</span>
            <button
              onClick={() => setIsAccountantMode(!isAccountantMode)}
              className="h-11 flex items-center text-primary hover:opacity-90 active:scale-95 transition-all cursor-pointer"
              title="Переключить в режим бухгалтера"
              aria-label="Переключить в режим бухгалтера"
            >
              {isAccountantMode ? (
                <ToggleRight className="w-8 h-8 text-primary fill-current" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: TRANSACTIONS GRID/TABLE ── */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-sm">
        
        {/* Simple User Mode (Clean layouts) */}
        {!isAccountantMode ? (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm" aria-label="История транзакций (простой вид)">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-widest text-foreground/75 bg-muted/20 border-b border-border/40 select-none">
                    <th className="py-3 px-3.5 font-bold">Дата операции</th>
                    <th className="py-3 px-3.5 font-bold">Тип</th>
                    <th className="py-3 px-3.5 font-bold">Описание / Причина</th>
                    <th className="py-3 px-3.5 font-bold text-right">Сумма (₽)</th>
                    <th className="py-3 px-3.5 font-bold text-right">Баланс после</th>
                    <th className="py-3 px-3.5 font-bold text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((item) => {
                    const isCredit = item.amountRub > 0;
                    const isRefund = item.transactionType === 'REFUND';
                    const typeLabel = isRefund ? 'Возврат' : isCredit ? 'Пополнение' : 'Списание';
                    const typeColor = isRefund ? 'text-info bg-info/10 border-info/20' 
                      : isCredit ? 'text-success-text bg-success/10 border-success/20' 
                      : 'text-destructive bg-destructive/10 border-destructive/20';

                    const orderMatch = /#(\d{3,9})/.exec(item.reason);
                    const orderId = orderMatch ? orderMatch[1] : null;

                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/40 hover:bg-muted/10 transition-colors last:border-0"
                      >
                        {/* Date */}
                        <td className="py-2.5 px-3.5 text-xs text-muted-foreground font-semibold tabular-nums whitespace-nowrap">
                          {formatDate(item.createdAt)}
                        </td>
                        
                        {/* Badge type */}
                        <td className="py-2.5 px-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border tracking-wider select-none ${typeColor}`}>
                            {typeLabel}
                          </span>
                        </td>

                        {/* Decoded Reason & Order Link */}
                        <td className="py-2.5 px-3.5 text-xs font-semibold text-foreground leading-normal max-w-[240px]">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="truncate max-w-[170px]" title={item.reason}>{item.reason}</span>
                            {orderId && (
                              <Link
                                href={`/dashboard/orders/${orderId}`}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary rounded text-[10px] font-mono font-bold transition-colors shrink-0"
                                title={`Перейти к заказу #${orderId}`}
                              >
                                Заказ #{orderId} ↗
                              </Link>
                            )}
                          </div>
                        </td>

                        {/* Amount with colored sign */}
                        <td className={`py-2.5 px-3.5 text-right font-bold tabular-nums text-sm whitespace-nowrap ${isCredit ? 'text-success' : 'text-destructive'}`}>
                          {isCredit ? '+' : ''}{item.amountRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                        </td>

                        {/* Running Balance After Transaction */}
                        <td className="py-2.5 px-3.5 text-right font-mono font-semibold text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                          {typeof item.runningBalanceRub === 'number' ? (
                            <span className="text-foreground font-bold">
                              {item.runningBalanceRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3.5 text-center select-none">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-md ${
                            item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                            : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}>
                            {getStatusLabel(item.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MobileTransactionList
              entries={filteredEntries}
              isAccountantMode={false}
              formatDate={formatDate}
              handleCopy={handleCopy}
              copiedId={copiedId}
            />
          </>
        ) : (
          <>
            {/* Meticulous Accountant Mode (High Density Database properties) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-xs" aria-label="История транзакций (бухгалтерский аудит)">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-widest text-foreground/75 bg-muted/30 border-b border-border/40 select-none">
                    <th className="py-2.5 px-3 font-bold">ISO Время</th>
                    <th className="py-2.5 px-3 font-bold">Transaction CUID</th>
                    <th className="py-2.5 px-3 font-bold">Копейки (Raw Cents)</th>
                    <th className="py-2.5 px-3 font-bold">Тип в БД</th>
                    <th className="py-2.5 px-3 font-bold">Идемпотентность (Idempotency Key)</th>
                    <th className="py-2.5 px-3 font-bold">Обоснование (Reason)</th>
                    <th className="py-2.5 px-3 font-bold text-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((item) => {
                    const isCredit = item.amountRub > 0;
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-border/40 hover:bg-muted/20 font-mono transition-colors last:border-0"
                      >
                        {/* Precise Timestamp */}
                        <td className="py-2 px-3 font-semibold text-muted-foreground whitespace-nowrap text-[11px]">
                          {formatDate(item.createdAt, true)}
                        </td>

                        {/* Transaction CUID with Clipboard action */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-foreground select-all font-semibold max-w-[80px] truncate min-w-0" title={item.id}>
                              {item.id}
                            </span>
                            <button
                              onClick={() => handleCopy(item.id, `id-${item.id}`)}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                              title="Скопировать Transaction ID"
                            >
                              {copiedId === `id-${item.id}` ? (
                                <Check className="w-3 h-3 text-success animate-in zoom-in" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Raw cents count */}
                        <td className={`py-2 px-3 text-left font-bold text-[11px] whitespace-nowrap ${isCredit ? 'text-success-text' : 'text-destructive'}`}>
                          {isCredit ? '+' : ''}{item.amountCents.toLocaleString('ru-RU')} коп.
                        </td>

                        {/* DB Enum type */}
                        <td className="py-2 px-3 text-foreground font-extrabold text-[10px]">
                          {item.transactionType}
                        </td>

                        {/* Idempotency Key */}
                        <td className="py-2 px-3 whitespace-nowrap">
                          {item.idempotencyKey ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-muted-foreground select-all max-w-[90px] truncate min-w-0" title={item.idempotencyKey}>
                                {item.idempotencyKey}
                              </span>
                              <button
                                onClick={() => handleCopy(item.idempotencyKey!, `idmp-${item.id}`)}
                                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                                title="Скопировать Idempotency Key"
                              >
                                {copiedId === `idmp-${item.id}` ? (
                                  <Check className="w-3 h-3 text-success" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </td>

                        {/* Raw Reason string */}
                        <td className="py-2 px-3 font-semibold text-foreground max-w-[200px] truncate" title={item.reason}>
                          {item.reason}
                        </td>

                        {/* Precise raw Status */}
                        <td className="py-2 px-3 text-center select-none">
                          <span className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded ${
                            item.status === 'APPROVED' ? 'bg-success/10 text-success-text border border-success/20' 
                            : item.status === 'PENDING' ? 'bg-warning/10 text-warning-text border border-warning/20' 
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <MobileTransactionList
              entries={filteredEntries}
              isAccountantMode={true}
              formatDate={formatDate}
              handleCopy={handleCopy}
              copiedId={copiedId}
            />
          </>
        )}

        {/* Empty state container */}
        {filteredEntries.length === 0 && (
          <div className="py-16 text-center select-none print:hidden">
            <div className="text-4xl mb-3">💸</div>
            <h4 className="text-sm font-extrabold text-foreground">История операций пуста</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed mt-1">
              Здесь будут отображаться пополнения счета, оплаты тарифов продвижения и отмены заказов.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
