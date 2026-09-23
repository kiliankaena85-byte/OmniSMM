/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Pure order form validation logic.
 */
import { orderFormSchema } from '@/validators/order.validators';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { resolveServiceTargetType } from '@/utils/target-type-mapper';
import {
  isLinkServiceCompatible,
  getCompatibilityError,
  normalizeServiceTargetType
} from '@/constants/link-service-compatibility';
import type { PublicService, PublicNetwork } from '@/actions/order/catalog';
import type { IntelligencePlatform } from '@/services/analyzer/link-rules';

export interface OrderFormValidationOptions {
  url: string;
  quantity: number;
  email: string;
  selectedService: PublicService | null;
  customData: string;
  agreedToTerms: boolean;
  catalog: PublicNetwork[];
  networkId: string;
  platform: IntelligencePlatform | null;
  manualPlatform: IntelligencePlatform | null;
  detectedType: string | null;
  isLinkOverridden: boolean;
  dripFeedEnabled: boolean;
  runs: number;
  isSmartDrip: boolean;
  smartDripDays: number;
  shouldMutate?: boolean;
}

export interface OrderFormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  cleanUrl?: string;
}

export function validateOrderForm(options: OrderFormValidationOptions): OrderFormValidationResult {
  const {
    url, quantity, email, selectedService, customData, agreedToTerms,
    catalog, networkId, platform, manualPlatform, detectedType,
    isLinkOverridden, dripFeedEnabled, runs, isSmartDrip, smartDripDays,
    shouldMutate = false
  } = options;

  let currentUrl = url;
  let cleanUrlResult: string | undefined;

  const currentNetwork = catalog.find(n => n.id === networkId);
  const activePlatform = currentNetwork?.slug || platform || manualPlatform || '';

  if (shouldMutate && selectedService && activePlatform) {
    const activeCat = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const targetType = resolveServiceTargetType({ ...selectedService, category: activeCat });
    const cleanUrl = mutateLink(currentUrl, activePlatform, targetType);
    if (cleanUrl !== currentUrl) {
      currentUrl = cleanUrl;
      cleanUrlResult = cleanUrl;
    }
  }

  const result = orderFormSchema.safeParse({
    link: currentUrl,
    quantity,
    email,
    serviceId: selectedService?.id || "",
    customData: customData ? customData : undefined,
    agreedToTerms
  });

  const errors: Record<string, string> = {};
  if (!result.success) {
    result.error.errors.forEach(err => {
      if (err.path[0]) {
        const fieldName = err.path[0].toString();
        if (fieldName === 'link' && !currentUrl) return;
        if (fieldName === 'email' && !email) return;
        errors[fieldName] = err.message;
      }
    });
  }

  // Strict Domain TargetType Compatibility Guard
  if (selectedService && detectedType && !isLinkOverridden) {
    const activeCat2 = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const serviceTargetType = normalizeServiceTargetType(
      resolveServiceTargetType({ ...selectedService, category: activeCat2 })
    );
    if (!isLinkServiceCompatible(detectedType, serviceTargetType)) {
      errors['link'] = getCompatibilityError(detectedType, serviceTargetType, selectedService.name);
    }
  }

  // Advanced Link Format Regex Validator
  if (selectedService && activePlatform && currentUrl && !isLinkOverridden && !errors['link']) {
    const activeCat2 = catalog.flatMap(n => n.categories).find(c => c.id === selectedService.categoryId);
    const targetType = resolveServiceTargetType({ ...selectedService, category: activeCat2 });
    const cleanUrl = mutateLink(currentUrl, activePlatform, targetType);
    const validator = getLinkValidator(activePlatform, targetType);
    const linkResult = validator.safeParse(cleanUrl);
    if (!linkResult.success) {
      errors['link'] = linkResult.error.errors[0].message;
    }
  }

  // Drip-Feed Floor validation
  if (selectedService) {
    if (dripFeedEnabled && runs > 0) {
      const chunk = Math.floor(quantity / runs);
      if (chunk < selectedService.minQty) {
        errors['dripfeed'] = `Для ${runs} запусков общее количество должно быть минимум ${selectedService.minQty * runs} шт. (мин. ${selectedService.minQty} шт. на запуск)`;
      }
    } else if (isSmartDrip && smartDripDays > 0) {
      const chunk = Math.floor(quantity / smartDripDays);
      if (chunk < selectedService.minQty) {
        errors['dripfeed'] = `Для Умного Drip на ${smartDripDays} дней общее количество должно быть минимум ${selectedService.minQty * smartDripDays} шт. (мин. ${selectedService.minQty} шт./день)`;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    cleanUrl: cleanUrlResult
  };
}
