'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export function TransactionsFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSearch = searchParams.get('search') || '';
  const currentPeriod = searchParams.get('period') || 'month';
  const currentStatus = searchParams.get('status') || 'ALL';
  const currentType   = searchParams.get('type') || 'ALL';
  const currentUserId = searchParams.get('userId') || '';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();

    // Preserve active userId if filtering ledger of a specific client
    if (currentUserId) {
      params.set('userId', currentUserId);
    }

    fd.forEach((value, key) => {
      const valStr = String(value).trim();
      if (valStr && valStr !== 'ALL') {
        params.set(key, valStr);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.currentTarget.form?.requestSubmit();
  };

  const handleReset = () => {
    if (currentUserId) {
      router.push(`${pathname}?userId=${currentUserId}`);
    } else {
      router.push(pathname);
    }
  };

  const QUICK_PERIODS = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: '7 дней' },
    { value: 'month', label: '30 дней' },
    { value: 'all', label: 'Все время' },
  ];

  const QUICK_TYPES = [
    { label: '💳 Пополнения',    type: 'TOPUP',        status: 'ALL' },
    { label: '🛒 Оплата заказов', type: 'ORDER_CHARGE',  status: 'ALL' },
    { label: '🚫 Отмены',         type: 'ORDER_CANCEL',  status: 'ALL' },
    { label: '↩️ Авто-возвраты',  type: 'REFUND',        status: 'ALL' },
    { label: '🔄 Перезапуски',    type: 'REROUTE',       status: 'ALL' },
    { label: '🎁 Бонусы',         type: 'COMPENSATION',  status: 'ALL' },
    { label: '⚙️ Корректировки',  type: 'ADJUSTMENT',    status: 'ALL' },
    { label: '⏳ В карантине',    type: 'ALL',           status: 'QUARANTINE' },
    { label: '📋 Все',            type: 'ALL',           status: 'ALL' },
  ];

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5 space-y-4">
      {/* Quick Operation Type Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2 shrink-0">Тип:</span>
        {QUICK_TYPES.map((q) => {
          const isActive = currentType === q.type && currentStatus === q.status;
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete('cursor');
                if (q.type !== 'ALL') params.set('type', q.type);
                else params.delete('type');
                if (q.status !== 'ALL') params.set('status', q.status);
                else params.delete('status');
                router.push(`${pathname}?${params.toString()}`);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap active:scale-95 cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/40'
              }`}
            >
              {q.label}
            </button>
          );
        })}
      </div>

      {/* Quick Period Filters */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2 shrink-0">Период:</span>
        {QUICK_PERIODS.map((p) => {
          const isActive = currentPeriod === p.value;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                params.delete('cursor'); // Reset pagination
                params.set('period', p.value);
                router.push(`${pathname}?${params.toString()}`);
              }}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-background hover:bg-muted/50 text-muted-foreground hover:text-foreground border border-border/40'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Main Filter Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        {/* Hidden period for form submission to preserve active period pill */}
        <input type="hidden" name="period" value={currentPeriod} />

        {/* General Search Input */}
        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Поиск</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
            <input
              type="text"
              name="search"
              defaultValue={currentSearch}
              placeholder="Email клиента, ID транзакции или Idempotency Key..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Type Select */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Вид операции</label>
          <select
            name="type"
            value={currentType}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 text-xs bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
          >
            <option value="ALL">Все операции</option>
            <option value="TOPUP">💳 Пополнение баланса</option>
            <option value="ORDER_CHARGE">🛒 Оплата заказа</option>
            <option value="ORDER_CANCEL">🚫 Отмена заказа</option>
            <option value="REFUND">↩️ Авто-возврат средств</option>
            <option value="REROUTE">🔄 Перезапуск заказа</option>
            <option value="COMPENSATION">🎁 Компенсация / Бонус</option>
            <option value="ADJUSTMENT">⚙️ Корректировка оператором</option>
          </select>
        </div>

        {/* Status Select */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Статус проводки</label>
          <select
            name="status"
            value={currentStatus}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 text-xs bg-background/50 border border-border/60 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-foreground"
          >
            <option value="ALL">Все статусы</option>
            <option value="APPROVED">Одобрено (Approved)</option>
            <option value="QUARANTINE">В карантине (Quarantine)</option>
            <option value="REJECTED">Отклонено (Rejected)</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button type="submit" className="flex-1 rounded-xl text-xs py-2">
            Применить
          </Button>
          <Button
            type="button"
            intent="outline"
            onClick={handleReset}
            className="rounded-xl p-2.5 flex items-center justify-center shrink-0"
            title="Сбросить фильтры"
          >
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </form>
    </div>
  );
}
