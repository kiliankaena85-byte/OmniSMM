import React from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import type { PaymentGateway } from './types';

interface OrderSummarySubmitBarProps {
  submitting: boolean;
  gateway: PaymentGateway;
  userBalanceRub: number;
  totalPrice: number;
  totalPriceFormatted: string;
  onPreSubmit: () => void;
}

export function OrderSummarySubmitBar({
  submitting,
  gateway,
  userBalanceRub,
  totalPrice,
  totalPriceFormatted,
  onPreSubmit,
}: OrderSummarySubmitBarProps) {
  return (
    <div className="pt-2">
      {/* Submit */}
      <div className={gateway === 'balance' && userBalanceRub >= totalPrice ? 'emerald-light' : ''}>
        <button
          type="button"
          onClick={() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(50);
            }
            onPreSubmit();
          }}
          disabled={submitting}
          className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-black text-base hover:scale-[1.01] active:scale-[0.99] hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none disabled:hover:shadow-none transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Оформляем...
            </>
          ) : (
            <>
              Оплатить заказ
              <span className="opacity-70 font-semibold text-xs bg-black/10 px-2 py-0.5 rounded-full shrink-0">
                {totalPriceFormatted} ₽
              </span>
            </>
          )}
        </button>
      </div>

      {/* Consent */}
      <div className="text-[10px] text-center text-muted-foreground mt-2 leading-relaxed select-none px-2">
        Нажимая кнопку «Оплатить заказ», вы соглашаетесь с{' '}
        <Link
          href="/legal/terms"
          className="underline hover:text-foreground font-semibold"
          target="_blank"
        >
          Договором публичной оферты
        </Link>{' '}
        и даете согласие на обработку данных согласно{' '}
        <Link
          href="/legal/privacy"
          className="underline hover:text-foreground font-semibold"
          target="_blank"
        >
          Политике конфиденциальности
        </Link>
        .
      </div>
    </div>
  );
}
