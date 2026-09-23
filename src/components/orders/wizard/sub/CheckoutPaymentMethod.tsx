'use client';
import React from 'react';
import { Wallet, CreditCard, ShieldCheck } from 'lucide-react';
import { formatCents } from '@/lib/utils';
import { PaymentGateway, AvailableGateways } from '../types';

interface CheckoutPaymentMethodProps {
  gateway: PaymentGateway;
  setGateway: (g: PaymentGateway) => void;
  userBalanceCents: number;
  calculatedPriceRub?: number | null;
  availableGateways: AvailableGateways | null;
}

export function CheckoutPaymentMethod({ 
  gateway, 
  setGateway, 
  userBalanceCents, 
  calculatedPriceRub,
  availableGateways 
}: CheckoutPaymentMethodProps) {
  const totalCostCents = Math.round((calculatedPriceRub || 0) * 100);
  const hasBalance = userBalanceCents > 0;
  const isBalanceSufficient = hasBalance && userBalanceCents >= totalCostCents && totalCostCents > 0;
  const deficitRub = !isBalanceSufficient && totalCostCents > 0
    ? Math.max(0, (totalCostCents - userBalanceCents) / 100).toFixed(2)
    : null;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-foreground block">Способ оплаты</label>
        {isBalanceSufficient && (
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            Рекомендуем: оплата в 1 клик
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setGateway('balance')}
          className={`min-h-[52px] p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer active:scale-[0.99] ${
            gateway === 'balance'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
              : 'border-border/60 bg-background/60 hover:bg-card'
          }`}
        >
          <Wallet className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold block text-foreground">С баланса</span>
            <span className="text-[11px] text-muted-foreground block truncate min-w-0">
              {isBalanceSufficient
                ? `Доступно: ${formatCents(userBalanceCents)} ₽`
                : deficitRub
                ? `Не хватает ${deficitRub} ₽`
                : `Доступно: ${formatCents(userBalanceCents)} ₽`}
            </span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setGateway('yookassa')}
          className={`min-h-[52px] p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer active:scale-[0.99] ${
            gateway === 'yookassa'
              ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
              : 'border-border/60 bg-background/60 hover:bg-card'
          }`}
        >
          <CreditCard className="w-5 h-5 text-primary shrink-0" />
          <div>
            <span className="text-xs font-bold block text-foreground">СБП / Карты</span>
            <span className="text-[11px] text-muted-foreground block">Мгновенно • 0%</span>
          </div>
        </button>
        {availableGateways?.cryptobot && (
          <button
            type="button"
            onClick={() => setGateway('cryptobot')}
            className={`min-h-[52px] p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer active:scale-[0.99] ${
              gateway === 'cryptobot'
                ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                : 'border-border/60 bg-background/60 hover:bg-card'
            }`}
          >
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold block text-foreground">CryptoBot</span>
              <span className="text-[11px] text-muted-foreground block">USDT / Кратко</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
