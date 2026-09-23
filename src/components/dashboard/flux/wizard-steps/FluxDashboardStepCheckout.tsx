'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { slideVariants } from './types';
import type { FluxDashboardStepCheckoutProps } from './checkout-sub/types';
import { FluxCheckoutServiceHeader } from './checkout-sub/FluxCheckoutServiceHeader';
import { FluxCheckoutLinkAndQty } from './checkout-sub/FluxCheckoutLinkAndQty';
import { FluxCheckoutDripFeed } from './checkout-sub/FluxCheckoutDripFeed';
import { FluxCheckoutCustomDataAndRequirements } from './checkout-sub/FluxCheckoutCustomDataAndRequirements';
import { FluxCheckoutPromoCard } from './checkout-sub/FluxCheckoutPromoCard';
import { FluxCheckoutPaymentSelector } from './checkout-sub/FluxCheckoutPaymentSelector';
import { FluxCheckoutSummaryBar } from './checkout-sub/FluxCheckoutSummaryBar';

export function FluxDashboardStepCheckout(props: FluxDashboardStepCheckoutProps) {
  const {
    direction,
    selectedService,
    activeNetwork,
    activeCategory,
    link,
    setLink,
    linkRef,
    quantity,
    setQuantity,
    quantityRef,
    qtyNum,
    isDripFeedEnabled,
    setIsDripFeedEnabled,
    dripRuns,
    setDripRuns,
    dripInterval,
    setDripInterval,
    customData,
    setCustomData,
    customDataRef,
    isRequirementsConfirmed,
    setIsRequirementsConfirmed,
    requirementRef,
    email,
    setEmail,
    emailRef,
    showPromo,
    setShowPromo,
    promoCode,
    setPromoCode,
    appliedPromo,
    isApplyingPromo,
    promoMessage,
    handleApplyPromo,
    handleRemovePromo,
    gateway,
    setGateway,
    availableGateways,
    userBalanceRub,
    canPayFromBalance,
    totalPriceRub,
    originalServerPriceRub,
    discountPercent,
    errorMessage,
    errorField,
    shakeKey,
    isSubmitting,
    setIsTgGuideOpen,
    onSubmit,
  } = props;

  return (
    <motion.div
      key="step-checkout"
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="w-full space-y-6"
    >
      <div className="bg-card/90 backdrop-blur-md border border-border/40 shadow-xl rounded-[2rem] p-5 sm:p-7 space-y-6">
        <FluxCheckoutServiceHeader
          selectedService={selectedService}
          activeNetwork={activeNetwork}
          activeCategory={activeCategory}
        />

        <form onSubmit={onSubmit} className="space-y-5">
          <FluxCheckoutLinkAndQty
            selectedService={selectedService}
            link={link}
            setLink={setLink}
            linkRef={linkRef}
            quantity={quantity}
            setQuantity={setQuantity}
            quantityRef={quantityRef}
            qtyNum={qtyNum}
            errorField={errorField}
            shakeKey={shakeKey}
            setIsTgGuideOpen={setIsTgGuideOpen}
          />

          <FluxCheckoutDripFeed
            selectedService={selectedService}
            isDripFeedEnabled={isDripFeedEnabled}
            setIsDripFeedEnabled={setIsDripFeedEnabled}
            dripRuns={dripRuns}
            setDripRuns={setDripRuns}
            dripInterval={dripInterval}
            setDripInterval={setDripInterval}
            qtyNum={qtyNum}
            setQuantity={setQuantity}
          />

          <FluxCheckoutCustomDataAndRequirements
            selectedService={selectedService}
            customData={customData}
            setCustomData={setCustomData}
            customDataRef={customDataRef}
            isRequirementsConfirmed={isRequirementsConfirmed}
            setIsRequirementsConfirmed={setIsRequirementsConfirmed}
            requirementRef={requirementRef}
            email={email}
            setEmail={setEmail}
            emailRef={emailRef}
            errorField={errorField}
            shakeKey={shakeKey}
          />

          <FluxCheckoutPromoCard
            showPromo={showPromo}
            setShowPromo={setShowPromo}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            appliedPromo={appliedPromo}
            isApplyingPromo={isApplyingPromo}
            promoMessage={promoMessage}
            handleApplyPromo={handleApplyPromo}
            handleRemovePromo={handleRemovePromo}
          />

          <FluxCheckoutPaymentSelector
            gateway={gateway}
            setGateway={setGateway}
            availableGateways={availableGateways}
            userBalanceRub={userBalanceRub}
          />

          <FluxCheckoutSummaryBar
            selectedService={selectedService}
            qtyNum={qtyNum}
            isDripFeedEnabled={isDripFeedEnabled}
            dripRuns={dripRuns}
            totalPriceRub={totalPriceRub}
            originalServerPriceRub={originalServerPriceRub}
            discountPercent={discountPercent}
            errorMessage={errorMessage}
            isSubmitting={isSubmitting}
            gateway={gateway}
            canPayFromBalance={canPayFromBalance}
          />
        </form>
      </div>
    </motion.div>
  );
}
