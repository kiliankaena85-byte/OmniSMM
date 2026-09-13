'use client';

import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, ChevronRight, Loader2, Link as LinkIcon, Sparkles } from "lucide-react";
import { CheckoutVariantProps } from "./types";
import { DrawerQuantityCard } from "../drawer/DrawerQuantityCard";
import { DrawerFormInputs } from "../drawer/DrawerFormInputs";
import { DrawerPaymentSelector } from "../drawer/DrawerPaymentSelector";
import { DripFeedConfigurator } from "../DripFeedConfigurator";
import { LegalCheckbox } from "../LegalCheckbox";

export function InCardAccordionCheckout({
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

  const getButtonText = () => {
    if (isSubmitting) return "Секунду...";
    if (gateway === "cryptobot") return "CryptoBot";
    if (gateway === "balance") return "Балансом";
    return "Оплатить заказ";
  };

  if (!selectedService) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={(e) => e.stopPropagation()}
      className="w-full mt-4 pt-4 border-t-2 border-primary/30 space-y-4 text-foreground cursor-default"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Параметры заказа
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Свернуть</span>
        </button>
      </div>

      {/* Target Link Row */}
      <div className="p-3 rounded-2xl bg-card border border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <LinkIcon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-medium text-muted-foreground truncate min-w-0">
            {url || "Ссылка на профиль / публикацию"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className="h-8 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs shrink-0 cursor-pointer transition-all"
        >
          {url ? "Изменить" : "Указать ссылку"}
        </button>
      </div>

      <DrawerQuantityCard
        selectedService={selectedService}
        quantity={quantity}
        setQuantity={setQuantity}
        pricing={pricing}
        engine={engine}
      />

      <DripFeedConfigurator engine={engine} />

      <DrawerFormInputs
        email={email}
        setEmail={setEmail}
        promoCode={promoCode}
        setPromoCode={setPromoCode}
        emailInputRef={emailInputRef}
        emailHasError={emailHasError}
        engine={engine}
      />

      <DrawerPaymentSelector
        gateway={gateway}
        setGateway={setGateway}
        userBalanceCents={userBalanceCents}
        totalCents={pricing?.totalCents || 0}
      />

      {/* Total & Pay */}
      <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">
              Итого к оплате
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
                <span>{getButtonText()}</span>
                <ChevronRight className="w-4.5 h-4.5" />
              </>
            )}
          </button>
        </div>

        <motion.div
          animate={termsHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
          transition={{ duration: 0.4 }}
          className={`w-full rounded-xl transition-all ${
            termsHasError ? "ring-2 ring-destructive/40 bg-destructive/5 border border-destructive/20 p-2" : ""
          }`}
        >
          <LegalCheckbox
            id="incard-legal-checkbox"
            checked={engine?.agreedToTerms ?? false}
            onChange={(val) => engine?.setAgreedToTerms(val)}
            className="w-full text-[10px] font-bold text-muted-foreground justify-start"
            onOpenDocument={onOpenDocument}
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
