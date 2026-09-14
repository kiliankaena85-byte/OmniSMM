interface OrchestratorCheckoutParams {
  email?: string;
  expectedTotalRub?: number;
  serviceId?: string;
  link?: string;
  quantity?: number;
  runs?: number;
  interval?: number;
  idempotencyKey?: string;
  isLinkOverridden?: boolean;
  isRequirementsConfirmed?: boolean;
  [key: string]: unknown;
}

export interface OrderCheckoutResultData {
  orderId?: string;
  numericId?: string | number;
  paymentUrl?: string;
  paymentId?: string;
  redirectUrl?: string;
  guestOrderToken?: string;
}

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { OrderEngine } from '@/hooks/useOrderEngine';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { inferTargetTypeFromCategory } from '@/utils/target-type';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { ABVariant } from '@/hooks/useABTest';
import { executePaymentRedirect } from '@/utils/payment-redirect';
import { parseActionableError } from '@/lib/errors/actionable-error';
import { safeFocus } from '@/utils/scroll-helpers';

interface CheckoutOrchestratorOptions {
  engine: OrderEngine;
  desktopEmailInputRef?: React.RefObject<HTMLInputElement | null>;
  mobileEmailInputRef?: React.RefObject<HTMLInputElement | null>;
  abVariant?: ABVariant | null;
}

export function useCheckoutOrchestrator({ 
  engine, 
  desktopEmailInputRef, 
  mobileEmailInputRef,
  abVariant
}: CheckoutOrchestratorOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    if (checkoutError) {
      setCheckoutError(null);
    }
  }, [engine.url, engine.quantity, engine.email, engine.agreedToTerms]);

  useEffect(() => {
    if (engine.quantity > 0) {
      setQuantityHasError(false);
    }
  }, [engine.quantity]);

  useEffect(() => {
    if (engine.email && engine.email.includes('@')) {
      setEmailHasError(false);
    }
  }, [engine.email]);

  useEffect(() => {
    if (engine.agreedToTerms) {
      setTermsHasError(false);
    }
  }, [engine.agreedToTerms]);

  const handleCheckout = async (directGateway?: string | unknown, overrideEmail?: string) => {
    // Guard against React SyntheticEvent or non-string arguments
    const resolvedGateway = typeof directGateway === 'string' && directGateway.trim().length > 0 && directGateway !== '[object Object]'
      ? directGateway.trim()
      : undefined;

    const { selectedService, url, quantity, customData, agreedToTerms, email: engineEmail, promoCode } = engine;
    const email = overrideEmail?.trim() || engineEmail?.trim();

    if (!selectedService) {
      setCheckoutError("Пожалуйста, выберите услугу.");
      toast.error("Пожалуйста, выберите услугу.", { position: 'top-center' });
      return;
    }
    if (selectedService.cooldownUntil && new Date(selectedService.cooldownUntil) > new Date()) {
      toast.error("Эта услуга временно недоступна для заказа (находится на проверке качества). Пожалуйста, выберите другую.", { position: 'top-center' });
      return;
    }

    if (engine.isCalculating) {
      toast.error("Идет расчет стоимости заказа. Пожалуйста, подождите...", { position: 'top-center' });
      return;
    }
    if (!engine.pricing) {
      toast.error("Не удалось рассчитать стоимость заказа. Пожалуйста, проверьте количество или попробуйте позже.", { position: 'top-center' });
      return;
    }


    // --- WAVE 4.2 CROSS-PLATFORM MISMATCH PROTECTION ---
    const activeNetwork = engine.catalog.find(n => n.id === engine.networkId);
    if (!engine.isLinkOverridden && engine.platform && activeNetwork) {
      const detectedPlatform = engine.platform.toLowerCase();
      const selectedPlatform = activeNetwork.slug.toLowerCase();
      
      // Allow if either string includes the other (e.g. 'instagram' vs 'instagram_likes')
      if (!selectedPlatform.includes(detectedPlatform) && !detectedPlatform.includes(selectedPlatform)) {
        setLinkHasError(true);
        toast.error(`Ссылка не подходит. Указана ссылка для ${engine.platform}, но выбрана соцсеть ${activeNetwork.name}.`, { position: 'top-center' });
        setShowLinkModal(true);
        return;
      }
    }
    // ---------------------------------------------------
    
    setLinkHasError(false);
    const rawUrl = url.trim();
    if (rawUrl.length < 3) {
      setLinkHasError(true);
      toast.error("Ссылка или юзернейм слишком короткие.", { position: 'top-center' });
      setShowLinkModal(true);
      return;
    }
    if (rawUrl.includes(' ')) {
      setLinkHasError(true);
      toast.error("Ссылка не должна содержать пробелов.", { position: 'top-center' });
      setShowLinkModal(true);
      return;
    }
    if (/[а-яА-Я]/.test(rawUrl) && !rawUrl.includes('рф')) {
      setLinkHasError(true);
      toast.error("Ссылка содержит недопустимые символы (кириллицу).", { position: 'top-center' });
      setShowLinkModal(true);
      return;
    }

    // --- HIGH-PRECISION LINK VALIDATION & MUTATION ---
    const activePlatform = engine.platform || engine.manualPlatform;
    let finalUrl = rawUrl;

    if (!engine.isLinkOverridden && selectedService && activePlatform && activePlatform !== IntelligencePlatform.OTHER) {
      const activeCat = engine.catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
      const targetType = selectedService.targetType === 'POST'
        ? inferTargetTypeFromCategory(activeCat?.name)
        : (selectedService.targetType || inferTargetTypeFromCategory(activeCat?.name));

      const cleanUrl = mutateLink(finalUrl, activePlatform, targetType);
      if (cleanUrl !== finalUrl) {
        finalUrl = cleanUrl;
        engine.setUrl(cleanUrl);
      }

      const validator = getLinkValidator(activePlatform, targetType);
      const linkResult = validator.safeParse(finalUrl);
      
      if (!linkResult.success) {
        // Format the error message with a hint that bypass is available
        const baseMsg = linkResult.error.errors[0].message;
        const bypassHint = '\n\nЕсли ваша ссылка уже корректная — нажмите «Изменить ссылку» и включите «Использовать как есть».';
        setLinkHasError(true);
        toast.error(baseMsg + bypassHint, { position: 'top-center', duration: 6000 });
        setShowLinkModal(true);
        return;
      }
    } else {
      // Fallback basic url schema parsing (also runs for overridden links)
      if (!/^https?:\/\//i.test(finalUrl) && finalUrl.includes('.')) {
        finalUrl = 'https://' + finalUrl;
        engine.setUrl(finalUrl);
      }
      if (/^https?:\/\//i.test(finalUrl)) {
        try {
          const u = new URL(finalUrl);
          if (!u.hostname.includes('.')) {
            setLinkHasError(true);
            toast.error("Указан некорректный домен.", { position: 'top-center' });
            setShowLinkModal(true);
            return;
          }
          if (u.pathname === '/' || u.pathname.length < 2) {
            setLinkHasError(true);
            toast.error("Укажите ссылку на конкретный профиль или пост, а не на главную страницу.", { position: 'top-center' });
            setShowLinkModal(true);
            return;
          }
        } catch {
          setLinkHasError(true);
          toast.error("Неверный формат ссылки.", { position: 'top-center' });
          setShowLinkModal(true);
          return;
        }
      } else {
        setLinkHasError(true);
        toast.error("Ссылка в обход валидации должна быть корректной (начинаться с http:// или https://)", { position: 'top-center' });
        setShowLinkModal(true);
        return;
      }
    }
    // -------------------------------------------------
    // --- WAVE 4.3 MANDATORY WARNING CONFIRMATION CHECK ---
    const sName = selectedService.name.toLowerCase();
    const isLiveStream = sName.includes('зрител') || sName.includes('эфир') || sName.includes('трансляц');
    const isPrivateChannel = sName.includes('закрыт');
    
    const urlLower = url.toLowerCase();
    const isPrivateTelegramPost = urlLower.includes('t.me/c/') || urlLower.includes('telegram.me/c/');
    const isVkPhotoOrVideo = urlLower.includes('vk.com/photo') || urlLower.includes('vk.com/video') || urlLower.includes('vk.ru/photo') || urlLower.includes('vk.ru/video') || urlLower.includes('vkvideo.ru/');

    const activeCategory = activeNetwork?.categories.find(c => c.id === engine.categoryId);
    const isTelegramViews = activeNetwork?.slug?.toLowerCase() === 'telegram'
      && activeCategory?.name?.toLowerCase().includes('просмотр')
      && !activeCategory?.name?.toLowerCase().includes('авто')
      && !activeCategory?.name?.toLowerCase().includes('auto')
      && !activeCategory?.name?.toLowerCase().includes('будущ')
      && selectedService?.targetType !== 'CHANNEL';

    // Validation message from validator
    let validationWarningActive = false;
    if (url.trim().length > 3 && selectedService && activeNetwork) {
      const activePlatform = engine.platform || engine.manualPlatform;
      const validationPlatform = (activePlatform && activePlatform !== IntelligencePlatform.OTHER)
        ? activePlatform
        : activeNetwork.slug.toUpperCase();
      
      const activeCatForVal = engine.catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
      const targetType = selectedService.targetType === 'POST'
        ? inferTargetTypeFromCategory(activeCatForVal?.name)
        : (selectedService.targetType || inferTargetTypeFromCategory(activeCatForVal?.name));
      
      try {
        const validator = getLinkValidator(validationPlatform, targetType);
        const linkResult = validator.safeParse(url);
        if (!linkResult.success) {
          validationWarningActive = true;
        }
      } catch (e) {
        console.warn('Link validation warning check failed:', e);
      }
    }

    const hasDbWarnings = !!(
      (selectedService.requireWarning && selectedService.warningMessage) ||
      (activeCategory?.requireWarning && activeCategory?.warningMessage)
    );

    const hasWarnings = isLiveStream || isPrivateChannel || isPrivateTelegramPost || isVkPhotoOrVideo || isTelegramViews || validationWarningActive || hasDbWarnings;

    if (hasWarnings && !engine.isWarningConfirmed) {
      engine.setWarningHasError(true);
      toast.error("Пожалуйста, подтвердите согласие с особенностями продвижения (отметьте галочку согласия в предупреждениях).", { 
        position: 'top-center',
        duration: 5000 
      });
      setTimeout(() => {
        const warningEl = document.getElementById("warning-confirm-checkbox");
        if (warningEl) {
          safeFocus(warningEl, true);
        }
      }, 100);
      return;
    }

    if (!quantity || quantity < (selectedService.minQty || 1)) {
      setQuantityHasError(true);
      toast.error(`Минимальное количество для заказа: ${selectedService.minQty || 1} шт.`, { position: 'top-center' });
      if (typeof window !== 'undefined') {
        const qtyInput = document.querySelector('input[type="text"][inputmode="numeric"]') as HTMLInputElement;
        if (qtyInput) {
          safeFocus(qtyInput, true);
        }
      }
      return;
    }
    if (engine.dripFeedEnabled && engine.runs > 0) {
      const chunk = Math.floor(quantity / engine.runs);
      if (chunk < (selectedService.minQty || 1)) {
        setQuantityHasError(true);
        toast.error(`Для Drip-feed количество на один запуск (${chunk}) не может быть меньше минимального (${selectedService.minQty || 1})`, { position: 'top-center' });
        return;
      }
    } else if (engine.isSmartDrip && engine.smartDripDays > 0) {
      const chunk = Math.floor(quantity / engine.smartDripDays);
      if (chunk < (selectedService.minQty || 1)) {
        setQuantityHasError(true);
        toast.error(`Для Умного Drip-feed количество на 1 день (${chunk}) не может быть меньше минимального (${selectedService.minQty || 1})`, { position: 'top-center' });
        return;
      }
    }
    const nameLower = selectedService.name.toLowerCase();
    const customDataType = selectedService.customDataType;
    const reqCustomData = (customDataType && customDataType !== 'NONE') ||
                          (nameLower.includes('опрос') && !nameLower.includes('просмотр')) || 
                          nameLower.includes('свои') || 
                          nameLower.includes('свой текст') || 
                          nameLower.includes('ключево');
    if (reqCustomData && (!customData || customData.trim().length === 0)) {
      toast.error("Укажите необходимые данные для этой услуги (текст комментариев, ответы и т.д.)", { position: 'top-center' });
      return;
    }
    if (!agreedToTerms) {
      setTermsHasError(true);
      engine.setTermsHasError(true);
      setCheckoutError("Пожалуйста, примите условия Оферты и Политики конфиденциальности");
      // Per Article 438 Civil Code RF: acceptance of the offer must be an explicit act by the user.
      // Per 152-FZ: processing of personal data (email) requires explicit consent.
      toast.error("Пожалуйста, примите условия Оферты и Политики конфиденциальности.", {
        position: "top-center",
        duration: 4000,
      });
      // Safe focus and highlight the legal checkbox
      setTimeout(() => {
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const preferredId = isMobile ? "standard-legal-checkbox" : "desktop-legal-checkbox";
        const checkbox = 
          document.getElementById(preferredId) || 
          document.getElementById("standard-legal-checkbox") || 
          document.getElementById("checkout-terms-checkbox") ||
          document.getElementById("wizard-legal-checkbox") || 
          document.getElementById("desktop-legal-checkbox");
        if (checkbox) {
          safeFocus(checkbox, true);
        }
      }, 100);
      return;
    }

    if (!email || !email.includes('@')) {
      setEmailHasError(true);
      setCheckoutError("Пожалуйста, укажите email для отслеживания заказа");
      toast.error("Пожалуйста, укажите корректный email для отслеживания заказа.", { position: 'top-center' });
      if (typeof window !== 'undefined') {
        const emailInput = document.getElementById("email-input") || (window.innerWidth >= 768 ? desktopEmailInputRef?.current : mobileEmailInputRef?.current);
        if (emailInput) {
          safeFocus(emailInput, true);
        }
      }
      return;
    }
    
    setCheckoutError(null);

    const checkoutParams = {
      serviceId: selectedService.id,
      link: finalUrl,
      quantity,
      email,
      customData: customData.trim() || undefined,
      promoCodeStr: promoCode.trim() || undefined,
      mediaGroupUrl: engine.mediaGroupUrl?.trim() || undefined,
      isLinkOverridden: engine.isLinkOverridden,
      isSmartDrip: engine.isSmartDrip,
      smartDripDays: engine.isSmartDrip ? engine.smartDripDays : undefined,
      runs: engine.dripFeedEnabled ? engine.runs : undefined,
      interval: engine.dripFeedEnabled ? engine.dripInterval : undefined,
      abVariant: abVariant || undefined
    };

    if (resolvedGateway) {
      setIsSubmitting(true);
      try {
        const { checkoutAction } = await import('@/actions/order/checkout');
        const res = await checkoutAction({
          ...checkoutParams,
          gateway: resolvedGateway
        });
        if (res.success) {
          if (res.data?.orderId && res.data?.guestOrderToken) {
            try {
              localStorage.setItem(`guest_order_${res.data.orderId}`, res.data.guestOrderToken);
              const existing: string[] = JSON.parse(localStorage.getItem('guest_orders') || '[]');
              if (!existing.includes(res.data.orderId)) {
                existing.unshift(res.data.orderId);
                localStorage.setItem('guest_orders', JSON.stringify(existing.slice(0, 10)));
              }
            } catch {}
          }

          const orderData = res.data as OrderCheckoutResultData | undefined;
          if (res.data?.paymentUrl) {
            const redirected = executePaymentRedirect(res.data.paymentUrl);
            if (!redirected) {
              setIsSubmitting(false);
              toast.error('Не удалось открыть платежный шлюз');
            }
            return;
          } else if (resolvedGateway === 'balance' || orderData?.redirectUrl) {
            toast.success(`Заказ #${orderData?.numericId || orderData?.orderId || ''} успешно запущен!`, {
              description: 'Оплата произведена с вашего баланса.'
            });
            window.location.href = orderData?.redirectUrl || `/dashboard/orders?success=1&orderId=${orderData?.orderId}&payment=balance`;
            return;
          } else if (res.data?.orderId) {
            const tokenQuery = res.data.guestOrderToken ? `&token=${res.data.guestOrderToken}` : '';
            window.location.href = `/success?orderId=${res.data.orderId}${tokenQuery}`;
          } else if (res.data?.paymentId) {
            window.location.href = `/success?paymentId=${res.data.paymentId}`;
          }
          return;
        } else {
          setIsSubmitting(false);
          const errorCode = (res as { code?: string })?.code;
          if (errorCode === 'ACCOUNT_EXISTS' || res.error?.includes('уже зарегистрирован')) {
            setAuthModalEmail(email || (res as { email?: string })?.email || '');
            setShowAuthModal(true);
            return;
          }

          if (res.error?.startsWith('VOUCHER_USE_BALANCE:')) {
            toast.error(
              'Это ваучер на пополнение баланса. Перейдите в раздел «Мой баланс» для активации.',
              {
                position: 'top-center',
                duration: 6000,
                action: {
                  label: 'Мой баланс',
                  onClick: () => window.location.href = '/dashboard/add-funds'
                }
              }
            );
            return;
          }

          const actionable = parseActionableError(res.error, { serviceId: checkoutParams.serviceId });
          toast.error(actionable.message, {
            position: 'top-center',
            duration: 8000,
            action: actionable.action ? {
              label: actionable.action.label,
              onClick: () => {
                if (actionable.action?.targetGateway) {
                  handleCheckout(actionable.action.targetGateway);
                } else if (actionable.action?.redirectUrl) {
                  window.location.href = actionable.action.redirectUrl;
                }
              }
            } : undefined
          });
        }
      } catch (e: unknown) {
        setIsSubmitting(false);
        const errMessage = e instanceof Error ? e.message : String(e);
        if (errMessage.includes('уже зарегистрирован') || (e as { code?: string })?.code === 'ACCOUNT_EXISTS') {
          setAuthModalEmail(email || '');
          setShowAuthModal(true);
          return;
        }
        const actionable = parseActionableError(e, { serviceId: checkoutParams.serviceId });
        toast.error(actionable.message, {
          position: 'top-center',
          duration: 8000,
          action: actionable.action ? {
            label: actionable.action.label,
            onClick: () => {
              if (actionable.action?.targetGateway) {
                handleCheckout(actionable.action.targetGateway);
              } else if (actionable.action?.redirectUrl) {
                window.location.href = actionable.action.redirectUrl;
              }
            }
          } : undefined
        });
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
        idempotencyKey: pendingCheckoutParams.idempotencyKey,
        isLinkOverridden: pendingCheckoutParams.isLinkOverridden,
        isRequirementsConfirmed: pendingCheckoutParams.isRequirementsConfirmed,
        gateway
      });
      setIsSubmitting(false);
      setShowPaymentModal(false);
      if (res.success) {
        if (res.data?.orderId && res.data?.guestOrderToken) {
          try {
            localStorage.setItem(`guest_order_${res.data.orderId}`, res.data.guestOrderToken);
            const existing: string[] = JSON.parse(localStorage.getItem('guest_orders') || '[]');
            if (!existing.includes(res.data.orderId)) {
              existing.unshift(res.data.orderId);
              localStorage.setItem('guest_orders', JSON.stringify(existing.slice(0, 10)));
            }
          } catch {}
        }

        const checkoutData = res.data as OrderCheckoutResultData | undefined;
        if (res.data?.paymentUrl) {
          const redirected = executePaymentRedirect(res.data.paymentUrl);
          if (!redirected) {
            const errorMessage = 'Ошибка: не удалось открыть платёжный шлюз.';
            window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&serviceId=${pendingCheckoutParams.serviceId}&gateway=${gateway}&email=${encodeURIComponent(pendingCheckoutParams.email || '')}&quantity=${pendingCheckoutParams.quantity}&url=${encodeURIComponent(pendingCheckoutParams.link || '')}&paymentId=&orderId=`;
          }
        } else if (gateway === 'balance' || checkoutData?.redirectUrl) {
          toast.success(`Заказ #${checkoutData?.numericId || checkoutData?.orderId || ''} успешно запущен!`, {
            description: 'Оплата произведена с вашего баланса.'
          });
          window.location.href = checkoutData?.redirectUrl || `/dashboard/orders?success=1&orderId=${checkoutData?.orderId}&payment=balance`;
        } else if (res.data?.orderId) {
          const tokenQuery = res.data.guestOrderToken ? `&token=${res.data.guestOrderToken}` : '';
          window.location.href = `/success?orderId=${res.data.orderId}${tokenQuery}`;
        }
      } else if (!res.success) {
        const errorCode = (res as { code?: string })?.code;
        if (errorCode === 'ACCOUNT_EXISTS' || res.error?.includes('уже зарегистрирован')) {
          setShowPaymentModal(false);
          setAuthModalEmail(pendingCheckoutParams.email || (res as { email?: string })?.email || '');
          setShowAuthModal(true);
          return;
        }

        if (res.error?.includes("Telegram-аккаунт") || res.error?.includes("привяжите ваш Telegram-аккаунт")) {
          toast.error(res.error, {
            position: 'top-center',
            duration: 8000,
            action: {
              label: 'Привязать',
              onClick: () => window.location.href = '/dashboard/settings'
            }
          });
          return;
        }
        if (res.error?.startsWith('VOUCHER_USE_BALANCE:')) {
          toast.error(
            'Это ваучер на пополнение баланса. Перейдите в раздел «Мой баланс» для активации.',
            {
              position: 'top-center',
              duration: 6000,
              action: {
                label: 'Мой баланс',
                onClick: () => window.location.href = '/dashboard/add-funds'
              }
            }
          );
        } else {
          const errorMessage = res.error || "Ошибка создания заказа. Попробуйте снова.";
          const serviceId = pendingCheckoutParams.serviceId || '';
          const email = pendingCheckoutParams.email || '';
          const quantity = pendingCheckoutParams.quantity || '';
          const url = pendingCheckoutParams.link || '';
          const paymentId = '';
          const orderId = '';
          window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&serviceId=${serviceId}&gateway=${gateway}&email=${encodeURIComponent(email)}&quantity=${quantity}&url=${encodeURIComponent(url)}&paymentId=${paymentId}&orderId=${orderId}`;
        }
      }
    } catch (e: unknown) {
      setIsSubmitting(false);
      const err = e as Error;
      const errorMessage = err.message || "Ошибка платежного шлюза.";
      if (errorMessage.includes('уже зарегистрирован') || (e as { code?: string })?.code === 'ACCOUNT_EXISTS') {
        setShowPaymentModal(false);
        setAuthModalEmail(pendingCheckoutParams?.email || '');
        setShowAuthModal(true);
        return;
      }
      if (errorMessage.includes("Telegram-аккаунт") || errorMessage.includes("привяжите ваш Telegram-аккаунт")) {
        toast.error(errorMessage, {
          position: 'top-center',
          duration: 8000,
          action: {
            label: 'Привязать',
            onClick: () => window.location.href = '/dashboard/settings'
          }
        });
        return;
      }
      const serviceId = pendingCheckoutParams.serviceId || '';
      const email = pendingCheckoutParams.email || '';
      const quantity = pendingCheckoutParams.quantity || '';
      const url = pendingCheckoutParams.link || '';
      window.location.href = `/support/payment-error?error=${encodeURIComponent(errorMessage)}&serviceId=${serviceId}&gateway=${gateway}&email=${encodeURIComponent(email)}&quantity=${quantity}&url=${encodeURIComponent(url)}&paymentId=&orderId=`;
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
    } catch {}
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
