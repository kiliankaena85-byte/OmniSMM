'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PublicService } from '@/actions/order/catalog';
import { OrderEngine } from '@/hooks/useOrderEngine';
import { getAvailableGatewaysAction } from '@/actions/order/checkout';
import { safeFocus } from '@/utils/scroll-helpers';
import { PlanCheckoutHeader } from './PlanCheckoutHeader';
import { PlanCheckoutInputs } from './PlanCheckoutInputs';
import { PlanCheckoutGateways } from './PlanCheckoutGateways';
import { PlanCheckoutSummary } from './PlanCheckoutSummary';
import { validateAndSubmitPlanCheckout } from './usePlanCheckoutValidation';

export interface PlanFullscreenCheckoutProps {
  engine: OrderEngine;
  selectedService: PublicService;
  onClose: () => void;
  onOpenDocument?: (slug: string) => void;
  userBalanceCents?: number;
  handleCheckout: (gateway?: string, overrideEmail?: string) => void;
  isSubmitting?: boolean;
  checkoutError?: string | null;
}

export function PlanFullscreenCheckout({
  engine,
  selectedService,
  onClose,
  onOpenDocument,
  userBalanceCents = 0,
  handleCheckout,
  isSubmitting = false,
  checkoutError = null,
}: PlanFullscreenCheckoutProps) {
  const {
    url, setUrl, quantity, setQuantity, email, setEmail,
    customData, setCustomData, agreedToTerms, setAgreedToTerms,
    dripFeedEnabled, setDripFeedEnabled, runs, setRuns,
    dripInterval, setDripInterval, catalog, networkId, pricing,
    totalPriceFormatted, isWarningConfirmed, setIsWarningConfirmed,
  } = engine;

  const [selectedGateway, setSelectedGateway] = useState<string>('yookassa');
  const [availableGateways, setAvailableGateways] = useState<{ yookassa: boolean; robokassa?: boolean; cryptobot: boolean } | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState<number>(0);

  const linkInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const activeNetwork = catalog.find(n => n.id === networkId) ||
    catalog.find(n => n.categories.some(c => c.id === selectedService.categoryId)) ||
    catalog[0] || null;

  const activeCategory = activeNetwork?.categories.find(c => c.id === selectedService.categoryId) || null;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.history.pushState({ smmplan_fullscreen_checkout: true }, '', window.location.href);
    }
    const handlePopState = () => onClose();
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onClose]);

  useEffect(() => {
    getAvailableGatewaysAction().then((res) => {
      if (res.success && res.data) {
        setAvailableGateways(res.data);
        if (selectedGateway !== 'balance' && !res.data[selectedGateway as keyof typeof res.data]) {
          const first = (['yookassa', 'cryptobot'] as const).find((g) => res.data?.[g]);
          if (first) setSelectedGateway(first);
        }
      }
    });
  }, [selectedGateway]);

  useEffect(() => {
    if (!url && linkInputRef.current && typeof window !== 'undefined' && window.innerWidth >= 768) {
      safeFocus(linkInputRef.current);
    }
  }, []);

  const minQty = selectedService.minQty || 100;
  const maxQty = selectedService.maxQty || 1000000;
  const effectiveMinQty = dripFeedEnabled && runs > 0 ? minQty * runs : minQty;

  useEffect(() => {
    if (!quantity || Number(quantity) < minQty) {
      setQuantity(minQty);
    }
  }, [minQty, quantity, setQuantity]);

  const handleStepQuantity = (delta: number) => {
    const current = Number(quantity) || minQty;
    const next = Math.max(effectiveMinQty, Math.min(maxQty, current + delta));
    setQuantity(next);
    setLocalError(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndSubmitPlanCheckout({
      url, selectedService, isWarningConfirmed, customData, quantity,
      minQty, maxQty, effectiveMinQty, dripFeedEnabled, runs, email,
      agreedToTerms, selectedGateway, linkInputRef, emailInputRef,
      quantityInputRef, setLocalError, setShakeKey, handleCheckout,
    });
  };

  return (
    <div className="w-full flex flex-col items-center py-2 sm:py-6 px-2 sm:px-4 animate-in fade-in duration-300">
      <PlanCheckoutHeader
        selectedService={selectedService}
        activeNetwork={activeNetwork}
        activeCategory={activeCategory}
        minQty={minQty}
        maxQty={maxQty}
        onBackClick={onClose}
        onResetClick={() => {
          engine.resetOrder();
          onClose();
        }}
      />

      <div className="w-full max-w-2xl sm:max-w-3xl bg-card border border-border/80 shadow-2xl rounded-3xl p-4 sm:p-7 md:p-8 relative">
        <form onSubmit={handleFormSubmit} noValidate className="space-y-5">
          <PlanCheckoutInputs
            url={url}
            setUrl={setUrl}
            selectedService={selectedService}
            activeNetwork={activeNetwork}
            linkInputRef={linkInputRef}
            emailInputRef={emailInputRef}
            quantityInputRef={quantityInputRef}
            isWarningConfirmed={isWarningConfirmed}
            setIsWarningConfirmed={setIsWarningConfirmed}
            customData={customData}
            setCustomData={setCustomData}
            quantity={quantity}
            setQuantity={setQuantity}
            minQty={minQty}
            maxQty={maxQty}
            effectiveMinQty={effectiveMinQty}
            handleStepQuantity={handleStepQuantity}
            dripFeedEnabled={dripFeedEnabled}
            setDripFeedEnabled={setDripFeedEnabled}
            runs={runs}
            setRuns={setRuns}
            dripInterval={dripInterval}
            setDripInterval={setDripInterval}
            email={email}
            setEmail={setEmail}
            setLocalError={setLocalError}
          />

          <PlanCheckoutGateways
            selectedGateway={selectedGateway}
            setSelectedGateway={setSelectedGateway}
            availableGateways={availableGateways}
            userBalanceCents={userBalanceCents}
            totalCents={pricing?.totalCents || 0}
            setLocalError={setLocalError}
          />

          <PlanCheckoutSummary
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={setAgreedToTerms}
            onOpenDocument={onOpenDocument}
            localError={localError}
            checkoutError={checkoutError}
            shakeKey={shakeKey}
            isSubmitting={isSubmitting}
            totalPriceFormatted={totalPriceFormatted}
            setLocalError={setLocalError}
          />
        </form>
      </div>
    </div>
  );
}
