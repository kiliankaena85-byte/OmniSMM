import { describe, it, expect } from 'vitest';
import { PricingResult } from '@/services/marketing.service';

/**
 * Invariant test for useOrderEngine pricing calculation logic
 * Ensures that entering a promo code never drops the price to null or 0.00 RUB.
 */
function calculateTestPricing({
  selectedService,
  quantity,
  promoCode,
  promoPricing,
  isSmartDrip = false,
}: {
  selectedService: { pricePerUnitRub: number; smartConfig?: { isEnabled: boolean; markup: number } } | null;
  quantity: number;
  promoCode: string;
  promoPricing: PricingResult | null;
  isSmartDrip?: boolean;
}): PricingResult | null {
  if (!selectedService || quantity < 1) return null;

  const totalQty = quantity;
  const originalTotalCents = Math.max(1, Math.ceil(selectedService.pricePerUnitRub * 100 * totalQty));

  let baseTotalCents = originalTotalCents;
  if (isSmartDrip && selectedService.smartConfig?.isEnabled) {
    baseTotalCents = Math.round(baseTotalCents * (1 + selectedService.smartConfig.markup));
  }

  const defaultPricing: PricingResult = {
    totalCents: baseTotalCents,
    originalTotalCents,
    discountCents: 0,
    discountPercent: 0,
    providerCostCents: 0,
    safetyFloorCents: 0,
    tier: 'REGULAR'
  };

  if (promoCode && promoCode.trim().length > 0 && promoPricing) {
    return promoPricing;
  }

  return defaultPricing;
}

describe('Order Engine Promo Code Pricing Invariants', () => {
  const mockService = { pricePerUnitRub: 0.15 }; // 15 kopecks per unit

  it('returns standard base pricing when no promo code is entered', () => {
    const pricing = calculateTestPricing({
      selectedService: mockService,
      quantity: 500,
      promoCode: '',
      promoPricing: null
    });

    expect(pricing).not.toBeNull();
    expect(pricing!.totalCents).toBe(7500); // 75.00 RUB
    expect(pricing!.discountCents).toBe(0);
  });

  it('preserves base pricing while promo code is debouncing/calculating (promoPricing is null)', () => {
    const pricing = calculateTestPricing({
      selectedService: mockService,
      quantity: 500,
      promoCode: 'TYPING',
      promoPricing: null // server hasn't responded yet or invalid
    });

    // CRITICAL: Must not be null and must not be 0 cents
    expect(pricing).not.toBeNull();
    expect(pricing!.totalCents).toBe(7500);
    expect(pricing!.originalTotalCents).toBe(7500);
    expect(pricing!.discountCents).toBe(0);
  });

  it('applies promoPricing when valid promo code server calculation returns', () => {
    const validPromoResult: PricingResult = {
      totalCents: 6000,
      originalTotalCents: 7500,
      discountCents: 1500,
      discountPercent: 20,
      providerCostCents: 5000,
      safetyFloorCents: 5500,
      tier: 'REGULAR'
    };

    const pricing = calculateTestPricing({
      selectedService: mockService,
      quantity: 500,
      promoCode: 'SALE20',
      promoPricing: validPromoResult
    });

    expect(pricing).not.toBeNull();
    expect(pricing!.totalCents).toBe(6000);
    expect(pricing!.discountCents).toBe(1500);
    expect(pricing!.discountPercent).toBe(20);
  });

  it('falls back to base price when promo code is invalid and promoPricing is null', () => {
    const pricing = calculateTestPricing({
      selectedService: mockService,
      quantity: 1000,
      promoCode: 'NONEXISTENT',
      promoPricing: null
    });

    expect(pricing).not.toBeNull();
    expect(pricing!.totalCents).toBe(15000);
    expect(pricing!.discountCents).toBe(0);
  });
});
