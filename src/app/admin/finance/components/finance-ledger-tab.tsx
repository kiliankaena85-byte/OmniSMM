'use client';

import { useState, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import { getLedgerAction, type LedgerPageResult } from '@/actions/admin/finance/ledger';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/ui/data-table';
import { columns } from '../ledger-columns';
import { 
  Download, 
  RotateCcw,
  CheckCircle2,
  Clock,
  Ban,
  Search
} from 'lucide-react';
import { 
  PERIOD_OPTIONS, 
  LEDGER_STATUS_OPTIONS, 
  LEDGER_TYPE_OPTIONS,
  fmt, 
  downloadCsvExport, 
  renderMobileLedger 
} from './finance-helpers';

export interface FinanceLedgerTabProps {
  initial: LedgerPageResult;
  period: string;
  tenantId?: string;
}

export function FinanceLedgerTab({ initial, period: initPeriod, tenantId }: FinanceLedgerTabProps) {
  const [period, setPeriod]       = useState(initPeriod);
  const [status, setStatus]       = useState<string>('ALL');
  const [type, setType]           = useState<string>('ALL');
  const [search, setSearch]       = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [dateFrom, setDateFrom]   = useState<string>('');
  const [dateTo, setDateTo]       = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [data,   setData]         = useState<LedgerPageResult>(initial);
  const [isPending, startTransition] = useTransition();

  const load = useCallback((
    newPeriod: string,
    newStatus: string,
    newType: string,
    newSearch: string,
    newMinAmount = minAmount,
    newMaxAmount = maxAmount,
    newDateFrom = dateFrom,
    newDateTo = dateTo
  ) => {
    startTransition(async () => {
      const parsedMin = newMinAmount !== '' ? parseFloat(newMinAmount.replace(',', '.')) : undefined;
      const parsedMax = newMaxAmount !== '' ? parseFloat(newMaxAmount.replace(',', '.')) : undefined;

      const r = await getLedgerAction({
        period:   newPeriod as 'today' | 'week' | 'month' | 'all',
        status:   newStatus as 'ALL' | 'APPROVED' | 'QUARANTINE' | 'REJECTED',
        type:     newType as any,
        search:   newSearch.trim() || undefined,
        minAmount: !isNaN(parsedMin as number) ? parsedMin : undefined,
        maxAmount: !isNaN(parsedMax as number) ? parsedMax : undefined,
        dateFrom: newDateFrom || undefined,
        dateTo:   newDateTo || undefined,
        pageSize: 100,
        tenantId,
      });
      if (!('error' in r)) {
        setData(r);
      } else {
        toast.error(r.error);
      }
    });
  }, [minAmount, maxAmount, dateFrom, dateTo, tenantId]);

  function applyPeriod(v: string | null) {
    if (!v) return;
    setPeriod(v);
    setDateFrom('');
    setDateTo('');
    load(v, status, type, search, minAmount, maxAmount, '', '');
  }

  function applyStatus(v: string | null) {
    if (!v) return;
    setStatus(v);
    load(period, v, type, search, minAmount, maxAmount, dateFrom, dateTo);
  }

  function applyType(v: string | null) {
    if (!v) return;
    setType(v);
    load(period, status, v, search, minAmount, maxAmount, dateFrom, dateTo);
  }

  function applySearch(val: string) {
    setSearch(val);
    load(period, status, type, val, minAmount, maxAmount, dateFrom, dateTo);
  }

  function setQuickFilter(quickType: string, quickStatus = 'ALL') {
    setType(quickType);
    setStatus(quickStatus);
    load(period, quickStatus, quickType, search, minAmount, maxAmount, dateFrom, dateTo);
  }

  function handleApplyFilters() {
    load(period, status, type, search, minAmount, maxAmount, dateFrom, dateTo);
    toast.success('Фильтры транзакций применены');
  }

  function handleResetFilters() {
    setSearch('');
    setStatus('ALL');
    setType('ALL');
    setPeriod('month');
    setMinAmount('');
    setMaxAmount('');
    setDateFrom('');
    setDateTo('');
    load('month', 'ALL', 'ALL', '', '', '', '', '');
    toast.info('Фильтры сброшены');
  }

  function handleLostPaymentTolerance(target: number) {
    const min = Math.max(0, Math.round(target * 0.9));
    const max = Math.round(target * 1.1);
    setMinAmount(min.toString());
    setMaxAmount(max.toString());
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const dateStr = d.toISOString().slice(0, 10);
    setDateFrom(dateStr);
    setDateTo('');
    setType('TOPUP');
    load('all', status, 'TOPUP', search, min.toString(), max.toString(), dateStr, '');
    toast.info(`Поиск пополнений: ${min}–${max} ₽ за 3 дня`);
  }

  const activeFiltersCount = [
    status !== 'ALL',
    type !== 'ALL',
    Boolean(search.trim()),
    Boolean(minAmount),
    Boolean(maxAmount),
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  const QUICK_FILTERS = [
    { label: '💳 Пополнения',    type: 'TOPUP',        status: 'ALL' },
    { label: '🛒 Оплата заказов', type: 'ORDER_CHARGE',  status: 'ALL' },
    { label: '🚫 Отмены',         type: 'ORDER_CANCEL',  status: 'ALL' },
    { label: '↩️ Авто-возвраты',  type: 'REFUND',        status: 'ALL' },
    { label: '🔄 Перезапуски',    type: 'REROUTE',       status: 'ALL' },
    { label: '🎁 Бонусы',         type: 'COMPENSATION',  status: 'ALL' },
    { label: '⚙️ Корректировки',  type: 'ADJUSTMENT',    status: 'ALL' },
    { label: '⏳ В карантине',    type: 'ALL',           status: 'QUARANTINE' },
    { label: '📋 Все проводки',   type: 'ALL',           status: 'ALL' },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Filter Pills (1-Click Presets) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-1 shrink-0">Быстрый фильтр:</span>
        {QUICK_FILTERS.map((q) => {
          const isActive = type === q.type && status === q.status;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => setQuickFilter(q.type, q.status)}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card/70 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
              }`}
            >
              {q.label}
            </button>
          );
        })}
      </div>

      {/* Totals Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { 
            label: 'Зачислено (Gross)', 
            value: data.totals.approved, 
            color: 'bg-success/10 border-success/20 text-success',
            icon: CheckCircle2,
            sub: 'Подтверждённые проводки'
          },
          { 
            label: 'Возвраты (Refunds)', 
            value: data.totals.refunds, 
            color: 'bg-destructive/10 border-destructive/20 text-destructive',
            icon: Ban,
            sub: 'Списания и возвраты'
          },
          { 
            label: 'В карантине (Escrow)', 
            value: data.totals.quarantine, 
            color: 'bg-warning/10 border-warning/20 text-warning',
            icon: Clock,
            sub: 'Ожидают подтверждения'
          },
        ].map(s => (
          <div 
            key={s.label} 
            className={`${s.color} border rounded-2xl p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:scale-[1.01]`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{s.label}</span>
              <s.icon className="w-4 h-4 opacity-70" />
            </div>
            <div className="text-2xl font-black font-mono tabular-nums tracking-tight">{fmt(s.value)}</div>
            <div className="text-[11px] font-medium opacity-70 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Action Bar: Filters, Search & 1-Click CSV Export */}
      <div className="space-y-3 p-4 rounded-2xl border border-border/70 bg-card/60 backdrop-blur-md shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Transaction Type Filter (with Top-up in first place!) */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Тип:</span>
              <Select defaultValue={type} onValueChange={applyType}>
                <SelectTrigger className="w-[180px] h-9 text-xs" size="sm">
                  <SelectValue placeholder="Тип операции">
                    {(value: string) => LEDGER_TYPE_OPTIONS.find(t => t.value === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LEDGER_TYPE_OPTIONS.map(t => (
                    <SelectItem key={t.value} value={t.value} label={t.label}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Период:</span>
              <Select defaultValue={period} onValueChange={applyPeriod}>
                <SelectTrigger className="w-[130px] h-9 text-xs" size="sm">
                  <SelectValue placeholder="Период">
                    {(value: string) => PERIOD_OPTIONS.find(p => p.value === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map(p => (
                    <SelectItem key={p.value} value={p.value} label={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Статус:</span>
              <Select defaultValue={status} onValueChange={applyStatus}>
                <SelectTrigger className="w-[140px] h-9 text-xs" size="sm">
                  <SelectValue placeholder="Статус">
                    {(value: string) => LEDGER_STATUS_OPTIONS.find(s => s.value === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LEDGER_STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value} label={s.label}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle Range Filters */}
            <Button
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`h-9 gap-1.5 text-xs font-bold border transition-colors ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? 'bg-primary/10 border-primary/40 text-primary hover:bg-primary/20'
                  : 'border-border bg-card hover:bg-muted text-foreground'
              }`}
            >
              <span>Сумма & Даты</span>
              {activeFiltersCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
            </Button>

            <Button
              size="sm"
              onClick={() => load(period, status, type, search, minAmount, maxAmount, dateFrom, dateTo)}
              disabled={isPending}
              className="h-9 px-3 border border-border bg-card hover:bg-muted text-foreground"
              title="Обновить"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Search & Export Buttons */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => applySearch(e.target.value)}
                placeholder="Поиск по email или ID..."
                className="pl-8 h-9 text-xs bg-background/80"
              />
            </div>

            <Button
              size="sm"
              onClick={() => downloadCsvExport({ type: 'ledger', period, status, tenantId, search })}
              className="h-9 gap-1.5 font-bold uppercase tracking-wider text-[11px] shadow-xs shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Экспорт в CSV</span>
            </Button>
          </div>
        </div>

        {/* Expandable Advanced Range Filters */}
        {showAdvancedFilters && (
          <div className="p-3 bg-muted/20 border border-border/60 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* Amount Range */}
              <div className="lg:col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Сумма операции (₽)</span>
                  <span className="text-[10px] text-primary">Поиск потерянных оплат</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    placeholder="От 0 ₽"
                    className="h-8 text-xs bg-background font-mono"
                  />
                  <span className="text-muted-foreground text-xs font-bold">—</span>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="До..."
                    className="h-8 text-xs bg-background font-mono"
                  />
                </div>
              </div>

              {/* Exact Dates */}
              <div className="lg:col-span-5 space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Точный интервал дат
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 text-xs bg-background cursor-pointer"
                  />
                  <span className="text-muted-foreground text-xs font-bold">—</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 text-xs bg-background cursor-pointer"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="lg:col-span-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleApplyFilters}
                  disabled={isPending}
                  className="flex-1 h-8 text-xs font-bold"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Найти</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleResetFilters}
                  disabled={isPending}
                  className="h-8 text-xs font-bold"
                >
                  Сброс
                </Button>
              </div>
            </div>

            {/* Quick Tolerance Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/30 text-[11px]">
              <span className="text-muted-foreground font-semibold">Быстрый подбор:</span>
              <button
                type="button"
                onClick={() => { setMinAmount('100'); setMaxAmount('500'); load(period, status, type, search, '100', '500', dateFrom, dateTo); }}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/40 font-mono transition-colors cursor-pointer"
              >
                100–500 ₽
              </button>
              <button
                type="button"
                onClick={() => { setMinAmount('500'); setMaxAmount('1000'); load(period, status, type, search, '500', '1000', dateFrom, dateTo); }}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/40 font-mono transition-colors cursor-pointer"
              >
                500–1000 ₽
              </button>
              <button
                type="button"
                onClick={() => handleLostPaymentTolerance(500)}
                className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>🔍 Около 500 ₽ (±10%)</span>
              </button>
              <button
                type="button"
                onClick={() => handleLostPaymentTolerance(1000)}
                className="px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>🔍 Около 1000 ₽ (±10%)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main DataTable / Mobile Cards */}
      <div className="w-full">
        <DataTable
          compact={true}
          columns={columns}
          data={data.items}
          renderMobileView={renderMobileLedger}
        />
      </div>
    </div>
  );
}
