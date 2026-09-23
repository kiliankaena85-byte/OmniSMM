'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { marketingService, PricingResult } from '@/services/marketing.service';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { verifySession } from '@/lib/session';
import { normalizeTenantId } from "@/lib/tenant-resolver-edge";
import { headers } from 'next/headers';
import { getClientIp } from '@/utils/ip';
import { handleServerError } from '@/utils/error-handler';
import { createSafeAction } from '@/lib/safe-action';
import { CheckoutPipelineService } from '@/services/orders/checkout-pipeline.service';
import { RetryCheckoutService } from '@/services/orders/retry-checkout.service';
import { GatewaysAvailabilityService } from '@/services/orders/gateways-availability.service';
import { getDripFeedFloorViolation } from '@/services/orders/drip-feed-floor';

/**
 * @public Calculates price for display on the order form (no auth required).
 */
export async function calculatePriceAction(
  serviceId: string,
  quantity: number,
  promoCodeStr?: string,
  runs?: number,
  isSmartDrip?: boolean
): Promise<{ success: boolean; data?: PricingResult; error?: string }> {
  try {
    const isAllowed = await RateLimitService.check("priceCalc", 60, 60, true);
    if (!isAllowed) {
      return { success: false, error: "Слишком много запросов. Попробуйте через минуту." };
    }

    if (!quantity || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(quantity) || quantity > 10_000_000) {
      return { success: false, error: "Количество должно быть целым положительным числом" };
    }
    if (runs !== undefined && (!Number.isInteger(runs) || runs < 1 || runs > 100)) {
      return { success: false, error: "Количество запусков должно быть от 1 до 100" };
    }

    const service = await db.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive) {
      return { success: false, error: "Услуга не найдена или неактивна" };
    }

    // Drip-Feed Floor Invariant: never quote a price for an order the checkout transaction would reject.
    // Smart Drip days are not known at price-preview time, so only classic runs are checked here.
    if (!isSmartDrip && runs && runs > 0) {
      const dripViolation = getDripFeedFloorViolation(quantity, runs, service.minQty, 'runs');
      if (dripViolation) return { success: false, error: dripViolation };
    }

    const cleanPromo = promoCodeStr ? promoCodeStr.trim().toUpperCase() : undefined;
    if (cleanPromo) {
      if (cleanPromo.length < 3 || cleanPromo.length > 32 || !/^[A-Z0-9_-]+$/.test(cleanPromo)) {
        return { success: false, error: "Некорректный формат промокода" };
      }
      let clientIp = '127.0.0.1';
      try {
        clientIp = await getClientIp();
      } catch {
        /* fallback */
      }
      const isPromoRateAllowed = await RateLimitService.checkCustomKey(`promo_rate:${clientIp}`, 15, 60);
      if (!isPromoRateAllowed) {
        return { success: false, error: "Слишком много попыток ввода промокода. Подождите минуту." };
      }
    }

    const result = await marketingService.calculatePrice(null, serviceId, quantity, cleanPromo || promoCodeStr);

    let markupMultiplier = 1;
    if (isSmartDrip) {
      const smartConfig = await db.serviceSmartConfig.findUnique({ where: { serviceId } });
      if (smartConfig && smartConfig.isEnabled) {
        markupMultiplier = 1 + smartConfig.markup;
      }
    }

    const safeResult: PricingResult = {
      totalCents: Math.round(result.totalCents * markupMultiplier),
      originalTotalCents: Math.round(result.originalTotalCents * markupMultiplier),
      discountCents: Math.round(result.discountCents * markupMultiplier),
      discountPercent: result.discountPercent,
      providerCostCents: 0,
      safetyFloorCents: Math.round(result.safetyFloorCents * markupMultiplier),
      tier: result.tier,
    };

    return { success: true, data: safeResult };
  } catch (error: unknown) {
    const localized = handleServerError(error);
    return { success: false, error: localized.message };
  }
}

const checkoutSchema = z.object({
  serviceId: z.string(),
  link: z.string().min(3, "Ссылка слишком короткая").max(2048, "Ссылка слишком длинная").refine(val => !val.includes(' '), "Ссылка не должна содержать пробелов"),
  quantity: z.number().int("Количество должно быть целым числом").min(1, "Минимальное количество — 1").max(10_000_000, "Превышен максимальный лимит количества"),
  email: z.string().email("Неверный email"),
  promoCodeStr: z.string().trim().max(32, "Промокод не может быть длиннее 32 символов").regex(/^[a-zA-Z0-9_-]*$/, "Некорректный формат промокода").optional(),
  runs: z.number().int("Количество запусков должно быть целым числом").min(1).max(100).optional(),
  interval: z.number().int("Интервал должен быть целым числом").min(1).max(10080).optional(),
  customData: z.string().optional(),
  gateway: z.string().optional().default('yookassa'),
  idempotencyKey: z.string().min(10).max(64).optional(),
  mediaGroupUrl: z.string().optional(),
  isLinkOverridden: z.boolean().optional(),
  isSmartDrip: z.boolean().optional(),
  smartDripDays: z.number().int().min(1).max(30).optional(),
  abVariant: z.enum(['A', 'B', 'C']).optional(),
  isRequirementsConfirmed: z.boolean().optional(),
  tenantId: z.string().optional()
});

export const checkoutAction = async (input: z.input<typeof checkoutSchema>) => {
  return createSafeAction(checkoutSchema, input, async (data) => {
    return await CheckoutPipelineService.processOrder(data);
  });
};

const retryCheckoutSchema = z.object({
  orderId: z.string(),
  gateway: z.string().default('yookassa')
});

export const retryCheckoutAction = async (input: z.infer<typeof retryCheckoutSchema>) => {
  return createSafeAction(retryCheckoutSchema, input, async (data) => {
    const { orderId, gateway } = data;
    const session = await verifySession();
    if (!session || !session.userId) throw new Error("Необходима авторизация");

    const isAllowed = await RateLimitService.check("retryCheckoutCore", 10, 60, true);
    if (!isAllowed) throw new Error("Слишком много запросов. Попробуйте через минуту.");

    let reqHeaders: { get: (key: string) => string | null };
    try {
      reqHeaders = await headers();
    } catch {
      reqHeaders = {
        get: (key: string) => (key === 'host' ? 'localhost:3000' : key === 'x-forwarded-proto' ? 'http' : null)
      };
    }

    const consentIp = await getClientIp();
    const consentUserAgent = reqHeaders.get("user-agent") || "Unknown";
    const rawTenantId = reqHeaders.get("x-tenant-id");
    const currentTenantId = normalizeTenantId(rawTenantId) || "smmplan";

    return await RetryCheckoutService.execute({
      orderId,
      gateway: gateway || 'yookassa',
      sessionUserId: session.userId,
      currentTenantId,
      consentIp,
      consentUserAgent,
      reqHeaders
    });
  });
};

/** @public Public gateway configuration for checkout */
export async function getAvailableGatewaysAction(explicitTenantId?: string) {
  try {
    const data = await GatewaysAvailabilityService.getAvailable(explicitTenantId);
    return { success: true, data };
  } catch (err: unknown) {
    console.error('[getAvailableGatewaysAction] Error:', err);
    return {
      success: false,
      error: (err instanceof Error ? err.message : String(err)) || 'Ошибка проверки настроек платежных шлюзов'
    };
  }
}
