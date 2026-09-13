'use client';

import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronUp, ChevronDown, ChevronRight, Loader2, Sparkles, Link as LinkIcon, ShieldCheck } from "lucide-react";
import { CheckoutVariantProps } from "./types";
import { DrawerQuantityCard } from "../drawer/DrawerQuantityCard";
import { DrawerFormInputs } from "../drawer/DrawerFormInputs";
import { DrawerPaymentSelector } from "../drawer/DrawerPaymentSelector";
import { LegalCheckbox } from "../LegalCheckbox";

export function FloatingHudCheckout({
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
  const [isExpanded, setIsExpanded] = useState(false);
  const [gateway, setGateway] = useState<"yookassa" | "cryptobot" | "balance">("yookassa");

  const formattedTotal = React.useMemo(() => {
    if (!pricing) return "0.00";
    return (pricing.totalCents / 100).toFixed(2);
  }, [pricing]);

  const getButtonText = () => {
    if (isSubmitting) return "Секунду...";
    if (gateway === "cryptobot") return "CryptoBot";
    if (gateway === "balance") return "Балансом";
    return "Оплатить";
  };

  return (
    <AnimatePresence>
      {selectedService && (
        <aside aria-label="Панель быстрого заказа" className="fixed bottom-5 left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[94%] sm:max-w-4xl z-[180]">
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 24, stiffness: 220 }}
            className="bg-card/95 dark:bg-content1/95 backdrop-blur-2xl border-2 border-primary/30 shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden"
          >
            {/* Expanded Configuration Drawer Tray */}
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-5 border-b border-border/80 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-thin bg-background/50"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DrawerQuantityCard
                    selectedService={selectedService}
                    quantity={quantity}
                    setQuantity={setQuantity}
                    pricing={pricing}
                    engine={engine}
                  />

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

                <DrawerPaymentSelector
                  gateway={gateway}
                  setGateway={setGateway}
                  userBalanceCents={userBalanceCents}
                  totalCents={pricing?.totalCents || 0}
                />

                <motion.div
                  animate={termsHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`w-full rounded-xl transition-all ${
                    termsHasError ? "ring-2 ring-destructive/40 bg-destructive/5 border border-destructive/20 p-2" : ""
                  }`}
                >
                  <LegalCheckbox
                    id="hud-legal-checkbox"
                    checked={engine?.agreedToTerms ?? false}
                    onChange={(val) => engine?.setAgreedToTerms(val)}
                    className="w-full text-[10px] font-bold text-muted-foreground justify-start"
                    onOpenDocument={onOpenDocument}
                  />
                </motion.div>
              </motion.div>
            )}

            {/* Compact Floating Capsule Bar (Always Visible when service is active) */}
            <div className="p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              {/* Service Info & Expand Button */}
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground transition-all cursor-pointer shrink-0"
                  title={isExpanded ? "Свернуть настройки" : "Развернуть все настройки"}
                >
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-primary/15 text-primary border border-primary/20 shrink-0">
                      #{selectedService.numericId}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-foreground truncate min-w-0">
                      {selectedService.name}
                    </h4>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">
                    {quantity.toLocaleString("ru-RU")} шт • {(selectedService.pricePerUnitRub * quantity).toFixed(2)} ₽
                  </p>
                </div>
              </div>

              {/* Target Link Button */}
              <button
                type="button"
                onClick={() => setShowLinkModal(true)}
                className="h-10 px-3 rounded-xl bg-content2 hover:bg-content3 border border-border text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer max-w-[140px] sm:max-w-[200px] truncate min-w-0"
              >
                <LinkIcon className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate min-w-0">{url || "Укажите ссылку"}</span>
              </button>

              {/* Total Price & Action Button */}
              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                <div className="text-right">
                  <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest block">
                    Итого
                  </span>
                  <p className="text-base sm:text-lg font-black text-foreground tabular-nums font-mono leading-none">
                    {formattedTotal} <span className="text-primary font-black">₽</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCheckout(gateway)}
                  disabled={isSubmitting || isCalculating}
                  className="min-h-[44px] h-11 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{getButtonText()}</span>
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-content2 hover:bg-content3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
                  title="Отменить выбор"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </aside>
      )}
    </AnimatePresence>
  );
}
