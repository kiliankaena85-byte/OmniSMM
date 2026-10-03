import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { OrderEngine } from '@/hooks/useOrderEngine';
import type { PaymentGateway } from './types';
import { checkOrderPreflight } from './order-summary-preflight';

interface UseOrderSummarySubmitProps {
  userBalanceCents: number;
  engine: OrderEngine;
}

export function useOrderSummarySubmit({ userBalanceCents, engine }: UseOrderSummarySubmitProps) {
  const {
    url,
    selectedService,
    quantity,
    email,
    promoCode,
    dripFeedEnabled,
    runs,
    dripInterval,
    isCalculating,
    validate,
    pricing,
    mediaGroupMultiplier,
  } = engine;

  const [gateway, setGateway] = useState<PaymentGateway>('yookassa');
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [requirementsConfirmed, setRequirementsConfirmed] = useState(false);
  const [modalRequirements, setModalRequirements] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKeyRef = useRef<string>('');
  const isFirstLoadRef = useRef<boolean>(true);

  const finalTotalCents = (pricing?.totalCents ?? 0) * (mediaGroupMultiplier ?? 1);
  const totalPrice = finalTotalCents / 100;
  const userBalanceRub = userBalanceCents / 100;

  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
  }, []);

  useEffect(() => {
    if (totalPrice > 0 && isFirstLoadRef.current) {
      if (userBalanceRub >= totalPrice) {
        setGateway('balance');
      } else {
        setGateway('yookassa');
      }
      isFirstLoadRef.current = false;
    }
  }, [totalPrice, userBalanceRub]);

  useEffect(() => {
    setRequirementsConfirmed(false);
    const reqs = (selectedService as unknown as { features?: { requirements?: string[] } })?.features?.requirements;
    if (reqs && Array.isArray(reqs) && reqs.length > 0) {
      setModalRequirements(reqs);
    } else {
      setModalRequirements([]);
    }
  }, [selectedService]);

  const handlePreSubmit = useCallback(() => {
    if (submitting) return;

    const ok = checkOrderPreflight({
      isCalculating,
      pricing,
      finalTotalCents,
      selectedService,
      quantity,
      url,
      customData: engine.customData,
      validate,
    });
    if (!ok) return;

    if (modalRequirements.length > 0 && !requirementsConfirmed) {
      setShowRequirementsModal(true);
    } else {
      formRef.current?.requestSubmit();
    }
  }, [submitting, isCalculating, pricing, finalTotalCents, selectedService, quantity, url, engine.customData, validate, modalRequirements.length, requirementsConfirmed]);

  const confirmRequirementsAndSubmit = useCallback(() => {
    if (submitting) return;
    setRequirementsConfirmed(true);
    setShowRequirementsModal(false);
    setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 50);
  }, [submitting]);

  const handleAction = useCallback(async () => {
    if (submitting) return { error: 'Заказ уже обрабатывается' };
    setSubmitting(true);
    try {
      if (!validate()) return { error: 'Проверьте правильность введённых данных' };
      if (!selectedService) return { error: 'Выберите услугу' };

      const { checkoutAction } = await import('@/actions/order/checkout');
      const res = await checkoutAction({
        serviceId: selectedService.id,
        link: url,
        quantity,
        email,
        runs: dripFeedEnabled ? runs : undefined,
        interval: dripFeedEnabled ? dripInterval : undefined,
        customData: engine.customData || undefined,
        promoCodeStr: promoCode || undefined,
        gateway,
        idempotencyKey: idempotencyKeyRef.current,
      });

      if (res.success) {
        if (res.data?.paymentUrl) {
          window.location.href = res.data.paymentUrl;
        } else if (res.data?.orderId) {
          window.location.href = `/success?orderId=${res.data.orderId}`;
        } else if (res.data?.paymentId) {
          window.location.href = `/success?paymentId=${res.data.paymentId}`;
        }
        return res;
      }

      if (res.error?.startsWith('VOUCHER_USE_BALANCE:')) {
        toast.error(
          'Это ваучер на пополнение баланса. Перейдите в раздел «Мой баланс» для активации.',
          {
            position: 'top-center',
            duration: 6000,
            action: {
              label: 'Мой баланс',
              onClick: () => (window.location.href = '/dashboard/add-funds'),
            },
          }
        );
        return { ...res, error: undefined };
      }

      const errorMessage = res.error || 'Ошибка создания заказа. Попробуйте снова.';
      window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&serviceId=${selectedService.id}&gateway=${gateway}&email=${encodeURIComponent(email)}&quantity=${quantity}&url=${encodeURIComponent(url)}`;
      return { success: false, error: undefined };
    } catch (e: unknown) {
      const err = e as Error;
      const errorMessage = err.message || 'Ошибка платежного шлюза.';
      window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&serviceId=${selectedService?.id || ''}&gateway=${gateway}&email=${encodeURIComponent(email)}&quantity=${quantity}&url=${encodeURIComponent(url)}`;
      return { success: false, error: undefined };
    } finally {
      setSubmitting(false);
    }
  }, [submitting, validate, selectedService, url, quantity, email, dripFeedEnabled, runs, dripInterval, engine.customData, promoCode, gateway]);

  return {
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
  };
}
