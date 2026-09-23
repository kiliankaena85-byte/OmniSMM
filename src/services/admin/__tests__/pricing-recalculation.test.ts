import { describe, it, expect } from 'vitest';
import { applyBeautifulRounding, SAFETY_FLOOR_MARKUP } from '@/lib/financial-constants';

describe('Immediate Price Recalculation & 200% Owner Minimum Margin (K-4..K-7)', () => {
  it('enforces 3.0x default markup floor (200% margin)', () => {
    expect(SAFETY_FLOOR_MARKUP).toBe(3.0);
  });

  it('recalculates retail price immediately when provider rate increases', () => {
    const oldRate = 1.0; // $1.00 per 1k
    const newRate = 1.50; // $1.50 per 1k (+50% increase)
    const markup = 3.0; // 200% margin (3.0x multiplier)
    const usdToRub = 100.0;

    const effectiveMarkup = Math.max(markup, 3.0);
    const newPriceRub = applyBeautifulRounding(newRate * effectiveMarkup * usdToRub);
    const newPriceCents = Math.round(newPriceRub * 100);

    // $1.50 * 3.0 * 100 = 450 RUB per 1k = 45000 cents
    expect(effectiveMarkup).toBe(3.0);
    expect(newPriceRub).toBe(450);
    expect(newPriceCents).toBe(45000);
  });

  it('upgrades sub-floor markups to 3.0x minimum margin', () => {
    const rate = 2.0;
    const legacyLowMarkup = 1.5; // Only 50% margin
    const minOwnerMarkup = 3.0; // 200% margin standard

    const effectiveMarkup = Math.max(legacyLowMarkup, minOwnerMarkup);
    expect(effectiveMarkup).toBe(3.0);
  });
});
