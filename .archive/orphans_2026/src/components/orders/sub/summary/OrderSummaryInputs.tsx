import React from 'react';
import { Plus, Minus, Mail } from 'lucide-react';
import type { PublicService } from '@/actions/order/catalog';
import { inputCls, type PaymentGateway } from './types';

interface OrderSummaryInputsProps {
  selectedService: PublicService;
  quantity: number;
  setQuantity: (val: number) => void;
  email: string;
  setEmail: (val: string) => void;
  promoCode: string;
  setPromoCode: (val: string) => void;
  gateway: PaymentGateway;
  validationErrors: Record<string, string>;
}

export function OrderSummaryInputs({
  selectedService,
  quantity,
  setQuantity,
  email,
  setEmail,
  promoCode,
  setPromoCode,
  gateway,
  validationErrors,
}: OrderSummaryInputsProps) {
  return (
    <>
      {/* Quantity stepper */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Количество
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(selectedService.minQty, quantity - 100))}
            aria-label={`Уменьшить количество до ${Math.max(selectedService.minQty, quantity - 100)}`}
            className="min-w-[44px] min-h-[44px] p-3 bg-background border border-border rounded-xl hover:bg-muted transition-all duration-200 shrink-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <Minus className="w-5 h-5 shrink-0" />
          </button>
          <input
            type="text"
            value={quantity || ''}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, '');
              setQuantity(raw ? parseInt(raw, 10) : 0);
            }}
            aria-label="Количество"
            inputMode="numeric"
            pattern="[0-9]*"
            onFocus={(e) => {
              const target = e.currentTarget;
              setTimeout(() => target.select(), 10);
            }}
            onClick={(e) => {
              const target = e.currentTarget;
              setTimeout(() => target.select(), 10);
            }}
            className={`${inputCls} h-12 text-center font-black text-slate-900 tabular-nums font-mono text-lg focus-visible:ring-2 focus-visible:ring-sky-500/50 focus-visible:outline-none placeholder:font-normal`}
          />
          <button
            type="button"
            onClick={() => setQuantity(quantity + 100)}
            aria-label={`Увеличить количество до ${quantity + 100}`}
            className="min-w-[44px] min-h-[44px] p-3 bg-background border border-border rounded-xl hover:bg-muted transition-all duration-200 shrink-0 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          >
            <Plus className="w-5 h-5 shrink-0" />
          </button>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
          Мин: {selectedService.minQty.toLocaleString('ru-RU')}
        </div>
        {validationErrors.quantity && (
          <p className="text-xs text-destructive font-semibold mt-1">{validationErrors.quantity}</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Email (для уведомления)
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            inputMode="email"
            readOnly={gateway === 'balance'}
            aria-label="Email для уведомлений о заказе"
            className={`${inputCls} text-base pl-10 h-11 transition-all duration-200 ${
              gateway === 'balance'
                ? 'bg-muted/60 text-muted-foreground cursor-not-allowed select-none border-success/20'
                : ''
            }`}
            placeholder="your@email.com"
          />
        </div>
        {gateway === 'balance' && (
          <p className="text-[10px] text-success-text font-bold mt-1.5 flex items-center gap-1 animate-in fade-in duration-200">
            <span>🔒</span> Зафиксировано для оплаты с баланса вашего аккаунта
          </p>
        )}
      </div>

      {/* Promo Code */}
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Промокод
        </label>
        <div className="relative">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            type="text"
            aria-label="Промокод"
            className={`${inputCls} text-base px-4 h-11 uppercase font-mono tracking-wider`}
            placeholder="WINTER2026"
          />
        </div>
      </div>
    </>
  );
}
