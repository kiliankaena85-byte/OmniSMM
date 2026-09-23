'use client';

import React from "react";
import { Button } from "@heroui/react";
import { AlertCircle, ArrowRightIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { FluxStepCheckoutProps } from "./sub/types";
import { FluxStepCheckoutHeader } from "./sub/FluxStepCheckoutHeader";
import { FluxStepCheckoutPaymentMethods } from "./sub/FluxStepCheckoutPaymentMethods";
import { FluxStepCheckoutDripAndCustom } from "./sub/FluxStepCheckoutDripAndCustom";
import { FluxStepCheckoutInputs } from "./sub/FluxStepCheckoutInputs";

export type { FluxStepCheckoutProps };

export function FluxStepCheckout({
  selectedService,
  activeNetwork,
  activeCategory,
  quantity,
  setQuantity,
  numericQuantity,
  effectiveQuantity,
  link,
  setLink,
  email,
  setEmail,
  isRequirementsConfirmed,
  setIsRequirementsConfirmed,
  isDripFeedEnabled,
  setIsDripFeedEnabled,
  dripRuns,
  setDripRuns,
  dripInterval,
  setDripInterval,
  customData,
  setCustomData,
  selectedGateway,
  setSelectedGateway,
  availableGateways,
  userBalanceCents,
  price,
  isTgGuideOpen,
  setIsTgGuideOpen,
  formAction,
  isPending,
  formState,
  showShakeError,
  shakeKey,
  quantityRef,
  emailRef,
  linkRef,
}: FluxStepCheckoutProps) {
  return (
    <div className="bg-card border border-border/80 shadow-xl rounded-[2rem] sm:rounded-[2.5rem] p-4 sm:p-5 md:p-6 w-full mx-auto overflow-hidden relative transform-gpu">
      <FluxStepCheckoutHeader selectedService={selectedService} />

      <form action={formAction} noValidate>
        <FluxStepCheckoutInputs
          selectedService={selectedService}
          activeNetwork={activeNetwork}
          activeCategory={activeCategory}
          quantity={quantity}
          setQuantity={setQuantity}
          link={link}
          setLink={setLink}
          email={email}
          setEmail={setEmail}
          isRequirementsConfirmed={isRequirementsConfirmed}
          setIsRequirementsConfirmed={setIsRequirementsConfirmed}
          isTgGuideOpen={isTgGuideOpen}
          setIsTgGuideOpen={setIsTgGuideOpen}
          formState={formState}
          showShakeError={showShakeError}
          shakeKey={shakeKey}
          quantityRef={quantityRef}
          emailRef={emailRef}
          linkRef={linkRef}
        />

        <FluxStepCheckoutDripAndCustom
          selectedService={selectedService}
          customData={customData}
          setCustomData={setCustomData}
          isDripFeedEnabled={isDripFeedEnabled}
          setIsDripFeedEnabled={setIsDripFeedEnabled}
          dripRuns={dripRuns}
          setDripRuns={setDripRuns}
          dripInterval={dripInterval}
          setDripInterval={setDripInterval}
          quantity={quantity}
          setQuantity={setQuantity}
          numericQuantity={numericQuantity}
          effectiveQuantity={effectiveQuantity}
          formState={formState}
          shakeKey={shakeKey}
        />

        <FluxStepCheckoutPaymentMethods
          selectedGateway={selectedGateway}
          setSelectedGateway={setSelectedGateway}
          availableGateways={availableGateways}
          userBalanceCents={userBalanceCents}
          price={price}
        />

        {/* Оплата */}
        <div className="flex flex-col items-center mt-4">
          <AnimatePresence mode="popLayout">
            {formState.error && formState.field === "general" && (
              <motion.div 
                key={`err-gen-${shakeKey}`} 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }} 
                animate={{ opacity: 1, height: "auto", marginBottom: 24 }} 
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="w-full p-4 bg-red-50 border border-red-200 rounded-[1.5rem] flex items-center gap-3 shadow-[0_0_15px_rgba(239,68,68,0.2)] overflow-hidden"
              >
                <div className="bg-red-100 p-2 rounded-full text-red-600 flex-shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <span role="alert" className="text-red-700 font-bold text-sm">
                  {formState.error}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full flex items-center justify-between mb-4 px-2">
            <span className="text-muted-foreground font-semibold">К оплате:</span>
            <div className="flex items-baseline gap-1.5 tabular-nums font-mono">
              <span className="text-2xl font-black text-foreground tracking-tight">
                {parseFloat(price) < 10 ? "10.00" : price}
              </span>
              <span className="text-lg font-bold text-muted-foreground font-sans">₽</span>
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full h-14 bg-foreground text-background font-bold text-base rounded-[1.25rem] sm:rounded-[1.5rem] shadow-lg hover:bg-foreground/90 transition-all cursor-pointer"
            isPending={isPending}
          >
            <span>{selectedGateway === "balance" ? "Оплатить с баланса" : "Перейти к оплате"}</span>
            <ArrowRightIcon className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </form>
    </div>
  );
}
