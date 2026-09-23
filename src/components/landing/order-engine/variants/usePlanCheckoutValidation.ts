import React from 'react';
import { PublicService } from '@/actions/order/catalog';
import { safeFocus } from '@/utils/scroll-helpers';
import { PricingResult } from '@/services/marketing.service';

export interface PlanCheckoutValidationOptions {
  url: string;
  selectedService: PublicService;
  isWarningConfirmed: boolean;
  customData: string;
  quantity: number;
  minQty: number;
  maxQty: number;
  effectiveMinQty: number;
  dripFeedEnabled: boolean;
  runs: number;
  email: string;
  agreedToTerms: boolean;
  selectedGateway: string;
  linkInputRef: React.RefObject<HTMLInputElement | null>;
  emailInputRef: React.RefObject<HTMLInputElement | null>;
  quantityInputRef: React.RefObject<HTMLInputElement | null>;
  setLocalError: (err: string | null) => void;
  setShakeKey: (key: number) => void;
  handleCheckout: (gateway: string) => void;
  compatibilityWarning?: string | null;
  isLinkOverridden?: boolean;
  promoCode?: string;
  isCalculating?: boolean;
  pricing?: PricingResult | null;
  pricingError?: 'voucher' | null;
}

export function validateAndSubmitPlanCheckout({
  url,
  selectedService,
  isWarningConfirmed,
  customData,
  quantity,
  minQty,
  maxQty,
  effectiveMinQty,
  dripFeedEnabled,
  runs,
  email,
  agreedToTerms,
  selectedGateway,
  linkInputRef,
  emailInputRef,
  quantityInputRef,
  setLocalError,
  setShakeKey,
  handleCheckout,
  compatibilityWarning,
  isLinkOverridden,
  promoCode,
  isCalculating,
  pricing,
  pricingError,
}: PlanCheckoutValidationOptions): boolean {
  if (isCalculating) {
    setLocalError('Пожалуйста, дождитесь завершения проверки промокода');
    setShakeKey(Date.now());
    return false;
  }

  if (pricingError === 'voucher') {
    setLocalError('Введён ваучер на пополнение баланса. Активируйте его в личном кабинете или очистите поле');
    setShakeKey(Date.now());
    return false;
  }

  if (promoCode && promoCode.trim().length > 0 && (!pricing || pricing.discountCents === 0)) {
    setLocalError('Указан недействительный промокод. Очистите поле или укажите верный промокод');
    setShakeKey(Date.now());
    const promoInput = document.getElementById('promo-input');
    if (promoInput) safeFocus(promoInput, true);
    return false;
  }

  if (!url || url.trim().length < 3) {
    setLocalError('Пожалуйста, укажите ссылку на объект продвижения');
    setShakeKey(Date.now());
    safeFocus(linkInputRef.current, true);
    return false;
  }

  // If analyzer detected incompatibility and user has not yet checked "I am sure"
  if (compatibilityWarning && !isLinkOverridden) {
    setLocalError(compatibilityWarning + ' Если вы уверены, что ссылка верная — отметьте галочку «Я уверен, что ссылка верная».');
    setShakeKey(Date.now());
    safeFocus(linkInputRef.current, true);
    return false;
  }

  const hasRequirement = selectedService.clientRequirement || selectedService.clientConfirmation || selectedService.requireWarning;
  if (hasRequirement && !isWarningConfirmed) {
    setLocalError(selectedService.warningMessage || selectedService.clientRequirement || 'Пожалуйста, подтвердите требования к заказу');
    setShakeKey(Date.now());
    return false;
  }

  if (selectedService.customDataType && selectedService.customDataType !== 'NONE' && !customData.trim()) {
    setLocalError(selectedService.customDataLabel || 'Пожалуйста, укажите дополнительные данные для заказа');
    setShakeKey(Date.now());
    return false;
  }

  const numQty = Number(quantity);
  if (isNaN(numQty) || numQty < effectiveMinQty) {
    setLocalError(
      dripFeedEnabled
        ? `Для ${runs} запусков минимальный заказ: ${effectiveMinQty} шт. (по ${minQty} шт./запуск)`
        : `Минимальное количество для заказа: ${minQty} шт.`
    );
    setShakeKey(Date.now());
    safeFocus(quantityInputRef.current, true);
    return false;
  }

  if (numQty > maxQty) {
    setLocalError(`Максимальное количество для заказа: ${maxQty} шт.`);
    setShakeKey(Date.now());
    safeFocus(quantityInputRef.current, true);
    return false;
  }

  if (!email || !email.includes('@')) {
    setLocalError('Пожалуйста, укажите корректный email для отправки чека и доступа к заказу');
    setShakeKey(Date.now());
    safeFocus(emailInputRef.current, true);
    return false;
  }

  if (!agreedToTerms) {
    setLocalError('Пожалуйста, подтвердите согласие с Офертой и Политикой конфиденциальности');
    setShakeKey(Date.now());
    const termsEl = document.getElementById('checkout-terms-checkbox');
    safeFocus(termsEl, true);
    return false;
  }

  setLocalError(null);
  handleCheckout(selectedGateway);
  return true;
}
