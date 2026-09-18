'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { PricingResult } from '@/services/marketing.service';

export interface MobileCheckoutPromoProps {
  promoCode: string;
  setPromoCode: (code: string) => void;
  isCalculating?: boolean;
  pricing?: PricingResult | null;
  pricingError?: 'voucher' | null;
  setLocalError?: (err: string | null) => void;
}

export function MobileCheckoutPromo({
  promoCode,
  setPromoCode,
  isCalculating = false,
  pricing = null,
  pricingError = null,
  setLocalError,
}: MobileCheckoutPromoProps) {
  const [showPromo, setShowPromo] = useState<boolean>(Boolean(promoCode && promoCode.trim().length > 0));

  useEffect(() => {
    if (promoCode && promoCode.trim().length > 0) {
      setShowPromo(true);
    }
  }, [promoCode]);

  const cleanCode = promoCode.trim();
  const hasDiscount = Boolean(pricing && pricing.discountCents > 0);

  const handleClear = () => {
    setPromoCode('');
    setShowPromo(false);
    if (setLocalError) setLocalError(null);
  };

  const handleResetInput = () => {
    setPromoCode('');
    if (setLocalError) setLocalError(null);
  };

  if (!showPromo) {
    return (
      <div className="pt-0.5">
        <button
          type="button"
          onClick={() => setShowPromo(true)}
          className="w-full h-11 min-h-[44px] border border-dashed border-border/90 hover:border-primary/70 bg-background hover:bg-primary/5 text-xs font-bold text-muted-foreground hover:text-primary rounded-2xl flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer"
        >
          <Ticket className="w-4 h-4 text-primary shrink-0" />
          <span>+ Есть промокод?</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <label htmlFor="mobile-promo-input" className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 flex items-center gap-1.5">
          <Ticket className="w-3.5 h-3.5 text-primary" />
          <span>Промокод</span>
        </label>
        {cleanCode.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] font-bold text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            Удалить
          </button>
        )}
      </div>

      <div className="relative flex items-center">
        <input
          id="mobile-promo-input"
          type="text"
          value={promoCode}
          onChange={(e) => {
            setPromoCode(e.target.value.toUpperCase().replace(/\s+/g, ''));
            if (setLocalError) setLocalError(null);
          }}
          placeholder="ВВЕДИТЕ ПРОМОКОД"
          className={`w-full h-11 min-h-[44px] px-4 pr-16 rounded-2xl border bg-background font-mono font-bold text-base text-foreground outline-none uppercase tracking-wider transition-all ${
            hasDiscount
              ? 'border-emerald-500 focus:border-emerald-500 ring-2 ring-emerald-500/20'
              : cleanCode.length >= 3 && !isCalculating && (!pricing || pricing.discountCents === 0) && !pricingError
              ? 'border-destructive focus:border-destructive ring-2 ring-destructive/20'
              : 'border-border focus:border-primary focus:ring-2 ring-primary/20'
          }`}
        />

        <div className="absolute right-2.5 flex items-center gap-1.5">
          {cleanCode.length > 0 && (
            <button
              type="button"
              onClick={handleResetInput}
              className="w-7 h-7 rounded-full bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors cursor-pointer"
              title="Очистить промокод"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {hasDiscount && (
            <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-black select-none">
              -{pricing?.discountPercent}%
            </span>
          )}
        </div>
      </div>

      {/* Validation feedback */}
      {isCalculating && cleanCode.length > 0 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium pl-1 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
          <span>Проверяем промокод...</span>
        </p>
      )}

      {pricingError === 'voucher' && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5 pl-1 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Это ваучер для пополнения баланса. Активируйте в личном кабинете.</span>
        </p>
      )}

      {!isCalculating && cleanCode.length >= 3 && (!pricing || pricing.discountCents === 0) && !pricingError && (
        <p className="text-[11px] text-destructive font-semibold flex items-center gap-1.5 pl-1 animate-in fade-in">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Промокод не найден или срок действия истёк</span>
        </p>
      )}

      {!isCalculating && cleanCode.length > 0 && hasDiscount && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5 pl-1 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
          <span>Скидка {pricing!.discountPercent}% (-{(pricing!.discountCents / 100).toFixed(2)} ₽) активирована</span>
        </p>
      )}
    </div>
  );
}
