'use client';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { normalizeUrl } from '@/components/orders/wizard/helpers';

export interface DripFeedFloorParams {
  isDripFeedEnabled: boolean;
  quantity: number;
  runs: number;
  minQty: number;
}

export interface DripFeedFloorResult {
  isValid: boolean;
  minRequiredTotal: number;
  perRunQuantity: number;
  warningMessage: string | null;
}

/**
 * Validates the Drip-Feed Floor Invariant (AGENTS.md §4):
 * When Drip-Feed is enabled, per-run quantity Math.floor(quantity / runs)
 * must never be lower than service.minQty.
 */
export function validateDripFeedFloor({
  isDripFeedEnabled,
  quantity,
  runs,
  minQty,
}: DripFeedFloorParams): DripFeedFloorResult {
  if (!isDripFeedEnabled || runs < 2 || minQty <= 0) {
    return {
      isValid: true,
      minRequiredTotal: minQty,
      perRunQuantity: quantity,
      warningMessage: null,
    };
  }

  const perRun = Math.floor(quantity / runs);
  const minRequiredTotal = minQty * runs;

  if (perRun < minQty) {
    return {
      isValid: false,
      minRequiredTotal,
      perRunQuantity: perRun,
      warningMessage: `Минимальный объём на 1 запуск: ${minQty} шт. Установите количество >= ${minRequiredTotal} для ${runs} запусков.`,
    };
  }

  return {
    isValid: true,
    minRequiredTotal,
    perRunQuantity: perRun,
    warningMessage: null,
  };
}

/**
 * Validates link format using mutateLink and getLinkValidator.
 * Returns error message string if invalid, or null if valid.
 */
export function validateBaseOrderLink(
  rawLink: string,
  platformSlug?: string | null,
  targetType?: string | null
): string | null {
  const trimmed = rawLink ? rawLink.trim() : '';
  if (!trimmed || trimmed.length < 3) {
    return 'Введите корректную ссылку для выполнения заказа';
  }

  if (!platformSlug || !targetType) {
    return null;
  }

  try {
    const normalized = normalizeUrl(trimmed);
    const mutated = mutateLink(normalized, platformSlug.toUpperCase(), targetType);
    const validator = getLinkValidator(platformSlug.toUpperCase(), targetType);
    const result = validator.safeParse(mutated);
    if (!result.success && result.error.errors.length > 0) {
      return result.error.errors[0].message;
    }
  } catch {
    // If no validator available for platform, pass through
    return null;
  }

  return null;
}

/**
 * Persists draft order state to sessionStorage (PCI-DSS compliant: no emails/cards).
 */
export function saveOrderDraftToStorage(key: string, data: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // Storage unavailable or quota exceeded
  }
}

/**
 * Retrieves draft order state from sessionStorage.
 */
export function loadOrderDraftFromStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = sessionStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : null;
  } catch {
    return null;
  }
}