/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Drip-Feed Floor Invariant — single source of truth.
 *
 * For a drip-feed (N runs) or Smart Drip (N days) order, each provider launch receives
 * floor(quantity / N) units, which must be >= service.minQty, otherwise the provider rejects it.
 *
 * Used by: calculatePriceAction (price preview), CheckoutPreflightGuard, CheckoutTransactionService.
 * Keeping all three on the same function guarantees the UI never shows a price for an order
 * that the transaction would later roll back.
 */

export type DripFeedMode = 'runs' | 'smart';

/**
 * Returns a user-facing error message if the invariant is violated, or null when valid.
 * `splits` <= 0 / undefined means "not a drip-feed order" (always valid).
 */
export function getDripFeedFloorViolation(
  quantity: number,
  splits: number | null | undefined,
  minQty: number,
  mode: DripFeedMode = 'runs'
): string | null {
  if (!splits || splits <= 0) return null;
  const perRun = Math.floor(quantity / splits);
  if (perRun >= minQty) return null;
  return mode === 'smart'
    ? `Для Умного Drip-feed количество на 1 день (${perRun}) не может быть меньше минимального (${minQty})`
    : `Для Drip-feed количество на один запуск (${perRun}) не может быть меньше минимального (${minQty})`;
}

/** Throwing variant for service-layer code running inside createSafeAction / transactions. */
export function assertDripFeedFloor(
  quantity: number,
  splits: number | null | undefined,
  minQty: number,
  mode: DripFeedMode = 'runs'
): void {
  const violation = getDripFeedFloorViolation(quantity, splits, minQty, mode);
  if (violation) throw new Error(violation);
}
