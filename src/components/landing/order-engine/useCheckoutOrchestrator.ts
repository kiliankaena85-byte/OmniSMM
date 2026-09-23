'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { generateStableIdempotencyKey } from '@/hooks/useBaseOrderValidation';
import type { OrchestratorCheckoutParams, OrderCheckoutResultData, CheckoutOrchestratorOptions } from './orchestrator/types';
import { validatePreflightAndLink } from './orchestrator/preflight-validator';
import { validateWarningsAndRequirements } from './orchestrator/requirements-guard';
import { handlePaymentSuccess, handlePaymentFailure } from './orchestrator/checkout-dispatcher';

export type { OrderCheckoutResultData };

export function useCheckoutOrchestrator({ 
  engine, 
  desktopEmailInputRef, 
  mobileEmailInputRef,
  abVariant
}: CheckoutOrchestratorOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stableIdempotencyKey, setStableIdempotencyKey] = useState<string>(() => generateStableIdempotencyKey());
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkHasError, setLinkHasError] = useState(false);
  const [quantityHasError, setQuantityHasError] = useState(false);
  const [emailHasError, setEmailHasError] = useState(false);
  const [termsHasError, setTermsHasError] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalEmail, setAuthModalEmail] = useState('');
  const [pendingCheckoutParams, setPendingCheckoutParams] = useState<OrchestratorCheckoutParams | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    if (checkoutError) setCheckoutError(null);
  }, [engine.url, engine.quantity, engine.email, engine.agreedToTerms]);

  useEffect(() => {
    if (engine.quantity > 0) setQuantityHasError(false);
  }, [engine.quantity]);

  useEffect(() => {
    if (engine.email && engine.email.includes('@')) setEmailHasError(false);
  }, [engine.email]);

  useEffect(() => {
    if (engine.agreedToTerms) setTermsHasError(false);
  }, [engine.agreedToTerms]);

  const handleCheckout = async (directGateway?: string | unknown, overrideEmail?: string) => {
    const resolvedGateway = typeof directGateway === 'string' && directGateway.trim().length > 0 && directGateway !== '[object Object]'
      ? directGateway.trim()
      : undefined;

    setLinkHasError(false);
    const preflight = validatePreflightAndLink(engine);
    if (!preflight.isValid) {
      if (preflight.error) setCheckoutError(preflight.error);
      if (preflight.shouldShowLinkModal) {
        setLinkHasError(true);
        setShowLinkModal(true);
      }
      return;
    }

    const finalUrl = preflight.finalUrl || engine.url.trim();
    const effectiveEmail = overrideEmail?.trim() || engine.email?.trim();

    const requirements = validateWarningsAndRequirements(
      engine,
      finalUrl,
      effectiveEmail,
      desktopEmailInputRef,
      mobileEmailInputRef
    );

    if (!requirements.isValid) {
      if (requirements.quantityHasError) setQuantityHasError(true);
      if (requirements.termsHasError) setTermsHasError(true);
      if (requirements.emailHasError) setEmailHasError(true);
      if (requirements.error) setCheckoutError(requirements.error);
      return;
    }

    setCheckoutError(null);
    const selectedService = engine.selectedService!;
    const checkoutParams: OrchestratorCheckoutParams = {
      serviceId: selectedService.id,
      link: finalUrl,
      quantity: engine.quantity,
      email: effectiveEmail || "",
      customData: engine.customData?.trim() || undefined,
      promoCodeStr: engine.promoCode?.trim() || undefined,
      mediaGroupUrl: engine.mediaGroupUrl?.trim() || undefined,
      isLinkOverridden: engine.isLinkOverridden,
      isSmartDrip: engine.isSmartDrip,
      smartDripDays: engine.isSmartDrip ? engine.smartDripDays : undefined,
      runs: engine.dripFeedEnabled ? engine.runs : undefined,
      interval: engine.dripFeedEnabled ? engine.dripInterval : undefined,
      abVariant: abVariant || undefined,
      isRequirementsConfirmed: engine.isWarningConfirmed,
      idempotencyKey: stableIdempotencyKey
    };

    if (resolvedGateway) {
      setIsSubmitting(true);
      try {
        const { checkoutAction } = await import('@/actions/order/checkout');
        const res = await checkoutAction({ ...checkoutParams, gateway: resolvedGateway });
        if (res.success) {
          setStableIdempotencyKey(generateStableIdempotencyKey());
          const ok = handlePaymentSuccess(res.data as OrderCheckoutResultData, resolvedGateway, true);
          if (!ok) setIsSubmitting(false);
          return;
        }
        setIsSubmitting(false);
        handlePaymentFailure(
          res.error,
          (res as { code?: string })?.code,
          checkoutParams.serviceId,
          resolvedGateway,
          true,
          () => {
            setAuthModalEmail(effectiveEmail || (res as { email?: string })?.email || '');
            setShowAuthModal(true);
          },
          (targetGateway, redirectUrl) => {
            if (targetGateway) handleCheckout(targetGateway);
            else if (redirectUrl) window.location.href = redirectUrl;
          }
        );
      } catch (e: unknown) {
        setIsSubmitting(false);
        handlePaymentFailure(
          e,
          (e as { code?: string })?.code,
          checkoutParams.serviceId,
          resolvedGateway,
          true,
          () => {
            setAuthModalEmail(effectiveEmail || '');
            setShowAuthModal(true);
          }
        );
      }
      return;
    }

    setPendingCheckoutParams(checkoutParams);
    setShowPaymentModal(true);
  };

  const confirmAndPay = async (gateway: string) => {
    if (!pendingCheckoutParams) return;
    setIsSubmitting(true);
    try {
      const { checkoutAction } = await import('@/actions/order/checkout');
      const res = await checkoutAction({
        email: pendingCheckoutParams.email || "",
        link: pendingCheckoutParams.link || "",
        quantity: pendingCheckoutParams.quantity || 0,
        serviceId: pendingCheckoutParams.serviceId || "",
        runs: pendingCheckoutParams.runs,
        interval: pendingCheckoutParams.interval,
        idempotencyKey: pendingCheckoutParams.idempotencyKey || stableIdempotencyKey,
        isLinkOverridden: pendingCheckoutParams.isLinkOverridden,
        isRequirementsConfirmed: pendingCheckoutParams.isRequirementsConfirmed,
        promoCodeStr: pendingCheckoutParams.promoCodeStr,
        customData: pendingCheckoutParams.customData,
        mediaGroupUrl: pendingCheckoutParams.mediaGroupUrl,
        isSmartDrip: pendingCheckoutParams.isSmartDrip,
        smartDripDays: pendingCheckoutParams.smartDripDays,
        abVariant: pendingCheckoutParams.abVariant,
        gateway
      });
      setIsSubmitting(false);
      setShowPaymentModal(false);

      if (res.success) {
        setStableIdempotencyKey(generateStableIdempotencyKey());
        handlePaymentSuccess(res.data as OrderCheckoutResultData, gateway, false);
      } else {
        handlePaymentFailure(
          res.error,
          (res as { code?: string })?.code,
          pendingCheckoutParams.serviceId,
          gateway,
          false,
          () => {
            setShowPaymentModal(false);
            setAuthModalEmail(pendingCheckoutParams.email || (res as { email?: string })?.email || '');
            setShowAuthModal(true);
          }
        );
      }
    } catch (e: unknown) {
      setIsSubmitting(false);
      handlePaymentFailure(
        e,
        (e as { code?: string })?.code,
        pendingCheckoutParams.serviceId,
        gateway,
        false,
        () => {
          setShowPaymentModal(false);
          setAuthModalEmail(pendingCheckoutParams?.email || '');
          setShowAuthModal(true);
        }
      );
    }
  };

  const handleAuthSuccess = async () => {
    setShowAuthModal(false);
    toast.success("Вы успешно вошли в аккаунт!", {
      description: "Продолжаем оформление заказа..."
    });
    try {
      const { refreshBalanceAction } = await import('@/actions/auth/refresh-balance');
      await refreshBalanceAction();
    } catch {
      /* ignore balance refresh error */
    }
    if (pendingCheckoutParams) {
      setShowPaymentModal(true);
    } else {
      handleCheckout();
    }
  };

  return {
    isSubmitting,
    showLinkModal,
    setShowLinkModal,
    linkHasError,
    setLinkHasError,
    handleCheckout,
    quantityHasError,
    emailHasError,
    termsHasError,
    showPaymentModal,
    setShowPaymentModal,
    showAuthModal,
    setShowAuthModal,
    authModalEmail,
    handleAuthSuccess,
    orderSnapshot: {
      serviceId: engine.selectedService?.id,
      link: engine.url,
      quantity: engine.quantity,
      promoCode: engine.promoCode,
      runs: engine.dripFeedEnabled ? engine.runs : undefined,
      interval: engine.dripFeedEnabled ? engine.dripInterval : undefined,
      isSmartDrip: engine.isSmartDrip,
      smartDripDays: engine.smartDripDays,
      networkId: engine.networkId,
      categoryId: engine.categoryId,
      customData: engine.customData,
    },
    confirmAndPay,
    checkoutError,
    setCheckoutError
  };
}
