'use client';

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { OrderEngine } from "@/hooks/useOrderEngine";
import { getSocialLinkConfig } from "@/utils/social-link-placeholder";
import { safeFocus } from "@/utils/scroll-helpers";
import { MobileCheckoutInputs } from "./MobileCheckoutInputs";
import { MobileCheckoutGateways } from "./MobileCheckoutGateways";
import { MobileCheckoutOrderSummary } from "./MobileCheckoutOrderSummary";

export interface MobileStep4CheckoutProps {
  engine: OrderEngine;
  currentStep: number;
  setActiveStep: (step: 1 | 2 | 3 | 4) => void;
  shouldShowParameters: boolean;
  step4Ref: React.RefObject<HTMLDivElement | null>;
  emailInputRef?: React.RefObject<HTMLInputElement | null>;
  emailHasError?: boolean;
  handleCheckout: (gateway?: string, email?: string) => void;
  isSubmitting: boolean;
  onOpenDocument?: (slug: string) => void;
  checkoutError?: string | null;
  userBalanceCents?: number;
}

export function MobileStep4Checkout({
  engine,
  currentStep,
  setActiveStep,
  shouldShowParameters,
  step4Ref,
  emailInputRef,
  emailHasError,
  handleCheckout,
  isSubmitting,
  onOpenDocument,
  checkoutError,
  userBalanceCents
}: MobileStep4CheckoutProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [selectedGateway, setSelectedGateway] = useState<string>("yookassa");
  const [availableGateways, setAvailableGateways] = useState<{ yookassa: boolean; robokassa: boolean; cryptobot: boolean } | null>(null);

  useEffect(() => {
    let isMounted = true;
    import("@/actions/order/checkout").then(({ getAvailableGatewaysAction }) => {
      getAvailableGatewaysAction().then((res) => {
        if (isMounted && res.success && res.data) {
          setAvailableGateways(res.data);
          setSelectedGateway((current) => {
            if (current !== 'balance' && !res.data[current as keyof typeof res.data]) {
              const first = (["yookassa", "robokassa", "cryptobot"] as const).find((g) => res.data?.[g]);
              return first || current;
            }
            return current;
          });
        }
      });
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const {
    url,
    selectedService,
    quantity,
    email,
    agreedToTerms,
    isCalculating,
    totalPriceFormatted,
  } = engine;

  const linkConfig = useMemo(() => {
    const activeCat = engine.availableCategories.find(c => c.id === engine.categoryId);
    return getSocialLinkConfig(
      engine.activeNetwork?.slug || engine.platform,
      activeCat?.name,
      selectedService?.name,
      selectedService?.targetType,
      selectedService?.linkPlaceholder,
      selectedService?.linkHint
    );
  }, [engine.activeNetwork?.slug, engine.platform, engine.availableCategories, engine.categoryId, selectedService?.name, selectedService?.targetType, selectedService?.linkPlaceholder, selectedService?.linkHint]);

  useEffect(() => {
    if (agreedToTerms && email && email.includes('@')) {
      setLocalError(null);
    }
  }, [agreedToTerms, email]);

  if (currentStep !== 4 || !shouldShowParameters || !selectedService) {
    return null;
  }

  const minQty = selectedService.minQty || 10;
  const totalCents = engine.pricing?.totalCents || Math.round(parseFloat(totalPriceFormatted || "0") * 100);

  const onOrderClick = () => {
    if (!url || url.trim().length < 3) {
      setLocalError("Пожалуйста, укажите ссылку для продвижения");
      setActiveStep(1);
      setTimeout(() => {
        const urlInput = document.getElementById("standard-url-input");
        if (urlInput) safeFocus(urlInput, true);
      }, 120);
      return;
    }

    if (!agreedToTerms) {
      setLocalError("Пожалуйста, примите условия оферты и политики конфиденциальности");
      setShakeKey(prev => prev + 1);
      if (engine.setTermsHasError) engine.setTermsHasError(true);
      const checkboxEl = document.getElementById("standard-legal-checkbox");
      if (checkboxEl) {
        safeFocus(checkboxEl, true);
      }
      return;
    }

    if (!email || !email.includes("@")) {
      setLocalError("Укажите корректный email для отправки чека и доступа к заказу");
      setShakeKey(prev => prev + 1);
      const emailEl = emailInputRef?.current || document.getElementById("email-input");
      if (emailEl) {
        safeFocus(emailEl, true);
      }
      return;
    }

    setLocalError(null);
    handleCheckout(selectedGateway, email);
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      ref={step4Ref}
      className="space-y-4 overflow-visible border-t border-border/30 pt-3 scroll-mt-20"
    >
      <div className="flex items-center justify-between pl-1">
        <span className="block text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
          4. Параметры и оформление
        </span>
        <span className="text-[11px] font-bold text-primary">
          {selectedService.name}
        </span>
      </div>

      <MobileCheckoutInputs
        engine={engine}
        selectedService={selectedService}
        linkConfig={linkConfig}
        setActiveStep={setActiveStep}
        emailInputRef={emailInputRef}
        emailHasError={emailHasError}
        localError={localError}
        setLocalError={setLocalError}
        onOpenDocument={onOpenDocument}
      />

      <MobileCheckoutGateways
        selectedGateway={selectedGateway}
        setSelectedGateway={setSelectedGateway}
        availableGateways={availableGateways}
        userBalanceCents={userBalanceCents}
        totalCents={totalCents}
        setLocalError={setLocalError}
        setShakeKey={setShakeKey}
      />

      <MobileCheckoutOrderSummary
        localError={localError}
        checkoutError={checkoutError || null}
        shakeKey={shakeKey}
        isSubmitting={isSubmitting}
        isCalculating={isCalculating}
        quantity={quantity}
        minQty={minQty}
        selectedGateway={selectedGateway}
        totalPriceFormatted={totalPriceFormatted}
        onOrderClick={onOrderClick}
      />
    </motion.div>
  );
}
