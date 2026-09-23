'use client';

import { useState, useEffect, useMemo } from 'react';
import type { PublicService } from '@/actions/order/catalog';
import { calculatePriceAction } from '@/actions/order/checkout';
import type { PricingResult } from '@/services/marketing.service';

export interface UseOrderPricingOptions {
  selectedService: PublicService | null;
  quantity: number;
  promoCode: string;
  dripFeedEnabled: boolean;
  runs: number;
  isSmartDrip: boolean;
}

export interface UseOrderPricingResult {
  pricing: PricingResult | null;
  pricingError: 'voucher' | null;
  isCalculating: boolean;
}

export function useOrderPricingEngine({
  selectedService,
  quantity,
  promoCode,
  dripFeedEnabled,
  runs,
  isSmartDrip
}: UseOrderPricingOptions): UseOrderPricingResult {
  const [promoPricing, setPromoPricing] = useState<PricingResult | null>(null);
  const [pricingError, setPricingError] = useState<'voucher' | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Synchronous base price calculation
  const pricing = useMemo(() => {
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
  }, [selectedService, quantity, promoCode, promoPricing, dripFeedEnabled, runs, isSmartDrip]);

  // Server-side promo calculation
  useEffect(() => {
    if (!selectedService || quantity < 1 || !promoCode || promoCode.trim().length === 0) {
      setPromoPricing(null);
      setPricingError(null);
      setIsCalculating(false);
      return;
    }

    let stale = false;
    const handler = setTimeout(async () => {
      if (stale) return;
      setIsCalculating(true);
      try {
        const res = await calculatePriceAction(
          selectedService.id,
          quantity,
          promoCode,
          dripFeedEnabled ? runs : undefined,
          isSmartDrip
        );
        if (stale) return;
        if (res.success && res.data) {
          setPromoPricing(res.data);
          setPricingError(null);
        } else if (res.error?.startsWith('VOUCHER_USE_BALANCE:')) {
          setPromoPricing(null);
          setPricingError('voucher');
        } else {
          setPromoPricing(null);
          setPricingError(null);
        }
      } catch (err) {
        if (!stale) {
          console.error("Price calculation failed:", err);
          setPromoPricing(null);
          setPricingError(null);
        }
      } finally {
        if (!stale) setIsCalculating(false);
      }
    }, 150);

    return () => {
      stale = true;
      clearTimeout(handler);
    };
  }, [selectedService, quantity, promoCode, dripFeedEnabled, runs, isSmartDrip]);

  return { pricing, pricingError, isCalculating };
}
