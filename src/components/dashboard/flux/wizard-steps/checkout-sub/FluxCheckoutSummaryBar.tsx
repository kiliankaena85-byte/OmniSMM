'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { AlertCircle } from 'lucide-react';
import { formatPricePerUnit, formatRubles } from '@/utils/format-price';
import type { FluxService } from '@/types/flux';

interface FluxCheckoutSummaryBarProps {
  selectedService: FluxService;
  qtyNum: number;
  isDripFeedEnabled: boolean;
  dripRuns: number;
  totalPriceRub: string;
  originalServerPriceRub: number | null;
  discountPercent: number;
  errorMessage: string | null;
  isSubmitting: boolean;
  gateway: 'balance' | 'yookassa' | 'cryptobot';
  canPayFromBalance: boolean;
}

export function FluxCheckoutSummaryBar({
  selectedService,
  qtyNum,
  isDripFeedEnabled,
  dripRuns,
  totalPriceRub,
  originalServerPriceRub,
  discountPercent,
  errorMessage,
  isSubmitting,
  gateway,
  canPayFromBalance,
}: FluxCheckoutSummaryBarProps) {
  return (
    <>
      {/* Summary & Price */}
      <div className="p-4 rounded-2xl bg-muted/50 border border-border/40 flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-foreground block">Итого к оплате:</span>
          <span className="text-xs text-muted-foreground font-semibold">
            {isDripFeedEnabled
              ? `(${qtyNum} шт всего: ${dripRuns} запусков по ${dripRuns > 0 ? Math.floor(qtyNum / dripRuns) : 0} шт × ${formatPricePerUnit(selectedService.pricePerUnitRub)} ₽/шт)`
              : `(${qtyNum} шт × ${formatPricePerUnit(selectedService.pricePerUnitRub)} ₽/шт)`}
          </span>
        </div>
        <div className="flex items-baseline gap-2 tabular-nums font-mono">
          <span className="text-2xl font-black text-foreground">{totalPriceRub}</span>
          {originalServerPriceRub && (
            <span className="text-xs text-muted-foreground line-through">
              {formatRubles(originalServerPriceRub)}
            </span>
          )}
          {discountPercent > 0 && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              -{discountPercent}%
            </span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-red-600 text-xs font-bold animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        isPending={isSubmitting}
        className="w-full h-13 rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-primary-foreground font-black text-base shadow-lg hover:scale-[1.01] active:scale-95 transition-all cursor-pointer border-0"
      >
        {gateway === 'balance' && canPayFromBalance ? 'Оплатить с баланса' : 'Оформить и оплатить'}
      </Button>
    </>
  );
}
