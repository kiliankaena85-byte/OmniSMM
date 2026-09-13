'use client';

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, X, Loader2, ChevronRight } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PublicService } from "@/actions/order/catalog";
import { DrawerOrderSummary } from "./drawer/DrawerOrderSummary";
import { DrawerQuantityCard } from "./drawer/DrawerQuantityCard";
import { DrawerFormInputs } from "./drawer/DrawerFormInputs";
import { DrawerPaymentSelector } from "./drawer/DrawerPaymentSelector";
import { DripFeedConfigurator } from "./DripFeedConfigurator";
import { LegalCheckbox } from "./LegalCheckbox";
import { Button } from "@/components/ui/button";

interface FullscreenCheckoutVariantCProps {
  selectedService: PublicService | null;
  url: string;
  setShowLinkModal: (show: boolean) => void;
  quantity: number;
  setQuantity: (q: number) => void;
  pricing: OrderEngine["pricing"];
  email: string;
  setEmail: (e: string) => void;
  promoCode: string;
  setPromoCode: (p: string) => void;
  isCalculating: boolean;
  isSubmitting: boolean;
  handleCheckout: (gateway?: string) => void;
  onClose: () => void;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  termsHasError?: boolean;
  engine: OrderEngine;
  onOpenDocument?: (slug: string) => void;
  userBalanceCents?: number;
}

export function FullscreenCheckoutVariantC({
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
  userBalanceCents = 0
}: FullscreenCheckoutVariantCProps) {
  const [gateway, setGateway] = React.useState<"yookassa" | "cryptobot" | "balance">("yookassa");

  // Lock body scroll on mount
  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, []);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!selectedService) return null;

  const getButtonText = () => {
    if (isSubmitting) return "Секунду...";
    if (gateway === "cryptobot") return "Оплатить через CryptoBot";
    if (gateway === "balance") return "Оплатить балансом";
    return "Оплатить картой РФ / СБП";
  };

  const formattedTotal = pricing ? (pricing.totalCents / 100).toFixed(2) : "0.00";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed inset-0 bg-background dark:bg-background z-[300] overflow-y-auto flex flex-col scrollbar-thin"
      >
        {/* Navigation / Header */}
        <header className="sticky top-0 z-[310] bg-background/95 backdrop-blur-xl border-b border-border/80 px-6 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-content2 border border-border/80 flex items-center justify-center text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs group"
              title="Назад"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform shrink-0" />
            </button>
            <span className="text-sm font-bold text-foreground hidden sm:inline-block">
              Вернуться к тарифам
            </span>
          </div>

          <h3 className="text-sm md:text-base font-black text-foreground uppercase tracking-wider text-center">
            Оформление заказа
          </h3>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl hover:bg-content2 border border-border/80 flex items-center justify-center text-foreground transition-all cursor-pointer active:scale-95 shadow-2xs group"
            title="Закрыть"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
          </button>
        </header>

        {/* Content Body */}
        <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 md:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            
            {/* Left Column (5/12) - Summary & Link Inputs */}
            <div className="lg:col-span-5 space-y-5">
              <DrawerOrderSummary
                selectedService={selectedService}
                url={url}
                setShowLinkModal={setShowLinkModal}
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

            {/* Right Column (7/12) - Quantity, Payment, Drip-Feed */}
            <div className="lg:col-span-7 space-y-5">
              <DrawerQuantityCard
                selectedService={selectedService}
                quantity={quantity}
                setQuantity={setQuantity}
                pricing={pricing}
                engine={engine}
              />

              {/* Drip-feed Config */}
              <DripFeedConfigurator engine={engine} />

              <DrawerPaymentSelector
                gateway={gateway}
                setGateway={setGateway}
                userBalanceCents={userBalanceCents}
                totalCents={pricing?.totalCents || 0}
              />

              {/* Final Actions Block */}
              <div className="bg-card border border-border/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <span className="text-xs font-black text-muted-foreground uppercase tracking-wider block mb-1">
                      Итого к оплате
                    </span>
                    {isCalculating ? (
                      <div className="h-9 flex items-center w-20">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                      </div>
                    ) : (
                      <p className="text-3xl sm:text-4xl font-black text-foreground tabular-nums font-mono tracking-tight leading-none">
                        {formattedTotal}
                        <span className="text-primary ml-1.5 text-2xl sm:text-3xl font-black">₽</span>
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleCheckout(gateway)}
                    disabled={isSubmitting || isCalculating}
                    className="min-h-[48px] h-13 px-8 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>{getButtonText()}</span>
                        <ChevronRight className="w-5 h-5" />
                      </>
                    )}
                  </Button>
                </div>

                {/* Consent checkbox */}
                <motion.div
                  animate={termsHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
                  transition={{ duration: 0.4 }}
                  className={`w-full rounded-xl transition-all pt-2 border-t border-border/40 ${
                    termsHasError
                      ? "ring-2 ring-destructive/40 bg-destructive/5 border border-destructive/20 p-2.5"
                      : ""
                  }`}
                >
                  <LegalCheckbox
                    id="fullscreen-legal-checkbox"
                    checked={engine.agreedToTerms}
                    onChange={(val) => engine.setAgreedToTerms(val)}
                    className="w-full text-xs font-semibold text-foreground/80 justify-start"
                    onOpenDocument={onOpenDocument}
                  />
                </motion.div>
              </div>

            </div>

          </div>
        </main>
      </motion.div>
    </AnimatePresence>
  );
}
