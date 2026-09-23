'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateBalanceAction } from '@/actions/admin/users';
import {
  Zap,
  PlusCircle,
  MinusCircle,
  Lock,
} from 'lucide-react';
import { UserDTO, PaymentDTO, OrderDTO } from './types';
import { BalanceEquationCard } from './balance-equation-card';
import { BalancePredictiveChips } from './balance-predictive-chips';

interface BalanceTerminalFormProps {
  user: UserDTO;
  orders: OrderDTO[];
  payments: PaymentDTO[];
}

export function BalanceTerminalForm({ user, orders, payments }: BalanceTerminalFormProps) {
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amountRub, setAmountRub] = useState('');
  const [reasonCode, setReasonCode] = useState('GOODWILL_LOYALTY');
  const [customReason, setCustomReason] = useState('');
  const [isPendingBalance, startBalanceTransition] = useTransition();
  const [balanceIdempotencyKey, setBalanceIdempotencyKey] = useState<string>(
    () => `balance-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );

  const currentBalanceRub = (user.balance || 0) / 100;
  const parsedAmountRub = parseFloat(amountRub) || 0;
  const validPositiveAmount = parsedAmountRub > 0 ? parsedAmountRub : 0;
  const rawCents = Math.round(validPositiveAmount * 100);
  const signedAmountCents = direction === 'CREDIT' ? rawCents : -rawCents;
  const projectedBalanceRub =
    direction === 'CREDIT'
      ? currentBalanceRub + validPositiveAmount
      : currentBalanceRub - validPositiveAmount;
  const isOverdraft = direction === 'DEBIT' && projectedBalanceRub < 0;

  const applyPredictiveChip = (
    amount: number,
    code: string,
    noteText: string,
    dir: 'CREDIT' | 'DEBIT' = 'CREDIT'
  ) => {
    setDirection(dir);
    setAmountRub(amount.toFixed(2));
    setReasonCode(code);
    setCustomReason(noteText);
    toast.success(`Подставлена сумма ${amount.toFixed(2)} ₽ из контекста`);
  };

  const handleBalanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPendingBalance) return;
    if (validPositiveAmount <= 0) {
      toast.error('Укажите сумму больше 0 ₽');
      return;
    }
    if (isOverdraft) {
      toast.error('Списание превышает доступный баланс клиента');
      return;
    }
    const finalReason = customReason.trim() || reasonCode;
    if (finalReason.length < 5) {
      toast.error('Обоснование должно содержать минимум 5 символов');
      return;
    }

    startBalanceTransition(async () => {
      const fd = new FormData();
      fd.append('userId', user.id);
      fd.append('amount', signedAmountCents.toString());
      fd.append('reason', finalReason);
      fd.append('idempotencyKey', balanceIdempotencyKey);

      const res = await updateBalanceAction(fd);
      if (res.success) {
        toast.success(res.message || 'Баланс успешно обновлен');
        setAmountRub('');
        setCustomReason('');
        setBalanceIdempotencyKey(
          `balance-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        );
      } else {
        toast.error(res.error || 'Ошибка при изменении баланса');
      }
    });
  };

  return (
    <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5 space-y-5">
      <div className="flex items-center justify-between border-b border-border/50 pb-4">
        <div>
          <h3 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-primary/10 text-primary p-1.5 rounded-lg">
              <Zap className="w-4 h-4" />
            </span>
            Терминал изменения баланса
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ручное начисление или списание средств оператором поддержки
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Текущий баланс
          </span>
          <span className="text-xl font-black text-foreground font-mono">
            {currentBalanceRub.toLocaleString('ru-RU', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            ₽
          </span>
        </div>
      </div>

      {/* 1. Explicit Direction Segmented Control */}
      <div className="grid grid-cols-2 gap-3 p-1.5 bg-muted/40 rounded-2xl border border-border/50">
        <button
          type="button"
          onClick={() => setDirection('CREDIT')}
          className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer select-none border ${
            direction === 'CREDIT'
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 shadow-xs ring-1 ring-emerald-500/20'
              : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>➕ Начислить (Credit)</span>
        </button>
        <button
          type="button"
          onClick={() => setDirection('DEBIT')}
          className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer select-none border ${
            direction === 'DEBIT'
              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 shadow-xs ring-1 ring-rose-500/20'
              : 'bg-transparent text-muted-foreground border-transparent hover:text-foreground'
          }`}
        >
          <MinusCircle className="w-4 h-4" />
          <span>➖ Списать (Debit)</span>
        </button>
      </div>

      {/* 2. Predictive Context Chips */}
      <BalancePredictiveChips
        orders={orders}
        payments={payments}
        onApplyChip={applyPredictiveChip}
      />

      <form onSubmit={handleBalanceSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5 block">
            Сумма операции (в рублях)
          </label>
          <div className="relative flex items-center">
            <span
              className={`absolute left-4 font-mono font-black text-2xl ${
                direction === 'CREDIT' ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {direction === 'CREDIT' ? '+' : '−'}
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amountRub}
              onChange={e => setAmountRub(e.target.value)}
              placeholder="0.00"
              required
              className="w-full h-14 text-2xl pl-10 pr-12 rounded-2xl border border-border/60 bg-background/50 shadow-sm text-foreground font-mono tracking-tight font-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <span className="absolute right-4 text-base font-mono font-bold text-muted-foreground">
              ₽
            </span>
          </div>
        </div>

        {/* Live Equation Projection Card */}
        <BalanceEquationCard
          currentBalanceRub={currentBalanceRub}
          parsedAmountRub={parsedAmountRub}
          direction={direction}
          projectedBalanceRub={projectedBalanceRub}
          isOverdraft={isOverdraft}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5 block">
              Причина ({direction === 'CREDIT' ? 'начисления' : 'списания'})
            </label>
            <select
              value={reasonCode}
              onChange={e => setReasonCode(e.target.value)}
              className="w-full h-11 text-xs px-3 py-2 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary transition-all font-medium cursor-pointer"
            >
              {direction === 'CREDIT' ? (
                <>
                  <option value="ORDER_DELAY_COMPENSATION">⏱️ Компенсация за задержку заказа</option>
                  <option value="PROVIDER_ERROR">⚠️ Ошибка провайдера (сбой)</option>
                  <option value="GOODWILL_LOYALTY">🎁 Лояльность / Бонус клиенту</option>
                  <option value="MANUAL_CORRECTION">🛠️ Ручное пополнение / Корректировка</option>
                </>
              ) : (
                <>
                  <option value="MANUAL_CORRECTION">🛠️ Корректировка ошибочного начисления</option>
                  <option value="CHARGEBACK_PENALTY">🚫 Штраф / Чарджбэк платежа</option>
                  <option value="WITHDRAWAL">💳 Списание по запросу клиента (вывод)</option>
                  <option value="TECH_ADJUSTMENT">⚙️ Техническая корректировка баланса</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>
                Обоснование для аудита <span className="text-destructive">*</span>
              </span>
              <span className="text-[10px] text-muted-foreground">min 5 симв.</span>
            </label>
            <input
              name="reasonNote"
              value={customReason}
              onChange={e => setCustomReason(e.target.value)}
              minLength={5}
              placeholder="Номер тикета или причина..."
              required
              className="w-full h-11 text-xs px-3 py-2 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary transition-all font-medium"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isPendingBalance || isOverdraft || parsedAmountRub <= 0}
          className={`w-full h-12 text-sm font-black rounded-xl shadow-sm active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed ${
            direction === 'CREDIT'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-rose-600 hover:bg-rose-700'
          }`}
        >
          {isPendingBalance ? (
            <span className="inline-flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Обработка операции...
            </span>
          ) : (
            <>
              <Lock className="w-4 h-4 opacity-70" />
              {direction === 'CREDIT' ? (
                <span>
                  Начислить +{parsedAmountRub > 0 ? parsedAmountRub.toFixed(2) : '0.00'} ₽ на
                  баланс
                </span>
              ) : (
                <span>
                  Списать −{parsedAmountRub > 0 ? parsedAmountRub.toFixed(2) : '0.00'} ₽ с
                  баланса
                </span>
              )}
            </>
          )}
        </button>
      </form>
    </div>
  );
}
