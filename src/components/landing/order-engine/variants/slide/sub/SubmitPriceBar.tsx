'use client';

import React from "react";
import { ArrowRightIcon, AlertCircle } from "lucide-react";
import type { PricingResult } from "@/services/marketing.service";

export interface SubmitPriceBarProps {
  totalPrice: string;
  originalPrice: string | null;
  serverPricing: PricingResult | null;
  selectedGateway: string;
  isPending: boolean;
  formState: { error?: string };
  shakeKey: number;
}

export function SubmitPriceBar({
  totalPrice,
  originalPrice,
  serverPricing,
  selectedGateway,
  isPending,
  formState,
  shakeKey,
}: SubmitPriceBarProps) {
  return (
    <>
      {/* Server Error Warning */}
      {formState.error && (
        <div 
          key={shakeKey}
          className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-semibold flex items-center gap-2 animate-shake"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{formState.error}</span>
        </div>
      )}

      {/* Submit Action Block */}
      <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-4">
        <div>
          <span className="text-[11px] text-muted-foreground block">Итого к оплате:</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground font-mono">
              {totalPrice} ₽
            </span>
            {originalPrice && (
              <span className="text-xs text-muted-foreground line-through font-mono">
                {originalPrice} ₽
              </span>
            )}
            {serverPricing && serverPricing.discountPercent > 0 && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                -{serverPricing.discountPercent}%
              </span>
            )}
          </div>
        </div>

        <button
          id="form-submit-btn"
          type="submit"
          disabled={isPending}
          className="h-12 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          {isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              <span>Создание заказа...</span>
            </>
          ) : (
            <>
              <span>{selectedGateway === "balance" ? "Оплатить с баланса" : "Перейти к оплате"}</span>
              <ArrowRightIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground text-center mt-3">
        Нажимая кнопку, вы соглашаетесь с условиями сервиса и политикой обработки данных (152-ФЗ)
      </p>
    </>
  );
}
