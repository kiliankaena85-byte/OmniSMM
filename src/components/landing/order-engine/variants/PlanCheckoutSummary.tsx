'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export interface PlanCheckoutSummaryProps {
  agreedToTerms: boolean;
  setAgreedToTerms: (val: boolean) => void;
  onOpenDocument?: (slug: string) => void;
  localError: string | null;
  checkoutError: string | null;
  shakeKey: number;
  isSubmitting: boolean;
  totalPriceFormatted: string;
  setLocalError: (err: string | null) => void;
}

export function PlanCheckoutSummary({
  agreedToTerms,
  setAgreedToTerms,
  onOpenDocument,
  localError,
  checkoutError,
  shakeKey,
  isSubmitting,
  totalPriceFormatted,
  setLocalError,
}: PlanCheckoutSummaryProps) {
  const activeError = localError || checkoutError;

  return (
    <>
      {/* 5. Legal Checkbox (152-ФЗ и Оферта) */}
      <div className="pt-1">
        <label className="flex items-start gap-2.5 cursor-pointer text-xs text-muted-foreground leading-relaxed">
          <input
            id="checkout-terms-checkbox"
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => {
              setAgreedToTerms(e.target.checked);
              if (localError) setLocalError(null);
            }}
            className="w-4 h-4 rounded text-primary focus:ring-primary mt-0.5 cursor-pointer shrink-0"
          />
          <span>
            Я принимаю условия{' '}
            <Link
              href="/legal/terms"
              onClick={(e) => {
                if (onOpenDocument) {
                  e.preventDefault();
                  onOpenDocument('terms');
                }
              }}
              className="text-primary hover:underline font-semibold"
            >
              Публичной оферты
            </Link>{' '}
            и даю согласие на обработку персональных данных в соответствии с{' '}
            <Link
              href="/legal/privacy"
              onClick={(e) => {
                if (onOpenDocument) {
                  e.preventDefault();
                  onOpenDocument('privacy');
                }
              }}
              className="text-primary hover:underline font-semibold"
            >
              Политикой конфиденциальности (152-ФЗ)
            </Link>.
          </span>
        </label>
      </div>

      {/* ── ERROR MESSAGE BANNER ── */}
      {activeError && (
        <div
          key={shakeKey}
          className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2.5 text-xs font-bold animate-shake"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{activeError}</span>
        </div>
      )}

      {/* ── SUBMIT CTA BUTTON ── */}
      <div className="pt-2">
        <button
          id="checkout-submit-btn"
          type="submit"
          disabled={isSubmitting}
          className="w-full h-14 min-h-[56px] rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base sm:text-lg flex items-center justify-center gap-2.5 shadow-xl shadow-primary/25 transition-all duration-150 active:scale-[0.99] cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <span className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>Создание заказа...</span>
            </>
          ) : (
            <span>Оплатить {totalPriceFormatted} ₽</span>
          )}
        </button>

        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-muted-foreground font-medium">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Безопасная оплата
          </span>
          <span>•</span>
          <span>Чек 54-ФЗ</span>
          <span>•</span>
          <span>Моментальный старт</span>
        </div>
      </div>
    </>
  );
}
