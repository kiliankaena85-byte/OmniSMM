/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Warnings, requirements, and bounds guard for Checkout Orchestrator.
 */
import { toast } from 'sonner';
import type { OrderEngine } from '@/hooks/useOrderEngine';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import { getLinkValidator } from '@/validators/link-mutators';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { safeFocus } from '@/utils/scroll-helpers';

export interface RequirementsValidationResult {
  isValid: boolean;
  quantityHasError?: boolean;
  termsHasError?: boolean;
  emailHasError?: boolean;
  error?: string;
}

export function validateWarningsAndRequirements(
  engine: OrderEngine,
  finalUrl: string,
  email: string | undefined,
  desktopEmailInputRef?: React.RefObject<HTMLInputElement | null>,
  mobileEmailInputRef?: React.RefObject<HTMLInputElement | null>
): RequirementsValidationResult {
  const { selectedService, quantity, customData, agreedToTerms } = engine;
  if (!selectedService) return { isValid: false };

  const activeNetwork = engine.catalog.find(n => n.id === engine.networkId);
  const activeCategory = activeNetwork?.categories.find(c => c.id === engine.categoryId);

  // Warnings check
  const sName = selectedService.name.toLowerCase();
  const isLiveStream = sName.includes('зрител') || sName.includes('эфир') || sName.includes('трансляц');
  const isPrivateChannel = sName.includes('закрыт');
  
  const urlLower = finalUrl.toLowerCase();
  const isPrivateTelegramPost = urlLower.includes('t.me/c/') || urlLower.includes('telegram.me/c/');
  const isVkPhotoOrVideo = urlLower.includes('vk.com/photo') || urlLower.includes('vk.com/video') || urlLower.includes('vk.ru/photo') || urlLower.includes('vk.ru/video') || urlLower.includes('vkvideo.ru/');

  const resolvedTargetType = resolveServiceTargetType({ ...selectedService, category: activeCategory });
  const isTelegramViews = activeNetwork?.slug?.toLowerCase() === 'telegram'
    && activeCategory?.name?.toLowerCase().includes('просмотр')
    && !activeCategory?.name?.toLowerCase().includes('авто')
    && !activeCategory?.name?.toLowerCase().includes('auto')
    && !activeCategory?.name?.toLowerCase().includes('будущ')
    && resolvedTargetType !== 'CHANNEL';

  let validationWarningActive = false;
  if (finalUrl.trim().length > 3 && selectedService && activeNetwork) {
    const activePlatform = engine.platform || engine.manualPlatform;
    const validationPlatform = (activePlatform && activePlatform !== IntelligencePlatform.OTHER)
      ? activePlatform
      : activeNetwork.slug.toUpperCase();
    
    const activeCatForVal = engine.catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const targetType = resolveServiceTargetType({ ...selectedService, category: activeCatForVal });
    
    try {
      const validator = getLinkValidator(validationPlatform, targetType);
      const linkResult = validator.safeParse(finalUrl);
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
    return { isValid: false };
  }

  // Quantity bounds check
  if (!quantity || quantity < (selectedService.minQty || 1)) {
    toast.error(`Минимальное количество для заказа: ${selectedService.minQty || 1} шт.`, { position: 'top-center' });
    if (typeof window !== 'undefined') {
      const qtyInput = document.querySelector('input[type="text"][inputmode="numeric"]') as HTMLInputElement;
      if (qtyInput) safeFocus(qtyInput, true);
    }
    return { isValid: false, quantityHasError: true };
  }

  // Drip-feed floor invariant
  if (engine.dripFeedEnabled && engine.runs > 0) {
    const chunk = Math.floor(quantity / engine.runs);
    if (chunk < (selectedService.minQty || 1)) {
      toast.error(`Для Drip-feed количество на один запуск (${chunk}) не может быть меньше минимального (${selectedService.minQty || 1})`, { position: 'top-center' });
      return { isValid: false, quantityHasError: true };
    }
  } else if (engine.isSmartDrip && engine.smartDripDays > 0) {
    const chunk = Math.floor(quantity / engine.smartDripDays);
    if (chunk < (selectedService.minQty || 1)) {
      toast.error(`Для Умного Drip-feed количество на 1 день (${chunk}) не может быть меньше минимального (${selectedService.minQty || 1})`, { position: 'top-center' });
      return { isValid: false, quantityHasError: true };
    }
  }

  // Custom data requirements
  const nameLower = selectedService.name.toLowerCase();
  const customDataType = selectedService.customDataType;
  const reqCustomData = (customDataType && customDataType !== 'NONE') ||
                        (nameLower.includes('опрос') && !nameLower.includes('просмотр')) || 
                        nameLower.includes('свои') || 
                        nameLower.includes('свой текст') || 
                        nameLower.includes('ключево');
  if (reqCustomData && (!customData || customData.trim().length === 0)) {
    toast.error("Укажите необходимые данные для этой услуги (текст комментариев, ответы и т.д.)", { position: 'top-center' });
    return { isValid: false };
  }

  // Terms and legal agreement
  if (!agreedToTerms) {
    engine.setTermsHasError(true);
    toast.error("Пожалуйста, примите условия Оферты и Политики конфиденциальности.", {
      position: "top-center",
      duration: 4000,
    });
    setTimeout(() => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      const preferredId = isMobile ? "standard-legal-checkbox" : "desktop-legal-checkbox";
      const checkbox = 
        document.getElementById(preferredId) || 
        document.getElementById("standard-legal-checkbox") || 
        document.getElementById("checkout-terms-checkbox") ||
        document.getElementById("wizard-legal-checkbox") || 
        document.getElementById("desktop-legal-checkbox");
      if (checkbox) safeFocus(checkbox, true);
    }, 100);
    return { isValid: false, termsHasError: true, error: "Пожалуйста, примите условия Оферты и Политики конфиденциальности" };
  }

  // Email validation
  if (!email || !email.includes('@')) {
    toast.error("Пожалуйста, укажите корректный email для отслеживания заказа.", { position: 'top-center' });
    if (typeof window !== 'undefined') {
      const emailInput = document.getElementById("email-input") || (window.innerWidth >= 768 ? desktopEmailInputRef?.current : mobileEmailInputRef?.current);
      if (emailInput) safeFocus(emailInput, true);
    }
    return { isValid: false, emailHasError: true, error: "Пожалуйста, укажите email для отслеживания заказа" };
  }

  return { isValid: true };
}
