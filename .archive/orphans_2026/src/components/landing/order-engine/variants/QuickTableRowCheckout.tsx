'use client';

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, ChevronRight, Loader2, Link as LinkIcon, Sparkles } from "lucide-react";
import { CheckoutVariantProps } from "./types";
import { DrawerQuantityCard } from "../drawer/DrawerQuantityCard";
import { DrawerFormInputs } from "../drawer/DrawerFormInputs";
import { DrawerPaymentSelector } from "../drawer/DrawerPaymentSelector";
import { LegalCheckbox } from "../LegalCheckbox";

export function QuickTableRowCheckout({
  selectedService,
  url,
  setShowLinkModal,
  quantity,
  setQuantity,
  pricing,
  email,
  setEmail,
  promoCode,
  setPromoCode,
  isCalculating,
  isSubmitting,
  handleCheckout,
  onClose,
  emailInputRef,
  emailHasError,
  termsHasError,
  engine,
  onOpenDocument,
  userBalanceCents
}: CheckoutVariantProps) {
  const [gateway, setGateway] = useState<"yookassa" | "cryptobot" | "balance">("yookassa");

  const formattedTotal = React.useMemo(() => {
    if (!pricing) return "0.00";
    return (pricing.totalCents / 100).toFixed(2);
  }, [pricing]);

  if (!selectedService) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="w-full my-3 p-5 rounded-3xl bg-muted/40 border-2 border-primary/40 shadow-xl space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            ID {selectedService.numericId}
          </span>
          <span className="text-sm font-black text-foreground">
            Экспресс-оформление: {selectedService.name}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Закрыть</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Quantity */}
        <div className="space-y-3">
          <div className="p-3 rounded-2xl bg-card border border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <LinkIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-medium text-muted-foreground truncate min-w-0">
                {url || "Ссылка на объект"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowLinkModal(true)}
              className="h-8 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs shrink-0 cursor-pointer transition-all"
            >
              {url ? "Изменить" : "Указать"}
            </button>
          </div>

          <DrawerQuantityCard
            selectedService={selectedService}
            quantity={quantity}
            setQuantity={setQuantity}
            pricing={pricing}
            engine={engine}
          />
        </div>

        {/* Column 2: Email & Promo */}
        <div>
          <DrawerFormInputs
            email={email}
            setEmail={setEmail}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            emailInputRef={emailInputRef}
            emailHasError={emailHasError}
            engine={engine}
          />
        </div>

        {/* Column 3: Payment & CTA */}
        <div className="space-y-3 flex flex-col justify-between">
          <DrawerPaymentSelector
            gateway={gateway}
            setGateway={setGateway}
            userBalanceCents={userBalanceCents}
            totalCents={pricing?.totalCents || 0}
          />

          <div className="p-4 rounded-2xl bg-card border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
                  Итого
                </span>
                <p className="text-2xl font-black text-foreground tabular-nums font-mono">
                  {formattedTotal} <span className="text-primary text-xl">₽</span>
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCheckout(gateway)}
                disabled={isSubmitting || isCalculating}
                className="min-h-[48px] h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Оплатить заказ</span>
                    <ChevronRight className="w-4.5 h-4.5" />
                  </>
                )}
              </button>
            </div>

            <LegalCheckbox
              id="quickrow-legal-checkbox"
              checked={engine?.agreedToTerms ?? false}
              onChange={(val) => engine?.setAgreedToTerms(val)}
              className="w-full text-[10px] font-bold text-muted-foreground justify-start"
              onOpenDocument={onOpenDocument}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
