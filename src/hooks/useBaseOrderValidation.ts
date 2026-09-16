import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { normalizeUrl } from '@/components/orders/wizard/helpers';
import { stripQueryParams } from '@/utils/link-normalizer';

export interface SanitizeUrlResult {
  cleanUrl: string;
  isValid: boolean;
  error?: string;
}

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

/**
 * Безопасная санитизация ссылки: отсечение опасных протоколов,
 * удаление трекинговых параметров и валидация через Zod-схему платформы.
 */
export function sanitizeAndNormalizeOrderLink(
  rawUrl: string,
  platformSlug?: string | null,
  targetType?: string | null
): SanitizeUrlResult {
  const trimmed = rawUrl ? rawUrl.trim() : '';
  if (!trimmed || trimmed.length < 3) {
    return { cleanUrl: '', isValid: false, error: 'Введите корректную ссылку' };
  }

  // Защита от опасных протоколов (XSS / Local File Leak)
  if (/^(javascript|data|file|vbscript):/i.test(trimmed)) {
    return { cleanUrl: '', isValid: false, error: 'Недопустимый протокол ссылки' };
  }

  // Очистка UTM и трекинговых параметров без удаления функциональных (?v=, ?start=, ?reply=)
  let clean = stripQueryParams(trimmed);

  // Автодобавление https:// для доменных ссылок без протокола
  if (!/^https?:\/\//i.test(clean) && (clean.includes('.') || clean.includes('/')) && !clean.includes(' ')) {
    clean = `https://${clean}`;
  }

  if (!platformSlug || !targetType) {
    return { cleanUrl: clean, isValid: true };
  }

  try {
    const mutated = mutateLink(clean, platformSlug.toUpperCase(), targetType);
    const validator = getLinkValidator(platformSlug.toUpperCase(), targetType);
    const result = validator.safeParse(mutated);
    if (!result.success && result.error.errors.length > 0) {
      return { cleanUrl: mutated, isValid: false, error: result.error.errors[0].message };
    }
    return { cleanUrl: mutated, isValid: true };
  } catch {
    return { cleanUrl: clean, isValid: true };
  }
}

/**
 * Авто-ограничение диапазона объема заказа (Fool-Proof Clamping)
 */
export function clampOrderQuantity(
  val: number,
  minQty: number,
  maxQty: number,
  runs: number = 1
): number {
  const effectiveMin = Math.max(1, minQty * (runs > 1 ? runs : 1));
  if (isNaN(val) || val <= 0) return effectiveMin;
  const intVal = Math.floor(val);
  return Math.min(Math.max(intVal, effectiveMin), maxQty);
}

/**
 * Генерация стабильного Idempotency Key для сессии чекаута
 */
export function generateStableIdempotencyKey(existingKey?: string): string {
  if (existingKey && existingKey.trim().length >= 10) {
    return existingKey.trim();
  }
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Math.random().toString(36).substring(2, 14);
  return `ord_${Date.now()}_${rand}`;
}