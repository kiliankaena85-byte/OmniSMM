'use client';

import React from "react";
import { motion } from "framer-motion";
import { Loader2, ChevronRight } from "lucide-react";
import { LegalCheckbox } from "../LegalCheckbox";
import { OrderEngine } from "@/hooks/useOrderEngine";

interface DrawerFooterProps {
    pricing: OrderEngine["pricing"];
  gateway: "yookassa" | "cryptobot" | "balance";
  isCalculating: boolean;
  isSubmitting: boolean;
  handleCheckout: () => void;
  termsHasError?: boolean;
  engine?: OrderEngine;
  onOpenDocument?: (slug: string) => void;
}

export function DrawerFooter({
  pricing,
  gateway,
  isCalculating,
  isSubmitting,
  handleCheckout,
  termsHasError,
  engine,
  onOpenDocument
}: DrawerFooterProps) {
  const getButtonText = () => {
    if (isSubmitting) return "Секунду...";
    if (gateway === "cryptobot") return "Оплатить через CryptoBot";
    if (gateway === "balance") return "Оплатить балансом";
    return "Оплатить картой РФ / СБП";
  };

  const formattedTotal = React.useMemo(() => {
    if (!pricing) return "0.00";
    return (pricing.totalCents / 100).toFixed(2);
  }, [pricing]);

  const hasDiscount = Boolean(pricing && pricing.discountCents > 0);
  const originalTotal = React.useMemo(() => {
    if (!pricing || !pricing.originalTotalCents) return null;
    return (pricing.originalTotalCents / 100).toFixed(2);
  }, [pricing]);

  const discountPercent = React.useMemo(() => {
    if (!pricing || !pricing.discountCents || !pricing.originalTotalCents) return 0;
    return Math.round((pricing.discountCents / pricing.originalTotalCents) * 100);
  }, [pricing]);

  return (
    <div className="border-t border-border/40 bg-background/80 dark:bg-content1/80 backdrop-blur-md p-5 pb-7 sm:pb-5 space-y-3.5 shadow-[0_-10px_30px_rgba(0,0,0,0.04)]">
      {/* Pricing Summary */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black text-muted-foreground uppercase tracking-wider block">
              Итого к оплате
            </span>
            {hasDiscount && originalTotal && (
              <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-left-1 duration-200">
                <span className="text-xs font-bold text-muted-foreground line-through tabular-nums font-mono">
                  {originalTotal} ₽
                </span>
                <span className="text-[10px] font-black uppercase px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  −{discountPercent}%
                </span>
              </div>
            )}
          </div>
          {isCalculating ? (
            <div className="h-8 flex items-center w-16">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
          ) : (
            <p className="text-2xl sm:text-3xl font-black text-foreground tabular-nums font-mono tracking-tight leading-none flex items-baseline">
              {formattedTotal}
              <span className="text-primary ml-1 text-xl sm:text-2xl font-black">₽</span>
            </p>
          )}
        </div>

        {/* Pay Button */}
        <button
          type="button"
          onClick={() => handleCheckout()}
          className="min-h-[48px] h-12 px-5 sm:px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>{getButtonText()}</span>
              <ChevronRight className="w-4.5 h-4.5" />
            </>
          )}
        </button>
      </div>

      {/* Legal terms agreement with Shake & Glow feedback on error */}
      <motion.div
        animate={termsHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
        transition={{ duration: 0.4 }}
        className={`w-full rounded-2xl transition-all ${
          termsHasError
            ? "ring-2 ring-destructive/40 bg-destructive/5 border border-destructive/20 p-2"
            : ""
        }`}
      >
        <LegalCheckbox
          id="drawer-legal-checkbox"
          checked={engine?.agreedToTerms ?? false}
          onChange={(val) => engine?.setAgreedToTerms(val)}
          className="w-full text-[10px] font-bold text-muted-foreground justify-start"
          onOpenDocument={onOpenDocument}
        />
      </motion.div>
    </div>
  );
}
