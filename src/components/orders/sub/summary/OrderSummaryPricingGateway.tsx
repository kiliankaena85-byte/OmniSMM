import React from 'react';
import { CreditCard, Wallet, Bitcoin } from 'lucide-react';
import type { PaymentGateway } from './types';

interface OrderSummaryPricingGatewayProps {
  totalPriceFormatted: string;
  totalPrice: number;
  isCalculating: boolean;
  gateway: PaymentGateway;
  setGateway: (val: PaymentGateway) => void;
}

export function OrderSummaryPricingGateway({
  totalPriceFormatted,
  totalPrice,
  isCalculating,
  gateway,
  setGateway,
}: OrderSummaryPricingGatewayProps) {
  return (
    <>
      {/* Price */}
      <div className="border-t border-border pt-5 flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          Итого к оплате
        </span>
        <div className="text-right">
          <span className="text-3xl font-black text-foreground tabular-nums font-mono tracking-tight">
            {totalPriceFormatted}
          </span>
          <span className="text-lg font-black text-muted-foreground ml-1">₽</span>
          {isCalculating && (
            <div className="text-[10px] text-primary font-bold uppercase tracking-wider">
              Считаем...
            </div>
          )}
        </div>
      </div>

      {/* Gateway Selection */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Способ оплаты
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setGateway('yookassa')}
            className={`flex-1 min-w-[100px] max-w-full flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
              gateway === 'yookassa'
                ? 'border-primary bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <CreditCard className="w-4 h-4" /> СБП / Карта
          </button>
          <button
            type="button"
            onClick={() => setGateway('balance')}
            className={`flex-1 min-w-[100px] max-w-full flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
              gateway === 'balance'
                ? 'border-success/30 bg-success/10 text-success-text shadow-sm ring-1 ring-success/20'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <Wallet className="w-4 h-4" /> Баланс
          </button>
          <button
            type="button"
            onClick={() => setGateway('cryptobot')}
            className={`flex-1 min-w-[100px] max-w-full flex items-center justify-center gap-1.5 p-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
              gateway === 'cryptobot'
                ? 'border-warning/30 bg-warning/10 text-warning-text shadow-sm ring-1 ring-warning/20'
                : 'border-border bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            <Bitcoin className="w-4 h-4" /> Крипто
          </button>
        </div>
      </div>

      {gateway !== 'balance' && totalPrice > 0 && totalPrice < 10 && (
        <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 text-warning-text text-xs leading-relaxed space-y-2 animate-in fade-in duration-300">
          <div className="font-bold flex items-center gap-1.5 text-warning-text">
            <span>💡</span> Минимальный платеж эквайринга — 10 ₽
          </div>
          <div>
            Платежные системы технически не принимают оплату картой менее 10 ₽. Мы выставим счет на{' '}
            <strong>10 ₽</strong>: из них <strong>{totalPriceFormatted} ₽</strong> пойдет на этот
            заказ, а сдача <strong>{(10 - totalPrice).toFixed(2)} ₽</strong> будет зачислена на
            ваш баланс для будущих тестов.
          </div>
        </div>
      )}
    </>
  );
}
