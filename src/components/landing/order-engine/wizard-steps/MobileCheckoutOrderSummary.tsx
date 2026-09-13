'use client';

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Zap, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MobileCheckoutOrderSummaryProps {
  localError: string | null;
  checkoutError: string | null;
  shakeKey: number;
  isSubmitting: boolean;
  isCalculating: boolean;
  quantity: number;
  minQty: number;
  selectedGateway: string;
  totalPriceFormatted: string;
  onOrderClick: () => void;
}

export function MobileCheckoutOrderSummary({
  localError,
  checkoutError,
  shakeKey,
  isSubmitting,
  isCalculating,
  quantity,
  minQty,
  selectedGateway,
  totalPriceFormatted,
  onOrderClick,
}: MobileCheckoutOrderSummaryProps) {
  const activeError = localError || checkoutError;

  return (
    <div className="pt-2 border-t border-border/30 space-y-2">
      <AnimatePresence>
        {activeError && (
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="p-3 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs font-bold flex items-center gap-2 animate-shake"
          >
            <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
            <span>{activeError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={onOrderClick}
        disabled={isSubmitting || quantity < minQty}
        className={`w-full h-12 rounded-2xl bg-primary text-primary-foreground font-black text-sm shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed ${
          activeError ? 'ring-2 ring-danger/40 animate-shake' : ''
        }`}
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isCalculating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Расчёт...</span>
          </>
        ) : (
          <>
            <Zap className="w-4 h-4 fill-current shrink-0" />
            <span className="truncate">
              {selectedGateway === 'balance'
                ? `Оплатить с баланса — ${totalPriceFormatted} ₽`
                : selectedGateway === 'yookassa'
                ? `Оплатить СБП / Картой — ${totalPriceFormatted} ₽`
                : selectedGateway === 'cryptobot'
                ? `Оплатить в CryptoBot — ${totalPriceFormatted} ₽`
                : `Оплатить картой — ${totalPriceFormatted} ₽`}
            </span>
          </>
        )}
      </Button>

      <div className="flex flex-col items-center gap-1 text-center pt-0.5 pb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
          <span className="text-emerald-500 font-black">✓</span>
          <span>
            {selectedGateway === 'balance'
              ? 'Внутреннее списание • Без комиссий банка'
              : 'Официальный платёж • Электронный чек по 54-ФЗ'}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground/75 font-medium">
          Безопасное соединение TLS 1.3 • Без подписок и скрытых списаний
        </p>
      </div>
    </div>
  );
}
