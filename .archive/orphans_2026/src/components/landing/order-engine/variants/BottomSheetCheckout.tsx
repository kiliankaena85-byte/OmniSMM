'use client';

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronRight, Loader2 } from "lucide-react";
import { CheckoutVariantProps } from "./types";
import { DrawerOrderSummary } from "../drawer/DrawerOrderSummary";
import { DrawerQuantityCard } from "../drawer/DrawerQuantityCard";
import { DrawerFormInputs } from "../drawer/DrawerFormInputs";
import { DrawerPaymentSelector } from "../drawer/DrawerPaymentSelector";
import { DripFeedConfigurator } from "../DripFeedConfigurator";
import { LegalCheckbox } from "../LegalCheckbox";
import { EmailPromptModal } from "../modals/EmailPromptModal";

export function BottomSheetCheckout({
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
  const [isEmailPromptOpen, setIsEmailPromptOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const formattedTotal = React.useMemo(() => {
    if (!pricing) return "0.00";
    return (pricing.totalCents / 100).toFixed(2);
  }, [pricing]);

  const getButtonText = () => {
    if (isSubmitting) return "Секунду...";
    if (gateway === "cryptobot") return "Оплатить через CryptoBot";
    if (gateway === "balance") return "Оплатить балансом";
    return "Оплатить картой РФ / СБП";
  };

  return (
    <AnimatePresence>
      {selectedService && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/60 backdrop-blur-md cursor-pointer"
          />

          {/* Bottom Sheet Card */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="relative w-full max-w-2xl mx-auto bg-card border-t border-x border-border shadow-2xl rounded-t-[2.5rem] flex flex-col max-h-[86vh] z-10 overflow-hidden"
          >
            {/* Top Drag Indicator Handle */}
            <div className="w-12 h-1.5 bg-border rounded-full mx-auto my-3 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-2 border-b border-border/60 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  ID {selectedService.numericId}
                </span>
                <h3 className="text-base font-black text-foreground uppercase tracking-wider">
                  Оформление заказа
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-content2 hover:bg-content3 border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                title="Закрыть"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 scrollbar-thin">
              <DrawerOrderSummary
                selectedService={selectedService}
                url={url}
                setShowLinkModal={setShowLinkModal}
                engine={engine}
              />

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
            </div>

            {/* Sticky Bottom Footer */}
            <div className="border-t border-border/80 bg-background/95 backdrop-blur-md p-5 pb-8 sm:pb-5 space-y-3 shrink-0">
              <div className="flex items-end justify-between">
                <div>
                  <span className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                    Итого к оплате
                  </span>
                  {isCalculating ? (
                    <div className="h-8 flex items-center w-16">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    </div>
                  ) : (
                    <p className="text-3xl font-black text-foreground tabular-nums font-mono tracking-tight leading-none">
                      {formattedTotal}
                      <span className="text-primary ml-1 text-2xl font-black">₽</span>
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const trimmed = email?.trim();
                    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
                      setIsEmailPromptOpen(true);
                      return;
                    }
                    handleCheckout(gateway);
                  }}
                  disabled={isSubmitting || isCalculating}
                  className="min-h-[48px] h-12 px-6 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
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
                  id="bottom-legal-checkbox"
                  checked={engine?.agreedToTerms ?? false}
                  onChange={(val) => engine?.setAgreedToTerms(val)}
                  className="w-full text-[10px] font-bold text-muted-foreground justify-start"
                  onOpenDocument={onOpenDocument}
                />
              </motion.div>
            </div>

            {/* Email Prompt Modal Fallback */}
            <EmailPromptModal
              isOpen={isEmailPromptOpen}
              onClose={() => setIsEmailPromptOpen(false)}
              onConfirm={(confirmedEmail) => {
                setEmail(confirmedEmail);
                setIsEmailPromptOpen(false);
                handleCheckout(gateway, confirmedEmail);
              }}
              initialEmail={email}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
