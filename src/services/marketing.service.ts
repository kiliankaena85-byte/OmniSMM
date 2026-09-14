import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  calculateSafetyFloorCents,
  MAX_TOTAL_DISCOUNT,
  TOTAL_MANDATORY_DEDUCTIONS,
  SAFETY_FLOOR_MARKUP,
  applyBeautifulRounding,
} from '@/lib/financial-constants';
import { SettingsProvider } from '@/lib/settings';
import { getCostRub } from '@/lib/pricing/currency-invariant';
import { CBRRateService } from '@/services/system/cbr-rate.service';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';

export type PricingResult = {
  totalCents: number;
  originalTotalCents: number;
  discountCents: number;
  discountPercent: number;
  providerCostCents: number;
  safetyFloorCents: number;
  tier: string;
};

class MarketingService {
  /**
   * Evaluates volume discount tier based on total spent.
   * Returns generic tier names and their respective percent discount.
   */
  getVolumeTier(totalSpentCents: number): { name: string; discountPercent: number } {
    if (totalSpentCents >= 100_000_00) { // 1m RUB
      return { name: 'PLATINUM', discountPercent: 15.0 };
    }
    if (totalSpentCents >= 25_000_00) { // 250k RUB
      return { name: 'GOLD', discountPercent: 10.0 };
    }
    if (totalSpentCents >= 5_000_00) { // 50k RUB
      return { name: 'SILVER', discountPercent: 5.0 };
    }
    if (totalSpentCents >= 1_000_00) { // 10k RUB
      return { name: 'BRONZE', discountPercent: 2.0 };
    }
    return { name: 'REGULAR', discountPercent: 0.0 };
  }

  /**
   * Calculates the final price for an order, applying the maximum available discount
   * between User Volume Tier, User Personal Discount, and Promo Code.
   * 
   * SAFETY GUARANTEES (ported from Legacy SMMplan):
   * 1. MAX_TOTAL_DISCOUNT cap — скидки не могут превысить 30%
   * 2. Safety Floor — итоговая цена никогда не падает ниже
   *    cost × (1 + 100%) / (1 − 14.5%) ≈ cost × 2.34
   *    (покрывает: УСН 6% + НДС 5% + Эквайринг 3.5% + 100% наценка)
   */
  async calculatePrice(
    userId: string | null | undefined,
    serviceId: string,
    quantity: number,
    promoCodeStr?: string | null,
    preloadedContext?: { user?: Prisma.UserGetPayload<object> | null, service?: Prisma.ServiceGetPayload<object> | null }
  ): Promise<PricingResult> {
    // CHK-07 & OWASP A03: Strict promo code normalization and injection sanitization
    if (promoCodeStr) {
      const clean = promoCodeStr.trim().toUpperCase();
      promoCodeStr = (clean.length <= 32 && /^[A-Z0-9_-]+$/.test(clean)) ? clean : null;
    } else {
      promoCodeStr = null;
    }

    let user = null;
    if (userId) {
      user = preloadedContext && preloadedContext.user !== undefined 
          ? preloadedContext.user 
          : await db.user.findUnique({ where: { id: userId } });
    }

    const service = preloadedContext && preloadedContext.service !== undefined
        ? preloadedContext.service
        : await db.service.findUnique({ where: { id: serviceId } });
        
    if (!service) throw new Error('Service not found');

    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(quantity)) {
      throw new Error('Количество должно быть целым положительным числом');
    }

    if (quantity < service.minQty || quantity > service.maxQty) {
      throw new Error(`Quantity must be between ${service.minQty} and ${service.maxQty}`);
    }

    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const liveCrossRates = await CBRRateService.getLiveCrossRates().catch(() => undefined);

    // 1. Calculate provider cost in RUB per 1k (Canonical Source of Truth)
    let costPer1kRub: number;
    if (typeof service.costPer1kRub === 'number' && Number.isFinite(service.costPer1kRub) && service.costPer1kRub > 0) {
      costPer1kRub = service.costPer1kRub;
    } else if (typeof service.rate === 'number' && Number.isFinite(service.rate) && service.rate > 0) {
      try {
        costPer1kRub = getCostRub(service.rate, service.providerCurrency || 'RUB', usdToRub, liveCrossRates);
      } catch {
        costPer1kRub = service.rate * (service.providerCurrency === 'RUB' ? 1.0 : usdToRub);
      }
    } else if (typeof service.pricePer1000Cents === 'number' && service.pricePer1000Cents > 0) {
      costPer1kRub = (service.pricePer1000Cents / 100) / ((service.markup && service.markup > 0) ? service.markup : SAFETY_FLOOR_MARKUP);
    } else {
      costPer1kRub = 0.01;
    }
    if (!Number.isFinite(costPer1kRub) || costPer1kRub <= 0) {
      costPer1kRub = 0.01;
    }

    const providerCostPer1000Cents = Math.round(costPer1kRub * 100);
    const providerCostCents = quantity > 0
      ? Math.max(1, Math.ceil((providerCostPer1000Cents / 1000) * quantity))
      : 0;

    // 2. Base Retail Price per 1k in Cents (Honors DB pricePer1000Cents for 100% storefront parity)
    let retailPer1000Cents: number;
    if (typeof service.pricePer1000Cents === 'number' && service.pricePer1000Cents > 0) {
      retailPer1000Cents = service.pricePer1000Cents;
    } else {
      const markup = (service.markup && service.markup > 0) ? service.markup : SAFETY_FLOOR_MARKUP;
      const rawRetailRub = applyBeautifulRounding(costPer1kRub * markup);
      const antiLoss = applyAntiNegativeMargin(costPer1kRub, rawRetailRub);
      retailPer1000Cents = antiLoss.finalRetailPer1kCents;
    }

    const originalTotalCents = quantity > 0
      ? Math.max(1, Math.ceil((retailPer1000Cents / 1000) * quantity))
      : 0;

    // 2. Discover available discounts
    const volumeTier = user ? this.getVolumeTier(Number(user.totalSpent)) : { name: 'REGULAR', discountPercent: 0.0 };
    let promoDiscountPercent = 0.0;
    const promoFixedDiscountCents = 0;
    
    if (promoCodeStr) {
      const promo = await db.promoCode.findUnique({ where: { code: promoCodeStr } });
      if (promo && promo.isActive && (promo.maxUses === 0 || promo.uses < promo.maxUses)) {
        if (!promo.expiresAt || promo.expiresAt > new Date()) {
          if (promo.type === 'VOUCHER') {
            throw new Error('VOUCHER_USE_BALANCE: Это ваучер на пополнение баланса. Активируйте его в разделе «Мой баланс», а затем оплатите заказ с баланса.');
          } else {
            promoDiscountPercent = promo.discountPercent;
          }
        }
      }
    }

    // 3. Find the maximum discount available to prevent margin squeeze
    // (We do not stack them additively — we take the single best discount)
    let maxDiscountPercent = Math.max(
      user?.personalDiscount || 0,
      volumeTier.discountPercent,
      promoDiscountPercent
    );

    // 3a. [SAFETY] Hard ceiling on total discount — prevents stacking exploits
    if (maxDiscountPercent > MAX_TOTAL_DISCOUNT) {
      maxDiscountPercent = MAX_TOTAL_DISCOUNT;
    }

    // 4. Calculate Final Cents
    const percentDiscountCents = Math.round((originalTotalCents * maxDiscountPercent) / 100);
    const voucherCents = promoFixedDiscountCents;

    let discountCents = percentDiscountCents + voucherCents;
    let totalCents = originalTotalCents - discountCents;

    // 5. [SAFETY FLOOR] Never sell below break-even after taxes & gateway fees (cost + mandatory deductions).
    // Break-even floor is providerCostCents / (1 - TOTAL_MANDATORY_DEDUCTIONS).
    // It is ONLY applied to prevent excessive discounts from causing negative profit,
    // and must NEVER inflate the base retail price above originalTotalCents.
    const rawBreakEvenCents = Math.ceil(providerCostCents / (1 - TOTAL_MANDATORY_DEDUCTIONS));
    const safetyFloorCents = Math.min(originalTotalCents, rawBreakEvenCents);
    
    if (totalCents < safetyFloorCents) {
      totalCents = safetyFloorCents;
      // Recalculate true discount applied so receipts match the actual charge (never negative)
      discountCents = Math.max(0, originalTotalCents - totalCents);
    }

    // Enforce a minimum price of 1 cent (0.01 ₽) for any calculated order
    if (quantity > 0 && totalCents < 1) {
      totalCents = 1;
      discountCents = Math.max(0, originalTotalCents - totalCents);
    }

    // Always accurately report the applied discount percentage for UI/Analytics
    const finalDiscountPercent = originalTotalCents > 0 ? Math.round((discountCents / originalTotalCents) * 100) : 0;

    return {
      totalCents,
      originalTotalCents,
      discountCents,
      discountPercent: finalDiscountPercent,
      providerCostCents,
      safetyFloorCents,
      tier: volumeTier.name,
    };
  }

  /**
   * Applies the use of a promo code atomically if required.
   */
  async consumePromoCode(tx: Prisma.TransactionClient, promoCodeStr?: string | null) {
    if (!promoCodeStr) return;

    // CHK-07: Case-insensitive promo code normalization
    const normalizedCode = promoCodeStr.trim().toUpperCase();

    const promo = await tx.promoCode.findUnique({ where: { code: normalizedCode } });
    
    if (!promo || !promo.isActive) {
      throw new Error('Промокод недействителен');
    }
    if (promo.type === 'VOUCHER') {
      throw new Error('VOUCHER_USE_BALANCE: Ваучер не может быть применён к заказу напрямую.');
    }
    if (promo.maxUses > 0 && promo.uses >= promo.maxUses) {
      throw new Error('Лимит использований промокода исчерпан');
    }
    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new Error('Срок действия промокода истёк');
    }

    const updatedPromo = await tx.promoCode.updateMany({
      where: { 
        id: promo.id,
        ...(promo.maxUses > 0 ? { uses: { lt: promo.maxUses } } : {})
      },
      data: { uses: { increment: 1 } }
    });

    if (updatedPromo.count === 0) {
      throw new Error('Лимит использований промокода исчерпан');
    }
  }

  /**
   * Evaluates volume discount for an array of services and formats them for B2B API Standards.
   * Protects pricing from dropping below the safety floor.
   */
  async getB2BFormattedServices(
    user: { totalSpent: number | bigint; personalDiscount?: number | null },
    services: {
      numericId: number;
      name: string;
      category: { name: string };
      rate: number;
      markup: number;
      providerCurrency?: string | null;
      minQty: number;
      maxQty: number;
      isDripFeedEnabled?: boolean;
      isCancelEnabled?: boolean;
    }[]
  ) {
    const volumeTier = this.getVolumeTier(Number(user.totalSpent));
    let maxDiscountPercent = Math.max(user.personalDiscount || 0, volumeTier.discountPercent);

    // Apply hard ceiling
    if (maxDiscountPercent > MAX_TOTAL_DISCOUNT) {
      maxDiscountPercent = MAX_TOTAL_DISCOUNT;
    }

    const usdToRub = await SettingsProvider.getExchangeRateUSD();

    return services.map(s => {
      const sExchangeRate = s.providerCurrency === 'RUB' ? 1.0 : usdToRub;
      // 1. Calculate original rate in normal currency format (RUB, not cents)
      const originalRatePer1000 = s.rate * s.markup * sExchangeRate;
      
      // 2. Apply highest applicable discount
      const discountVal = (originalRatePer1000 * maxDiscountPercent) / 100;
      let finalRatePer1000 = originalRatePer1000 - discountVal;

      // 3. Safety Floor: never below cost × (1 + SAFETY_FLOOR_MARKUP) / (1 - TOTAL_MANDATORY_DEDUCTIONS) in RUB
      const safetyFloor = (s.rate * sExchangeRate * (1 + SAFETY_FLOOR_MARKUP)) / (1 - TOTAL_MANDATORY_DEDUCTIONS);
      if (finalRatePer1000 < safetyFloor) {
        finalRatePer1000 = safetyFloor;
      }

      // 4. Return standard API v2 compliant object
      return {
        service: s.numericId,
        name: s.name,
        type: 'Default',
        category: s.category.name,
        // Ensure rate matches the SMMplan schema (not cents) formatted strictly to 4 decimals
        rate: Number(finalRatePer1000).toFixed(4),
        min: s.minQty,
        max: s.maxQty,
        dripfeed: s.isDripFeedEnabled,
        // TODO: set to s.isRefillEnabled when action=refill is implemented
        refill: false,
        cancel: s.isCancelEnabled
      };
    });
  }
}

export const marketingService = new MarketingService();
