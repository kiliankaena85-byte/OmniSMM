'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { PaymentDTO, OrderDTO } from './types';

interface BalancePredictiveChipsProps {
  orders: OrderDTO[];
  payments: PaymentDTO[];
  onApplyChip: (amount: number, code: string, noteText: string, dir?: 'CREDIT' | 'DEBIT') => void;
}

export function BalancePredictiveChips({
  orders,
  payments,
  onApplyChip,
}: BalancePredictiveChipsProps) {
  const problematicOrders = orders.filter(o =>
    ['CANCELED', 'PARTIAL', 'REFUNDED'].includes(o.status)
  );
  const recentSuccessfulPayment = payments.find(p => p.status === 'SUCCEEDED');

  if (problematicOrders.length === 0 && !recentSuccessfulPayment) {
    return null;
  }

  return (
    <div className="space-y-1.5 p-3.5 rounded-xl bg-muted/20 border border-border/40">
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
        <Sparkles className="w-3.5 h-3.5 text-primary" /> Предиктивные подсказки контекста
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {problematicOrders.slice(0, 2).map(po => (
          <button
            key={po.id}
            type="button"
            onClick={() =>
              onApplyChip(
                po.chargeRub,
                'ORDER_DELAY_COMPENSATION',
                `Компенсация по заказу #${po.numericId || po.id.slice(-4)} (${po.serviceName})`,
                'CREDIT'
              )
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <span>
              Заказ #{po.numericId || po.id.slice(-4)} ({po.chargeRub.toFixed(2)} ₽)
            </span>
          </button>
        ))}
        {recentSuccessfulPayment && (
          <button
            key={recentSuccessfulPayment.id}
            type="button"
            onClick={() =>
              onApplyChip(
                recentSuccessfulPayment.amountRub,
                'GOODWILL_LOYALTY',
                `Бонус лояльности (${recentSuccessfulPayment.gateway.toUpperCase()})`,
                'CREDIT'
              )
            }
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-xs font-medium transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <span>
              Пополнение ({recentSuccessfulPayment.amountRub.toFixed(2)} ₽)
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
