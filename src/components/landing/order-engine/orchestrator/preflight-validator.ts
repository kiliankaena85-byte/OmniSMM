/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Preflight and URL validation logic for Checkout Orchestrator.
 */
import { toast } from 'sonner';
import type { OrderEngine } from '@/hooks/useOrderEngine';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import { IntelligencePlatform } from '@/services/analyzer/link-rules';
import { sanitizeAndNormalizeOrderLink } from '@/hooks/useBaseOrderValidation';

export interface PreflightValidationResult {
  isValid: boolean;
  error?: string;
  finalUrl?: string;
  shouldShowLinkModal?: boolean;
}

export function validatePreflightAndLink(engine: OrderEngine): PreflightValidationResult {
  const { selectedService, url, promoCode } = engine;

  if (!selectedService) {
    const msg = "Пожалуйста, выберите услугу.";
    toast.error(msg, { position: 'top-center' });
    return { isValid: false, error: msg };
  }
  if (selectedService.cooldownUntil && new Date(selectedService.cooldownUntil) > new Date()) {
    toast.error("Эта услуга временно недоступна для заказа (находится на проверке качества). Пожалуйста, выберите другую.", { position: 'top-center' });
    return { isValid: false };
  }

  if (engine.isCalculating) {
    toast.error("Идет расчет стоимости заказа. Пожалуйста, подождите...", { position: 'top-center' });
    return { isValid: false };
  }
  if (engine.pricingError === 'voucher') {
    toast.error("Введён ваучер на пополнение баланса. Активируйте его в личном кабинете или очистите поле.", { position: 'top-center' });
    return { isValid: false };
  }
  if (!engine.pricing) {
    toast.error("Не удалось рассчитать стоимость заказа. Пожалуйста, проверьте количество или попробуйте позже.", { position: 'top-center' });
    return { isValid: false };
  }
  if (promoCode && promoCode.trim().length > 0 && (!engine.pricing || engine.pricing.discountCents === 0)) {
    toast.error("Указан недействительный промокод. Очистите поле или укажите верный промокод.", { position: 'top-center' });
    return { isValid: false };
  }

  // Cross-platform mismatch protection
  const activeNetwork = engine.catalog.find(n => n.id === engine.networkId);
  if (!engine.isLinkOverridden && engine.platform && activeNetwork) {
    const detectedPlatform = engine.platform.toLowerCase();
    const selectedPlatform = activeNetwork.slug.toLowerCase();
    
    if (!selectedPlatform.includes(detectedPlatform) && !detectedPlatform.includes(selectedPlatform)) {
      toast.error(`Ссылка не подходит. Указана ссылка для ${engine.platform}, но выбрана соцсеть ${activeNetwork.name}.`, { position: 'top-center' });
      return { isValid: false, shouldShowLinkModal: true };
    }
  }

  const rawUrl = url.trim();
  if (rawUrl.length < 3) {
    toast.error("Ссылка или юзернейм слишком короткие.", { position: 'top-center' });
    return { isValid: false, shouldShowLinkModal: true };
  }
  if (/^(javascript|data|file|vbscript):/i.test(rawUrl)) {
    toast.error("Недопустимый протокол ссылки.", { position: 'top-center' });
    return { isValid: false, shouldShowLinkModal: true };
  }
  if (rawUrl.includes(' ')) {
    toast.error("Ссылка не должна содержать пробелов.", { position: 'top-center' });
    return { isValid: false, shouldShowLinkModal: true };
  }
  if (/[а-яА-Я]/.test(rawUrl) && !rawUrl.includes('рф')) {
    toast.error("Ссылка содержит недопустимые символы (кириллицу).", { position: 'top-center' });
    return { isValid: false, shouldShowLinkModal: true };
  }

  // High-precision link validation & mutation
  const activePlatform = engine.platform || engine.manualPlatform;
  let finalUrl = rawUrl;

  if (!engine.isLinkOverridden && selectedService && activePlatform && activePlatform !== IntelligencePlatform.OTHER) {
    const activeCat = engine.catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const targetType = resolveServiceTargetType({ ...selectedService, category: activeCat });

    const sanitizeRes = sanitizeAndNormalizeOrderLink(finalUrl, activePlatform, targetType);
    if (sanitizeRes.cleanUrl && sanitizeRes.cleanUrl !== finalUrl) {
      finalUrl = sanitizeRes.cleanUrl;
      engine.setUrl(sanitizeRes.cleanUrl);
    }

    if (!sanitizeRes.isValid) {
      const baseMsg = sanitizeRes.error || 'Неверный формат ссылки.';
      const bypassHint = '\n\nЕсли ваша ссылка уже корректная — нажмите «Изменить ссылку» и включите «Использовать как есть».';
      toast.error(baseMsg + bypassHint, { position: 'top-center', duration: 6000 });
      return { isValid: false, shouldShowLinkModal: true };
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
          toast.error("Указан некорректный домен.", { position: 'top-center' });
          return { isValid: false, shouldShowLinkModal: true };
        }
        if (u.pathname === '/' || u.pathname.length < 2) {
          toast.error("Укажите ссылку на конкретный профиль или пост, а не на главную страницу.", { position: 'top-center' });
          return { isValid: false, shouldShowLinkModal: true };
        }
      } catch {
        toast.error("Неверный формат ссылки.", { position: 'top-center' });
        return { isValid: false, shouldShowLinkModal: true };
      }
    } else {
      toast.error("Ссылка в обход валидации должна быть корректной (начинаться с http:// или https://)", { position: 'top-center' });
      return { isValid: false, shouldShowLinkModal: true };
    }
  }

  return { isValid: true, finalUrl };
}
