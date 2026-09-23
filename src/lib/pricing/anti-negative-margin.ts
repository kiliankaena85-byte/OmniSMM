import { applyBeautifulRounding } from '@/lib/financial-constants';

export interface MarginGuardResult {
  finalRetailPer1kRub: number;
  finalRetailPer1kCents: number;
  wasFloored: boolean;
  originalRetailPer1kRub: number;
  costPer1kRub: number;
  marginPct: number;
}

/**
 * ANTI-NEGATIVE-MARGIN ENFORCEMENT (P0-3)
 * Guarantees that retail price can NEVER drop below provider cost + minimum margin (5%),
 * even after psychological / beauty price rounding.
 */
export function applyAntiNegativeMargin(
  costPer1kRub: number,
  rawRetailPer1kRub: number,
  minMarginPct: number = 5
): MarginGuardResult {
  if (!Number.isFinite(costPer1kRub) || costPer1kRub <= 0) {
    throw new Error(`[AntiNegativeMargin] Invalid costPer1kRub: must be a positive finite number (got ${costPer1kRub})`);
  }
  const safeCost = costPer1kRub;
  const minAcceptableRetail = safeCost * (1 + minMarginPct / 100);

  let finalRetail = applyBeautifulRounding(rawRetailPer1kRub);
  let wasFloored = false;

  // Floor at minimum margin (e.g. cost + 5%)
  if (finalRetail < minAcceptableRetail) {
    finalRetail = applyBeautifulRounding(minAcceptableRetail);
    wasFloored = true;
  }

  // Absolute floor: never below raw cost
  if (finalRetail < safeCost) {
    finalRetail = applyBeautifulRounding(safeCost);
    wasFloored = true;
  }

  // Guarantee integer kopeck precision (ceiling prevents any fractional loss)
  const finalCents = Math.ceil(finalRetail * 100);
  finalRetail = finalCents / 100;

  const marginPct = safeCost > 0
    ? ((finalRetail - safeCost) / safeCost) * 100
    : 0;

  return {
    finalRetailPer1kRub: finalRetail,
    finalRetailPer1kCents: finalCents,
    wasFloored,
    originalRetailPer1kRub: rawRetailPer1kRub,
    costPer1kRub: safeCost,
    marginPct: Math.round(marginPct * 100) / 100
  };
}

/**
 * Convenience helper combining pricing ladder with margin floor
 */
export function applyPricingLadderWithMarginGuard(
  costPer1kRub: number,
  ladderOutput: number,
  minMarginPct: number = 5
): MarginGuardResult {
  return applyAntiNegativeMargin(costPer1kRub, ladderOutput, minMarginPct);
}
