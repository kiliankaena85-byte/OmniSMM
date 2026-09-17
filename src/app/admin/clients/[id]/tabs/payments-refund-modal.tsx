'use client';

import React, { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { requestCardRefundAction } from '@/actions/admin/users';
import { RotateCcw, Shield, X } from 'lucide-react';
import { UserDTO, PaymentDTO } from './types';

interface PaymentsRefundModalProps {
  user: UserDTO;
  payment: PaymentDTO | null;
  currentBalanceRub: number;
  onClose: () => void;
}

export function PaymentsRefundModal({
  user,
  payment,
  currentBalanceRub,
  onClose,
}: PaymentsRefundModalProps) {
  const [refundAmountRub, setRefundAmountRub] = useState(payment ? payment.amountRub.toString() : '');
  const [refundReason, setRefundReason] = useState('Возврат средств по запросу клиента');
  const [isPendingRefund, startRefundTransition] = useTransition();
  const [refundIdempotencyKey, setRefundIdempotencyKey] = useState<string>(
    () => `refund-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  );

  if (!payment) return null;

  const handleCardRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPendingRefund) return;

    const val = parseFloat(refundAmountRub);
    if (isNaN(val) || val <= 0) {
      toast.error('Укажите корректную сумму возврата');
      return;
    }
    if (val > payment.amountRub) {
      toast.error(
        `Сумма возврата не может превышать исходный платеж (${payment.amountRub.toFixed(2)} ₽)`
      );
      return;
    }
    if (val > currentBalanceRub) {
      toast.error(
        `Недостаточно средств на балансе клиента (${currentBalanceRub.toFixed(2)} ₽) для списания`
      );
      return;
    }

    startRefundTransition(async () => {
      const fd = new FormData();
      fd.append('userId', user.id);
      fd.append('paymentId', payment.id);
      fd.append('amountKopecks', Math.round(val * 100).toString());
      fd.append('reason', refundReason.trim());
      fd.append('idempotencyKey', refundIdempotencyKey);

      const res = await requestCardRefundAction(fd);
      if (res.success) {
        toast.success(
          res.message || 'Средства списаны с баланса. Заявка на возврат передана финансисту'
        );
        onClose();
        setRefundAmountRub('');
        setRefundIdempotencyKey(
          `refund-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        );
      } else {
        toast.error(res.error || 'Ошибка при создании заявки на возврат');
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-card border border-border shadow-2xl rounded-2xl max-w-md w-full p-6 space-y-4 relative ring-1 ring-border/20">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-amber-500/10 text-amber-600 p-1 rounded-md">
              <RotateCcw className="w-4 h-4" />
            </span>
            Оформление возврата на карту
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-muted/40 p-3 rounded-xl border border-border/50 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Шлюз оплаты:</span>
            <span className="font-bold uppercase text-foreground">
              {payment.gateway}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">ID транзакции:</span>
            <span className="font-bold text-foreground truncate max-w-[180px]">
              {payment.gatewayId || payment.id}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Сумма пополнения:</span>
            <span className="font-bold text-foreground">
              {payment.amountRub.toFixed(2)} ₽
            </span>
          </div>
          <div className="flex justify-between border-t border-border/40 pt-1">
            <span className="text-muted-foreground">Текущий баланс клиента:</span>
            <span className="font-bold text-primary">{currentBalanceRub.toFixed(2)} ₽</span>
          </div>
        </div>

        {payment.gateway.toLowerCase() !== 'yookassa' && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/25 rounded-xl text-[11px] text-amber-700 dark:text-amber-400">
            ℹ️ Эквайринг {payment.gateway.toUpperCase()} не поддерживает прямой автовозврат по API. После утверждения заявки возврат оформляется вручную в личном кабинете эквайринга.
          </div>
        )}

        <form onSubmit={handleCardRefundSubmit} className="space-y-3.5">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
              <span>Сумма к возврату (в рублях)</span>
              <span
                className="text-[10px] font-bold text-primary cursor-pointer hover:underline"
                onClick={() => setRefundAmountRub(payment.amountRub.toString())}
              >
                Вся сумма: {payment.amountRub.toFixed(2)} ₽
              </span>
            </label>
            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={payment.amountRub}
                value={refundAmountRub}
                onChange={e => setRefundAmountRub(e.target.value)}
                required
                className="w-full h-9 text-sm pl-3 pr-8 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground font-mono font-bold outline-none focus:border-primary transition-all"
              />
              <span className="absolute right-3 text-xs font-mono font-bold text-muted-foreground">
                ₽
              </span>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1 block">
              Причина возврата (для заявления и чека 54-ФЗ)
            </label>
            <input
              type="text"
              value={refundReason}
              onChange={e => setRefundReason(e.target.value)}
              required
              className="w-full h-9 text-xs px-3 rounded-xl border border-border/60 bg-background/50 shadow-sm text-foreground outline-none focus:border-primary transition-all"
            />
          </div>

          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
            <p className="font-bold flex items-center gap-1">
              <Shield className="w-3.5 h-3.5" /> Двухэтапный регламент возврата:
            </p>
            <p>
              Сумма будет <strong>зарезервирована с баланса клиента</strong>, а заявка передана
              финансисту/руководителю. При одобрении средства автоматически отправятся на карту
              через API ЮKassa с фискальным чеком 54-ФЗ. При отклонении — вернутся на баланс.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 rounded-xl text-xs font-bold bg-muted text-muted-foreground hover:text-foreground border border-border/60 transition-all cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isPendingRefund}
              className="flex-2 h-9 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-primary-foreground shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isPendingRefund ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Резервирование...
                </span>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Создать заявку на возврат</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
