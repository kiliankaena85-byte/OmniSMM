'use client';

import React from 'react';
import { ActionForm } from '@/components/admin/action-form';
import type { OrderSummaryCardProps } from './summary/types';
import { OrderSummaryEmptyState } from './summary/OrderSummaryEmptyState';
import { OrderSummaryCustomData } from './summary/OrderSummaryCustomData';
import { OrderSummaryInputs } from './summary/OrderSummaryInputs';
import { OrderSummaryDripSection } from './summary/OrderSummaryDripSection';
import { OrderSummaryPricingGateway } from './summary/OrderSummaryPricingGateway';
import { OrderSummarySubmitBar } from './summary/OrderSummarySubmitBar';
import { OrderRequirementsModal } from './summary/OrderRequirementsModal';
import { useOrderSummarySubmit } from './summary/useOrderSummarySubmit';

export function OrderSummaryCard({ userBalanceCents = 0, engine }: OrderSummaryCardProps) {
  const {
    selectedService,
    quantity,
    setQuantity,
    email,
    setEmail,
    promoCode,
    setPromoCode,
    dripFeedEnabled,
    setDripFeedEnabled,
    runs,
    setRuns,
    dripInterval,
    setDripInterval,
    isSmartDrip,
    setIsSmartDrip,
    smartDripDays,
    setSmartDripDays,
    isCalculating,
    totalPriceFormatted,
    validationErrors,
  } = engine;

  const {
    gateway,
    setGateway,
    showRequirementsModal,
    setShowRequirementsModal,
    modalRequirements,
    submitting,
    formRef,
    totalPrice,
    userBalanceRub,
    handlePreSubmit,
    confirmRequirementsAndSubmit,
    handleAction,
  } = useOrderSummarySubmit({ userBalanceCents, engine });

  if (!selectedService) {
    return <OrderSummaryEmptyState />;
  }

  return (
    <>
      <div className="bg-card shadow-sm ring-1 ring-border rounded-2xl p-4 sm:p-6 space-y-6 lg:sticky lg:top-6">
        <ActionForm action={handleAction} className="space-y-5" formRef={formRef}>
          {/* Selected service badge */}
          <div className="bg-muted ring-1 ring-border rounded-xl p-4">
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Выбрано
            </div>
            <div className="text-sm font-semibold text-foreground line-clamp-2">
              {selectedService.name}
            </div>
          </div>

          {/* Dynamic Payload & Warnings */}
          <OrderSummaryCustomData
            selectedService={selectedService}
            customData={engine.customData}
            setCustomData={engine.setCustomData}
          />

          {/* Stepper, Email, Promo */}
          <OrderSummaryInputs
            selectedService={selectedService}
            quantity={quantity}
            setQuantity={setQuantity}
            email={email}
            setEmail={setEmail}
            promoCode={promoCode}
            setPromoCode={setPromoCode}
            gateway={gateway}
            validationErrors={validationErrors}
          />

          {/* Drip Feed & Smart Drip */}
          <OrderSummaryDripSection
            selectedService={selectedService}
            dripFeedEnabled={dripFeedEnabled}
            setDripFeedEnabled={setDripFeedEnabled}
            runs={runs}
            setRuns={setRuns}
            dripInterval={dripInterval}
            setDripInterval={setDripInterval}
            isSmartDrip={isSmartDrip}
            setIsSmartDrip={setIsSmartDrip}
            smartDripDays={smartDripDays}
            setSmartDripDays={setSmartDripDays}
            quantity={quantity}
            setQuantity={setQuantity}
            validationErrors={validationErrors}
          />

          {/* Pricing & Gateway */}
          <OrderSummaryPricingGateway
            totalPriceFormatted={totalPriceFormatted}
            totalPrice={totalPrice}
            isCalculating={isCalculating}
            gateway={gateway}
            setGateway={setGateway}
          />

          {/* Submit & Consent */}
          <OrderSummarySubmitBar
            submitting={submitting}
            gateway={gateway}
            userBalanceRub={userBalanceRub}
            totalPrice={totalPrice}
            totalPriceFormatted={totalPriceFormatted}
            onPreSubmit={handlePreSubmit}
          />
        </ActionForm>
      </div>

      {/* Requirements Modal */}
      <OrderRequirementsModal
        isOpen={showRequirementsModal}
        requirements={modalRequirements}
        onClose={() => setShowRequirementsModal(false)}
        onConfirm={confirmRequirementsAndSubmit}
      />
    </>
  );
}
