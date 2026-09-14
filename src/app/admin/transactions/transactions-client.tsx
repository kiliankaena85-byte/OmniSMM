'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { getLedgerAction, type LedgerPageResult, type LedgerEntryDTO } from '@/actions/admin/finance/ledger';
import { ClientDate } from '@/components/ui/client-date';
import { NumberedPagination } from '@/components/admin/ui/numbered-pagination';
import { 
  ArrowLeftRight, 
  CreditCard, 
  ShoppingCart, 
  RotateCcw, 
  Search, 
  Download, 
  RefreshCw, 
  Wallet,
  SlidersHorizontal,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Ban,
  Shield,
  User
} from 'lucide-react';
import { resolveLedgerTypeForDisplay, LEDGER_TYPE_CONFIG } from '@/lib/financial/ledger-types';

interface TransactionsClientProps {
  initial: LedgerPageResult;
  initialPeriod?: string;
  initialMinAmount?: string;
  initialMaxAmount?: string;
  initialDateFrom?: string;
  initialDateTo?: string;
  tenantId?: string;
  canExport?: boolean;
}

const PERIOD_OPTIONS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: '7 дней' },
  { id: 'month', label: '30 дней' },
  { id: 'all', label: 'Все время' },
];

const STATUS_OPTIONS = [
  { id: 'ALL', label: 'Все статусы' },
  { id: 'APPROVED', label: 'Одобрено' },
  { id: 'QUARANTINE', label: 'Карантин' },
  { id: 'REJECTED', label: 'Отклонено' },
];

const TYPE_OPTIONS = [
  { id: 'ALL', label: 'Все типы' },
  { id: 'TOPUP', label: '💳 Пополнения' },
  { id: 'ORDER_CHARGE', label: '🛒 Оплата заказов' },
  { id: 'ORDER_CANCEL', label: '🚫 Отмены заказов' },
  { id: 'REFUND', label: '↩️ Авто-возвраты' },
  { id: 'COMPENSATION', label: '🎁 Компенсации' },
  { id: 'ADJUSTMENT', label: '⚖️ Корректировки' },
  { id: 'REROUTE', label: '🔄 Перезапуски' },
];

function fmtRub(cents: number, showSign = false): string {
  const rubles = cents / 100;
  const formatted = rubles.toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (showSign && rubles > 0) return `+${formatted} ₽`;
  return `${formatted} ₽`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Скопировано');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-muted-foreground hover:text-foreground cursor-pointer p-0.5 rounded transition-colors"
      title="Скопировать"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

export function TransactionsClient({
  initial,
  initialPeriod = 'month',
  initialMinAmount = '',
  initialMaxAmount = '',
  initialDateFrom = '',
  initialDateTo = '',
  tenantId = 'smmplan',
  canExport = false,
}: TransactionsClientProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [data, setData] = useState<LedgerPageResult>(initial);
  const [period, setPeriod] = useState<string>(initialPeriod);
  const [status, setStatus] = useState<string>('ALL');
  const [type, setType] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>(initialMinAmount);
  const [maxAmount, setMaxAmount] = useState<string>(initialMaxAmount);
  const [dateFrom, setDateFrom] = useState<string>(initialDateFrom);
  const [dateTo, setDateTo] = useState<string>(initialDateTo);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(
    Boolean(initialMinAmount || initialMaxAmount || initialDateFrom || initialDateTo)
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadData = useCallback((
    newPeriod = period,
    newStatus = status,
    newType = type,
    newSearch = search,
    newMinAmount = minAmount,
    newMaxAmount = maxAmount,
    newDateFrom = dateFrom,
    newDateTo = dateTo,
    page = data.currentPage || 1,
    pageSize = data.pageSize || 50,
  ) => {
    startTransition(async () => {
      const parsedMin = newMinAmount !== '' ? parseFloat(newMinAmount.replace(',', '.')) : undefined;
      const parsedMax = newMaxAmount !== '' ? parseFloat(newMaxAmount.replace(',', '.')) : undefined;

      const res = await getLedgerAction({
        period: newPeriod as any,
        status: newStatus as any,
        type: newType as any,
        search: newSearch.trim() || undefined,
        minAmount: !isNaN(parsedMin as number) ? parsedMin : undefined,
        maxAmount: !isNaN(parsedMax as number) ? parsedMax : undefined,
        dateFrom: newDateFrom || undefined,
        dateTo: newDateTo || undefined,
        page,
        pageSize,
        tenantId,
      });

      if ('error' in res) {
        toast.error(res.error);
        return;
      }
      setData(res);
    });
  }, [period, status, type, search, minAmount, maxAmount, dateFrom, dateTo, data.currentPage, data.pageSize, tenantId]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    setDateFrom('');
    setDateTo('');
    loadData(newPeriod, status, type, search, minAmount, maxAmount, '', '', 1);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
    loadData(period, newStatus, type, search, minAmount, maxAmount, dateFrom, dateTo, 1);
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    loadData(period, status, newType, search, minAmount, maxAmount, dateFrom, dateTo, 1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData(period, status, type, search, minAmount, maxAmount, dateFrom, dateTo, 1);
  };

  const handleApplyAdvancedFilters = () => {
    loadData(period, status, type, search, minAmount, maxAmount, dateFrom, dateTo, 1);
    toast.success('Фильтры применены');
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('ALL');
    setType('ALL');
    setPeriod('month');
    setMinAmount('');
    setMaxAmount('');
    setDateFrom('');
    setDateTo('');
    loadData('month', 'ALL', 'ALL', '', '', '', '', '', 1);
    toast.info('Фильтры сброшены');
  };

  const handleQuickAmountRange = (min: number, max?: number) => {
    const minStr = min.toString();
    const maxStr = max !== undefined ? max.toString() : '';
    setMinAmount(minStr);
    setMaxAmount(maxStr);
    loadData(period, status, type, search, minStr, maxStr, dateFrom, dateTo, 1);
  };

  const handleLostPaymentTolerance = (targetAmount: number) => {
    const min = Math.max(0, Math.round(targetAmount * 0.9));
    const max = Math.round(targetAmount * 1.1);
    setMinAmount(min.toString());
    setMaxAmount(max.toString());
    
    // Set date to last 3 days
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const dateFromStr = d.toISOString().slice(0, 10);
    setDateFrom(dateFromStr);
    setDateTo('');
    
    loadData('all', status, 'TOPUP', search, min.toString(), max.toString(), dateFromStr, '', 1);
    toast.info(`Поиск пополнений: ${min}–${max} ₽ за последние 3 дня`);
  };

  const activeFiltersCount = [
    status !== 'ALL',
    type !== 'ALL',
    Boolean(search.trim()),
    Boolean(minAmount),
    Boolean(maxAmount),
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const handleExportCsv = () => {
    if (data.items.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }
    const headers = ['ID проводки', 'UUID / Idempotency Key', 'Дата', 'Email клиента', 'Сумма (₽)', 'Тип операции', 'Основание', 'Инициатор', 'Статус'];
    const rows = data.items.map(item => [
      item.id,
      `"${item.idempotencyKey || item.id}"`,
      item.createdAt,
      item.userEmail,
      (item.amount / 100).toFixed(2),
      item.transactionType,
      `"${item.reason.replace(/"/g, '""')}"`,
      item.adminId || 'Система',
      item.status,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ledger-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV файл успешно выгружен');
  };

  // Quick stat aggregates from current view
  const totalApprovedRub = data.totals?.approved ? data.totals.approved / 100 : 0;
  const totalRefundsRub = data.totals?.refunds ? data.totals.refunds / 100 : 0;

  return (
    <div className="space-y-5 w-full">
      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card/70 backdrop-blur-sm border border-border/70 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Всего операций</span>
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-foreground mt-1.5">{data.totalCount ?? data.items.length}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">В текущей выборке</div>
        </div>

        <div className="bg-card/70 backdrop-blur-sm border border-border/70 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Одобрено (Приход)</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CreditCard className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1.5 truncate">
            +{totalApprovedRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Пополнения и начисления</div>
        </div>

        <div className="bg-card/70 backdrop-blur-sm border border-border/70 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Возвраты & Сдача</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-1.5 truncate">
            {totalRefundsRub.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Авто-возвраты по заказам</div>
        </div>

        <div className="bg-card/70 backdrop-blur-sm border border-border/70 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Карантин / Очередь</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1.5 truncate">
            {((data.totals?.quarantine || 0) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">На проверке эскроу</div>
        </div>
      </div>

      {/* Filter Toolbar & Quick Type Chips */}
      <div className="bg-card/90 backdrop-blur-sm border border-border/70 rounded-lg p-3 shadow-xs space-y-2.5">
        
        {/* Row 1: Search, Period, Status, Export */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px] relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по Email, ID, UUID, причине..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-background border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-xs"
            />
          </form>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 shrink-0">
            {PERIOD_OPTIONS.map(po => (
              <button
                key={po.id}
                type="button"
                onClick={() => handlePeriodChange(po.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  period === po.id
                    ? 'bg-card text-foreground shadow-2xs border border-border/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {po.label}
              </button>
            ))}
          </div>

          {/* Status Select */}
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            aria-label="Фильтр по статусу"
            className="h-8 px-2.5 text-xs font-semibold bg-background border border-border/70 rounded-lg text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer shrink-0 shadow-xs"
          >
            {STATUS_OPTIONS.map(so => (
              <option key={so.id} value={so.id}>{so.label}</option>
            ))}
          </select>

          {/* Toggle Advanced Filters (Price / Dates / Lost Payment) */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`h-8 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 ${
              showAdvancedFilters || activeFiltersCount > 0
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-background border-border/70 hover:bg-muted text-foreground'
            }`}
            title="Фильтры по сумме и датам"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Фильтры</span>
            {activeFiltersCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Refresh / Export */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => loadData(period, status, type, search, minAmount, maxAmount, dateFrom, dateTo)}
              disabled={isPending}
              className="h-8 px-2.5 rounded-lg border border-border/70 bg-background hover:bg-muted text-foreground flex items-center gap-1 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
              title="Обновить данные"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Обновить</span>
            </button>

            {isMounted && canExport && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="Экспорт транзакций в CSV (только для Администратора/Владельца)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Advanced Search (Price Range & Exact Date Range for Lost Payments) */}
        {showAdvancedFilters && (
          <div className="p-3 bg-muted/20 border border-border/70 rounded-lg space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* Price Range: Min / Max */}
              <div className="lg:col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Диапазон сумм (₽)</span>
                  <span className="text-[10px] text-primary font-medium">Поиск потерянных оплат</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      placeholder="От 0 ₽"
                      className="w-full h-8 px-2.5 text-xs bg-background border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono shadow-xs"
                    />
                  </div>
                  <span className="text-muted-foreground text-xs font-bold">—</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      placeholder="До..."
                      className="w-full h-8 px-2.5 text-xs bg-background border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Date Range: From / To */}
              <div className="lg:col-span-5 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Точный интервал дат
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="flex-1 h-8 px-2 text-xs bg-background border border-border/70 rounded-lg text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer shadow-xs"
                  />
                  <span className="text-muted-foreground text-xs font-bold">—</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="flex-1 h-8 px-2 text-xs bg-background border border-border/70 rounded-lg text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer shadow-xs"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="lg:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyAdvancedFilters}
                  disabled={isPending}
                  className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Найти</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  disabled={isPending}
                  className="h-8 px-3 rounded-lg border border-border/70 bg-background hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold transition-all cursor-pointer shadow-xs"
                  title="Сбросить все фильтры"
                >
                  Сброс
                </button>
              </div>
            </div>

            {/* Quick Helper Chips for Support */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/30 text-[11px]">
              <span className="text-muted-foreground font-semibold">Быстрый подбор:</span>
              <button
                type="button"
                onClick={() => handleQuickAmountRange(100, 500)}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/40 font-mono transition-colors cursor-pointer"
              >
                100–500 ₽
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmountRange(500, 1000)}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/40 font-mono transition-colors cursor-pointer"
              >
                500–1000 ₽
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmountRange(1000, 5000)}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/40 font-mono transition-colors cursor-pointer"
              >
                1000–5000 ₽
              </button>
              <button
                type="button"
                onClick={() => handleLostPaymentTolerance(500)}
                className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Искать пополнения ~500 ₽ (450–550 ₽) за последние 3 дня"
              >
                <span>🔍 Около 500 ₽ (±10%)</span>
              </button>
              <button
                type="button"
                onClick={() => handleLostPaymentTolerance(1000)}
                className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                title="Искать пополнения ~1000 ₽ (900–1100 ₽) за последние 3 дня"
              >
                <span>🔍 Около 1000 ₽ (±10%)</span>
              </button>
            </div>
          </div>
        )}

        {/* Row 3: Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pt-1 border-t border-border/40">
          {TYPE_OPTIONS.map(to => {
            const isActive = type === to.id;
            return (
              <button
                key={to.id}
                type="button"
                onClick={() => handleTypeChange(to.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap border ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'bg-background text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground'
                }`}
              >
                {to.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Ledger Table Card */}
      <div className="bg-card border border-border/70 rounded-lg overflow-hidden shadow-xs">
        {/* Table Top Header with Count & Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:px-4 border-b border-border/60 bg-muted/15">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
            <span>Транзакции</span>
            {search && <span className="font-mono text-[11px] text-primary bg-primary/10 px-2 py-0.5 rounded-md">«{search}»</span>}
            <span className="text-muted-foreground font-medium text-xs">({data.items.length} из {(data.totalCount ?? data.items.length).toLocaleString('ru-RU')})</span>
          </h3>

          {data.totalPages > 1 && (
            <NumberedPagination
              totalCount={data.totalCount}
              currentPage={data.currentPage}
              totalPages={data.totalPages}
              pageSize={data.pageSize}
              itemLabel="транзакций"
              variant="compact"
            />
          )}
        </div>

        {/* Dense Responsive Table — STRICT ZERO HORIZONTAL SCROLL */}
        <div className="w-full">
          <table className="w-full text-xs text-left border-collapse table-auto">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <th className="px-2.5 py-2.5">Клиент</th>
                <th className="px-2 py-2.5">UUID / Шлюз ID</th>
                <th className="px-2 py-2.5">Дата / Время</th>
                <th className="px-2 py-2.5">Тип</th>
                <th className="px-2.5 py-2.5 text-right">Сумма</th>
                <th className="px-2.5 py-2.5">Основание</th>
                <th className="px-2 py-2.5 text-center">Инициатор</th>
                <th className="px-2.5 py-2.5 text-center">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <ArrowLeftRight className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-sm font-semibold">Финансовых записей не найдено</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">Попробуйте изменить период или сбросить фильтры</p>
                  </td>
                </tr>
              ) : (
                data.items.map((entry) => {
                  const resolvedType = resolveLedgerTypeForDisplay(entry.transactionType, entry.amount, entry.adminId);
                  const cfg = LEDGER_TYPE_CONFIG[resolvedType] || LEDGER_TYPE_CONFIG.TOPUP;
                  const isPositive = entry.amount > 0;
                  const isNegative = entry.amount < 0;
                  const displayUuid = entry.idempotencyKey || entry.id;

                  return (
                    <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                      {/* 1. Client Email & ID */}
                      <td className="px-2.5 py-2">
                        <div className="flex flex-col min-w-0 max-w-[140px]">
                          <Link
                            href={`/admin/clients/${entry.userId}`}
                            className="text-primary hover:underline font-mono text-xs font-bold truncate flex items-center gap-0.5"
                            title={entry.userEmail}
                          >
                            <span className="truncate">{entry.userEmail}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                          </Link>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                            <span>ID: {entry.userId.slice(0, 7)}...</span>
                            <CopyBtn text={entry.userId} />
                          </div>
                        </div>
                      </td>

                      {/* 2. ID / UUID проводки & Gateway Key */}
                      <td className="px-2 py-2 font-mono text-[11px] whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span
                              className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border/50 text-[10px] font-bold truncate max-w-[110px] inline-block select-all"
                              title={displayUuid}
                            >
                              {displayUuid.startsWith('gateway-credit-')
                                ? `yoo:${displayUuid.replace('gateway-credit-', '').slice(0, 7)}...`
                                : displayUuid.startsWith('gateway-charge-')
                                ? `order:${displayUuid.replace('gateway-charge-', '').slice(0, 6)}...`
                                : displayUuid.startsWith('deposit-')
                                ? `topup:${displayUuid.replace('deposit-', '').slice(0, 6)}...`
                                : `${displayUuid.slice(0, 9)}...`}
                            </span>
                            <CopyBtn text={displayUuid} />
                          </div>
                          {entry.gatewayId && (
                            <div className="flex items-center gap-1">
                              <span
                                className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold truncate max-w-[110px] inline-block select-all"
                                title={`ID платежа в шлюзе: ${entry.gatewayId}`}
                              >
                                {entry.gatewayId.startsWith('test_') ? 'test:' : 'yoo:'}
                                {entry.gatewayId.replace(/^(test_|live_)/, '').slice(0, 8)}...
                              </span>
                              <CopyBtn text={entry.gatewayId} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Date */}
                      <td className="px-2 py-2 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                        <ClientDate date={entry.createdAt} format="datetime" />
                      </td>

                      {/* 4. Type Badge */}
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase border ${cfg.badgeClass}`}>
                          <span>{cfg.emoji}</span>
                          <span className="truncate max-w-[90px]">{cfg.label}</span>
                        </span>
                      </td>

                      {/* 5. Amount */}
                      <td className="px-2.5 py-2 text-right font-mono font-bold whitespace-nowrap text-xs">
                        <span className={
                          isPositive
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : isNegative
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-muted-foreground'
                        }>
                          {fmtRub(entry.amount, true)}
                        </span>
                      </td>

                      {/* 6. Reason / Justification (Smart truncate, full tooltip) */}
                      <td className="px-2.5 py-2 text-foreground text-xs max-w-[150px] lg:max-w-[200px] truncate" title={entry.reason}>
                        {entry.reason || '—'}
                      </td>

                      {/* 7. Initiator */}
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        {entry.adminId ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-mono text-[10px] font-bold border border-purple-500/20">
                            <Shield className="w-2.5 h-2.5" />
                            <span>Оператор</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-[10px] font-medium">
                            <span>Система</span>
                          </span>
                        )}
                      </td>

                      {/* 8. Status */}
                      <td className="px-2.5 py-2 text-center whitespace-nowrap">
                        {entry.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            <span>Исполнено</span>
                          </span>
                        ) : entry.status === 'QUARANTINE' ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                            <Clock className="w-2.5 h-2.5" />
                            <span>Карантин</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                            <Ban className="w-2.5 h-2.5" />
                            <span>{entry.status}</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination & Footer Bar */}
        <div className="p-3 sm:px-4 border-t border-border/70 bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            Показано {data.items.length} из {(data.totalCount ?? data.items.length).toLocaleString('ru-RU')} транзакций
          </span>

          <NumberedPagination
            totalCount={data.totalCount}
            currentPage={data.currentPage}
            totalPages={data.totalPages}
            pageSize={data.pageSize}
            itemLabel="транзакций"
            variant="full"
          />
        </div>
      </div>
    </div>
  );
}
