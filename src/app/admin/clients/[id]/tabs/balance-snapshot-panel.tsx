'use client';

import React from 'react';
import { Shield, CreditCard } from 'lucide-react';
import { PaymentDTO, OrderDTO } from './types';

interface BalanceSnapshotPanelProps {
  payments: PaymentDTO[];
  orders: OrderDTO[];
  totalSpentRub: number;
  onNavigateToPayments: () => void;
  totalDepositedRub?: number;
  paymentsCount?: number;
  ordersCount?: number;
}

export function BalanceSnapshotPanel({
  payments,
  orders,
  totalSpentRub,
  onNavigateToPayments,
  totalDepositedRub: propDepositedRub,
  paymentsCount: propPaymentsCount,
  ordersCount: propOrdersCount,
}: BalanceSnapshotPanelProps) {
  const fallbackDepositedRub = payments
    .filter(p => p.status === 'SUCCEEDED')
    .reduce((acc, p) => acc + p.amountRub, 0);

  const totalDepositedRub = propDepositedRub !== undefined ? propDepositedRub : fallbackDepositedRub;
  const paymentsCount = propPaymentsCount !== undefined ? propPaymentsCount : payments.filter(p => p.status === 'SUCCEEDED').length;
  const ordersCount = propOrdersCount !== undefined ? propOrdersCount : orders.length;

  return (
    <div className="space-y-6">
      {/* Financial Overview Card */}
      <div className="bg-card/60 backdrop-blur-md border border-border/50 shadow-sm rounded-2xl p-6 ring-1 ring-border/5 space-y-4">
        <h4 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-2 border-b border-border/50 pb-3">
          <CreditCard className="w-4 h-4 text-primary" />
          Финансовая сводка клиента
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
              Всего пополнений
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {totalDepositedRub.toLocaleString('ru-RU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ₽
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
              Всего потрачено
            </span>
            <span className="text-lg font-black text-foreground font-mono">
              {totalSpentRub.toLocaleString('ru-RU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ₽
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
              Платежей проведено
            </span>
            <span className="text-lg font-black text-foreground font-mono">
              {paymentsCount}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-1">
              Заказов оформлено
            </span>
            <span className="text-lg font-black text-foreground font-mono">
              {ordersCount}
            </span>
          </div>
        </div>

        {/* Card Refund Quick Navigation Banner */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3 mt-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-foreground block">
              Возврат средств на карту?
            </span>
            <p className="text-[11px] text-muted-foreground">
              Инициируйте возврат из таблицы платежей
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToPayments}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg shadow-xs hover:bg-primary/90 transition-all cursor-pointer whitespace-nowrap"
          >
            В платежи →
          </button>
        </div>

        {/* Support Policy Notice */}
        <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-1.5 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-bold text-foreground">
            <Shield className="w-3.5 h-3.5 text-primary" /> Правило финансового аудита:
          </div>
          <p>
            Все операции баланса логируются в журнал аудита с фиксацией IP, User-Agent и
            причины. Списания проверяются на овердрафт.
          </p>
        </div>
      </div>
    </div>
  );
}
