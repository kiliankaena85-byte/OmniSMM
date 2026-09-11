'use server';
import { Prisma } from '@prisma/client';

import { db } from "@/lib/db";
import { verifySession } from "@/lib/session";
import { WalletOps } from "@/services/financial/wallet-ops";
import { RateLimitService } from "@/services/core/rate-limit.service";

export async function activatePromoCodeAction(code: string): Promise<{ success: boolean; amount?: number; error?: string }> {
  try {
    const session = await verifySession();
    if (!session) {
      return { success: false, error: "Требуется авторизация" };
    }

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, error: "Введите промокод" };
    }

    // Rate Limit: Prevent brute-force guessing
    const isAllowed = await RateLimitService.checkCustomKey(`promo_activate_user:${session.userId}`, 5, 60);
    if (!isAllowed) {
      return { success: false, error: "Слишком много попыток. Пожалуйста, подождите минуту." };
    }

    // Bounded retry loop for Serialization Failures (P2034)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await db.$transaction(async (tx) => {
          const promo = await tx.promoCode.findUnique({ where: { code: cleanCode } });

          if (!promo || !promo.isActive) {
            return { success: false, error: "Промокод недействителен или не существует" };
          }

          if (promo.expiresAt && promo.expiresAt < new Date()) {
            return { success: false, error: "Срок действия промокода истёк" };
          }

          if (promo.type !== "VOUCHER") {
            return { success: false, error: "Этот промокод дает скидку на заказы. Примените его при оформлении заказа на главной странице." };
          }

          if (promo.amount <= 0) {
            return { success: false, error: "Этот промокод не содержит денежного бонуса" };
          }

          const user = await tx.user?.findUnique?.({ where: { id: session.userId }, select: { tenantId: true } });
          const tenantId = user?.tenantId || (session as any)?.tenantId || 'smmplan';

          // Check if user already used this promo code (using DB-level idempotency key)
          const idempotencyKey = `promo-${cleanCode}-${session.userId}`;
          const alreadyUsed = await tx.ledgerEntry.findFirst({
            where: {
              idempotencyKey,
              tenantId
            }
          });

          if (alreadyUsed) {
            return { success: false, error: "Вы уже активировали этот промокод" };
          }

          // Optimistic Concurrency Control (OCC) for usage limits
          const updatedPromo = await tx.promoCode.updateMany({
            where: { 
              id: promo.id,
              ...(promo.maxUses > 0 ? { uses: { lt: promo.maxUses } } : {})
            },
            data: { uses: { increment: 1 } }
          });

          if (updatedPromo.count === 0) {
            return { success: false, error: "Лимит использований промокода исчерпан" };
          }

          // Activate voucher -> Add to balance via WalletOps
          const reason = `Активация ваучера: ${cleanCode}`;
          await WalletOps.credit(tx, session.userId, promo.amount, reason, { idempotencyKey, tenantId });

          return { success: true, amount: promo.amount };
        }, { isolationLevel: 'Serializable' });

        return result;
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          const metaTarget = Array.isArray(error.meta?.target) ? (error.meta.target as string[]) : [];
          if (error.code === 'P2002' && metaTarget.includes('idempotencyKey')) {
            return { success: false, error: "Вы уже активировали этот промокод" };
          }
          if (error.code === 'P2034') {
            if (attempt < 2) continue; // Retry on serialization failure
            return { success: false, error: "Транзакция в обработке, пожалуйста, попробуйте еще раз." };
          }
        }
        throw error;
      }
    }
    return { success: false, error: "Не удалось активировать промокод, попробуйте позже." };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : "Неизвестная ошибка активации промокода";
    return { success: false, error: errorMsg };
  }
}
