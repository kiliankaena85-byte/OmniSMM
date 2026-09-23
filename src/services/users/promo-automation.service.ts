import { db } from '@/lib/db';
import crypto from 'crypto';

export class PromoAutomationService {
  /**
   * Evaluates the user's total spend and instantly issues a unique promo code
   * if they cross certain financial thresholds. 
   * This is tied directly to the post-checkout lifecycle.
   */
  static async checkAndIssueLoyalty(userId: string) {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return;

      const totalSpentCents = user.totalSpent;

      // Define loyalty tiers and their reward discounts
      const rules = [
        { spendThreshold: 2500_00, percent: 5, description: 'Бонус за траты > 2500 RUB' },
        { spendThreshold: 10000_00, percent: 10, description: 'VIP Бонус за траты > 10,000 RUB' },
        { spendThreshold: 50000_00, percent: 15, description: 'КиТ Бонус за траты > 50,000 RUB' },
      ];

      for (const rule of rules) {
        if (totalSpentCents >= rule.spendThreshold) {
          // Idempotency: Ensure we don't issue the same bonus twice to the same user
          // SEC-FIX-03: Fail-Closed — JWT_SECRET must be configured to prevent predictable HMAC output
          const secret = process.env.JWT_SECRET;
          if (!secret) {
            console.error('[PromoAutomation] FATAL: JWT_SECRET is not configured. Cannot issue promo codes securely. Skipping.');
            return;
          }
          const uniqueHash = crypto.createHmac('sha256', secret).update(userId + rule.percent).digest('hex').substring(0, 8).toUpperCase();
          const deterministicCode = `VIP${rule.percent}-${uniqueHash}`;

          // Idempotency check: Upsert to gracefully handle race conditions without throwing unique constraint error
          await db.promoCode.upsert({
            where: { code: deterministicCode },
            update: {}, // Do nothing if it exists
            create: {
              code: deterministicCode,
              discountPercent: rule.percent,
              maxUses: 1, // One-time use reward
              isActive: true
            }
          });

          // Idempotency: ensure audit log is only inserted once using unique constraint workaround implicitly or just checking. 
          // Better: use findFirst to see if we already logged it today or ever.
          const existingLog = await db.auditLog.findFirst({
            where: { userId, action: 'PROMO_ISSUED', details: { contains: deterministicCode } }
          });

          if (!existingLog) {
            // Log it so admin or UI can see it was issued automatically
            await db.auditLog.create({
              data: {
                userId: userId,
                action: 'PROMO_ISSUED',
                details: `Автоматически выдан промокод ${deterministicCode} (${rule.percent}%) по правилу: ${rule.description}`
              }
            });

            // If we had an email or bot service wired up in Lite, we would broadcast here:
            // BotService.sendMessage(user.tgId, `Вам выпал бонус! ${deterministicCode}`);
          }
        }
      }
    } catch (e: unknown) {
      console.error(`PromoAutomationService Error for User ${userId}:`, (e instanceof Error ? e.message : String(e)));
    }
  }
}
