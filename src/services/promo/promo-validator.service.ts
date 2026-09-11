/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Hardened Promo Code Validator with Anti-Brute-Force Rate Limiting.
 */

import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';

export interface PromoValidationResult {
  valid: boolean;
  promo?: {
    id: string;
    code: string;
    type: string;
    discountPercent: number;
    amount: number;
  };
  error?: string;
  requiresCaptcha?: boolean;
}

export class PromoValidatorService {
  /**
   * Validates promo code application with rate limiting and generic error anti-enumeration.
   */
  static async validateCode(
    code: string,
    userId: string,
    orderAmountCents?: bigint | number,
    tenantId?: string
  ): Promise<PromoValidationResult> {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || cleanCode.length < 3 || cleanCode.length > 32) {
      return { valid: false, error: 'Неверный формат промокода' };
    }

    // Rate Limit: 5 attempts per 5 minutes per user/IP
    const isAllowed = await RateLimitService.checkCustomKey(`promo_rate:${userId}`, 5, 300);
    if (!isAllowed) {
      return {
        valid: false,
        error: 'Слишком много попыток ввода промокода. Подождите 5 минут.',
        requiresCaptcha: true,
      };
    }

    const promo = await db.promoCode.findUnique({
      where: { code: cleanCode },
    });

    if (!promo || !promo.isActive) {
      return { valid: false, error: 'Промокод недействителен или условия не выполнены' };
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      return { valid: false, error: 'Промокод недействителен или условия не выполнены' };
    }

    if (promo.uses >= promo.maxUses) {
      return { valid: false, error: 'Промокод недействителен или условия не выполнены' };
    }

    // Check single-use per user
    const alreadyUsed = await db.ledgerEntry.findFirst({
      where: {
        idempotencyKey: `promo-${cleanCode}-${userId}`,
        ...(tenantId ? { tenantId } : {})
      },
    });

    if (alreadyUsed) {
      return { valid: false, error: 'Вы уже активировали данный промокод' };
    }

    return {
      valid: true,
      promo: {
        id: promo.id,
        code: promo.code,
        type: promo.type,
        discountPercent: promo.discountPercent,
        amount: promo.amount,
      },
    };
  }
}
