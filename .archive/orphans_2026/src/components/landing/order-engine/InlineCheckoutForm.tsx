'use client';

import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X, Loader2, ChevronRight, ShieldCheck } from "lucide-react";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { PublicService } from "@/actions/order/catalog";
import { DrawerOrderSummary } from "./drawer/DrawerOrderSummary";
import { DrawerQuantityCard } from "./drawer/DrawerQuantityCard";
import { DrawerFormInputs } from "./drawer/DrawerFormInputs";
import { DrawerPaymentSelector } from "./drawer/DrawerPaymentSelector";
import { DripFeedConfigurator } from "./DripFeedConfigurator";
import { LegalCheckbox } from "./LegalCheckbox";
import { Button } from "@/components/ui/button";
import { checkServiceRefill } from "@/utils/service-refill";

interface InlineCheckoutFormProps {
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
  onClearSelection: () => void;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  quantityHasError?: boolean;
  termsHasError?: boolean;
  engine: OrderEngine;
  onOpenDocument?: (slug: string) => void;
  userBalanceCents?: number;
}

export function InlineCheckoutForm({
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
  onClearSelection,
  emailInputRef,
  emailHasError,
  quantityHasError,
  termsHasError,
  engine,
  onOpenDocument,
  userBalanceCents = 0
}: InlineCheckoutFormProps) {
  const [gateway, setGateway] = React.useState<"yookassa" | "cryptobot" | "balance">("yookassa");
  const formRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to form on mount
  useEffect(() => {
    if (selectedService && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedService?.id]);

  if (!selectedService) return null;

  const getButtonText = () => {
    if (isSubmitting) return "Секунду...";
    if (gateway === "cryptobot") return "Оплатить через CryptoBot";
    if (gateway === "balance") return "Оплатить балансом";
    return "Оплатить картой РФ / СБП";
  };

  const formattedTotal = pricing ? (pricing.totalCents / 100).toFixed(2) : "0.00";

  return (
    <motion.div
      ref={formRef}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full mt-8 bg-background dark:bg-content1 border border-border/80 rounded-[2.5rem] p-6 md:p-8 relative shadow-[0_20px_50px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
    >
      {/* Header section with title and close button */}
      <div className="flex items-center justify-between pb-6 border-b border-border/40 mb-6">
        <div>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-black text-primary uppercase tracking-wider mb-1">
            Оформление заказа
          </span>
          <h3 className="text-lg md:text-xl font-black text-foreground">
            Заполните данные для запуска продвижения
          </h3>
        </div>
        <button
          type="button"
          onClick={onClearSelection}
          className="w-9 h-9 rounded-full bg-content2 hover:bg-content3 border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm active:scale-95"
          title="Сбросить выбор"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Two-Column Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column (5/12 width) - Summary, Link Info, Fields */}
        <div className="lg:col-span-5 space-y-4">
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

        {/* Right Column (7/12 width) - Quantity, Drip-Feed, Payment, Checkout */}
        <div className="lg:col-span-7 space-y-4">
          <DrawerQuantityCard
            selectedService={selectedService}
            quantity={quantity}
            setQuantity={setQuantity}
            pricing={pricing}
            engine={engine}
            quantityHasError={quantityHasError}
          />

          {/* Drip-Feed configurator */}
          <DripFeedConfigurator engine={engine} />

          <DrawerPaymentSelector
            gateway={gateway}
            setGateway={setGateway}
            userBalanceCents={userBalanceCents}
            totalCents={pricing?.totalCents || 0}
          />

          {/* Checkout Action Panel */}
          <div className="bg-content2/60 border border-border/20 rounded-3xl p-5 md:p-6 space-y-4 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest block mb-0.5">
                  Итого к оплате
                </span>
                {isCalculating ? (
                  <div className="h-8 flex items-center w-16">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  </div>
                ) : (
                  <p className="text-3xl font-black text-foreground tabular-nums tracking-tight leading-none">
                    {formattedTotal}
                    <span className="text-primary ml-1 text-2xl">₽</span>
                  </p>
                )}
              </div>

              <Button
                type="button"
                onClick={() => handleCheckout(gateway)}
                disabled={isSubmitting || isCalculating}
                className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-sm shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin" />
                ) : (
                  <>
                    <span>{getButtonText()}</span>
                    <ChevronRight className="w-4.5 h-4.5" />
                  </>
                )}
              </Button>
            </div>

            {/* 🛡️ Risk Reversal & Security Note */}
            {(() => {
              const { hasRefill } = selectedService ? checkServiceRefill(selectedService) : { hasRefill: false };
              return (
                <div className="p-3 rounded-2xl bg-primary/5 border border-primary/15 flex items-start gap-2.5 text-[11px] text-muted-foreground leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    {hasRefill ? (
                      <>
                        <span className="font-bold text-foreground">🛡️ Гарантия Refill активна:</span> действует защита от списаний с автоматической докруткой. Запуск без паролей.
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-foreground">100% Безопасный запуск:</span> соблюдаем суточные лимиты соцсетей без ввода паролей. При сбое или отмене — возврат средств.
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Legal terms agreement with Shake & Glow feedback on error */}
            <motion.div
              animate={termsHasError ? { x: [0, -6, 6, -6, 6, 0] } : {}}
              transition={{ duration: 0.4 }}
              className={`w-full rounded-2xl transition-all ${
                termsHasError
                  ? "ring-2 ring-destructive/40 bg-destructive/5 border border-destructive/20 p-2.5"
                  : ""
              }`}
            >
              <LegalCheckbox
                id="inline-legal-checkbox"
                checked={engine.agreedToTerms}
                onChange={(val) => engine.setAgreedToTerms(val)}
                className="w-full text-[10px] font-bold text-muted-foreground justify-start"
                onOpenDocument={onOpenDocument}
              />
            </motion.div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
