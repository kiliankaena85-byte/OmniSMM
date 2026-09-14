'use client';

import { useState, useTransition, useCallback } from 'react';
import { toast } from 'sonner';
import { getPaymentsAction, type PaymentsPageResult, type PaymentDTO } from '@/actions/admin/finance/payments';
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
import { columns as paymentColumns } from '../payment-columns';
import { 
  Download, 
  RotateCcw,
  Search
} from 'lucide-react';
import { 
  PERIOD_OPTIONS, 
  PAYMENT_STATUS_OPTIONS, 
  GATEWAY_OPTIONS, 
  downloadCsvExport, 
  renderMobilePayments 
} from './finance-helpers';
import { 
  ManualPaymentApprovalModal, 
  PendingPaymentTarget 
} from '@/components/admin/finance/manual-payment-approval-modal';

export interface FinancePaymentsTabProps {
  initial: PaymentsPageResult;
  period: string;
  tenantId?: string;
}

export function FinancePaymentsTab({ initial, period: initPeriod, tenantId }: FinancePaymentsTabProps) {
  const [period, setPeriod]       = useState(initPeriod);
  const [status, setStatus]       = useState<string>('ALL');
  const [gateway, setGateway]     = useState<string>('ALL');
  const [search, setSearch]       = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [dateFrom, setDateFrom]   = useState<string>('');
  const [dateTo, setDateTo]       = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [data,   setData]         = useState<PaymentsPageResult>(initial);
  const [approvalTarget, setApprovalTarget] = useState<PendingPaymentTarget | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback((
    newPeriod: string,
    newStatus: string,
    newGateway: string,
    newSearch: string,
    newMinAmount = minAmount,
    newMaxAmount = maxAmount,
    newDateFrom = dateFrom,
    newDateTo = dateTo
  ) => {
    startTransition(async () => {
      const parsedMin = newMinAmount !== '' ? parseFloat(newMinAmount.replace(',', '.')) : undefined;
      const parsedMax = newMaxAmount !== '' ? parseFloat(newMaxAmount.replace(',', '.')) : undefined;

      const r = await getPaymentsAction({
        period:   newPeriod as 'today' | 'week' | 'month' | 'all',
        status:   newStatus as 'ALL' | 'SUCCEEDED' | 'PENDING' | 'CANCELED',
        gateway:  newGateway === 'ALL' ? undefined : newGateway,
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
    load(v, status, gateway, search, minAmount, maxAmount, '', '');
  }

  function applyStatus(v: string | null) {
    if (!v) return;
    setStatus(v);
    load(period, v, gateway, search, minAmount, maxAmount, dateFrom, dateTo);
  }

  function applyGateway(v: string | null) {
    if (!v) return;
    setGateway(v);
    load(period, status, v, search, minAmount, maxAmount, dateFrom, dateTo);
  }

  function applySearch(val: string) {
    setSearch(val);
    load(period, status, gateway, val, minAmount, maxAmount, dateFrom, dateTo);
  }

  function handleApplyFilters() {
    load(period, status, gateway, search, minAmount, maxAmount, dateFrom, dateTo);
    toast.success('Фильтры платежей применены');
  }

  function handleResetFilters() {
    setSearch('');
    setStatus('ALL');
    setGateway('ALL');
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
    load('all', status, gateway, search, min.toString(), max.toString(), dateStr, '');
    toast.info(`Поиск оплат: ${min}–${max} ₽ за 3 дня`);
  }

  const activeFiltersCount = [
    status !== 'ALL',
    gateway !== 'ALL',
    Boolean(search.trim()),
    Boolean(minAmount),
    Boolean(maxAmount),
    Boolean(dateFrom),
    Boolean(dateTo),
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Action Bar: Filters, Search & 1-Click CSV Export */}
      <div className="space-y-3 p-4 rounded-lg border border-border/70 bg-card/60 backdrop-blur-md shadow-xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
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
                    {(value: string) => PAYMENT_STATUS_OPTIONS.find(s => s.value === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value} label={s.label}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Шлюз:</span>
              <Select defaultValue={gateway} onValueChange={applyGateway}>
                <SelectTrigger className="w-[130px] h-9 text-xs" size="sm">
                  <SelectValue placeholder="Шлюз">
                    {(value: string) => GATEWAY_OPTIONS.find(g => g.value === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GATEWAY_OPTIONS.map(g => (
                    <SelectItem key={g.value} value={g.value} label={g.label}>{g.label}</SelectItem>
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
              onClick={() => load(period, status, gateway, search, minAmount, maxAmount, dateFrom, dateTo)}
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
              onClick={() => downloadCsvExport({ type: 'payments', period, status, tenantId, search })}
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
                  <span>Сумма платежа (₽)</span>
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
                onClick={() => { setMinAmount('100'); setMaxAmount('500'); load(period, status, gateway, search, '100', '500', dateFrom, dateTo); }}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-muted text-foreground border border-border/40 font-mono transition-colors cursor-pointer"
              >
                100–500 ₽
              </button>
              <button
                type="button"
                onClick={() => { setMinAmount('500'); setMaxAmount('1000'); load(period, status, gateway, search, '500', '1000', dateFrom, dateTo); }}
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
          columns={paymentColumns}
          data={data.items}
          renderMobileView={renderMobilePayments}
          meta={{
            onApprovePayment: (p: PaymentDTO) => {
              setApprovalTarget({
                id: p.id,
                userEmail: p.userEmail,
                amountCents: p.amount,
                gateway: p.gateway,
                gatewayId: p.gatewayId,
                createdAt: p.createdAt,
              });
            },
          }}
        />
      </div>

      {approvalTarget && (
        <ManualPaymentApprovalModal
          payment={approvalTarget}
          currentUserRole="ADMIN"
          supportLimitRub={3000}
          onClose={() => setApprovalTarget(null)}
          onSuccess={() => {
            setApprovalTarget(null);
            load(period, status, gateway, search);
          }}
        />
      )}
    </div>
  );
}
