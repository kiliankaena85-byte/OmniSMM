'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { SettingsProvider } from '@/lib/settings';
import { applyBeautifulRounding } from '@/lib/financial-constants';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const applySingleSchema = z.object({
  recommendationId: z.string().min(1),
});

const bulkApplySchema = z.object({
  snapshotId: z.string().min(1),
  recommendationIds: z.array(z.string().min(1)).min(1).max(200),
});

const rejectSchema = z.object({
  recommendationId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

/**
 * 1-Click Apply for a single AI pricing recommendation.
 */
export async function applyAiRecommendationAction(
  recommendationId: string
): Promise<ActionResult<{ serviceId: string; newPriceRub: number; newMarkup: number }>> {
  const parsed = applySingleSchema.safeParse({ recommendationId });
  if (!parsed.success) {
    return { success: false, error: 'Неверный идентификатор рекомендации' };
  }

  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    try {
      const rec = await db.aiPricingRecommendation.findUnique({
        where: { id: recommendationId },
        include: { service: true, snapshot: true },
      });

      if (!rec) {
        return { success: false, error: 'Рекомендация не найдена' };
      }

      if (rec.status === 'APPROVED') {
        return { success: false, error: 'Рекомендация уже была применена ранее' };
      }

      const usdToRub = await SettingsProvider.getExchangeRateUSD();
      const exchangeRate = rec.service.providerCurrency === 'RUB' ? 1.0 : usdToRub;
      const newPriceCents = Math.round(
        applyBeautifulRounding(rec.service.rate * rec.proposedMarkup * exchangeRate) * 100
      );

      await db.$transaction(async (tx) => {
        // 1. Update Service pricing
        await tx.service.update({
          where: { id: rec.serviceId },
          data: {
            markup: rec.proposedMarkup,
            pricePer1000Cents: newPriceCents,
          },
        });

        // 2. Track Price History
        await tx.servicePriceHistory.create({
          data: {
            serviceId: rec.serviceId,
            rate: rec.service.rate,
          },
        });

        // 3. Mark Recommendation as APPROVED
        await tx.aiPricingRecommendation.update({
          where: { id: rec.id },
          data: {
            status: 'APPROVED',
            appliedAt: new Date(),
          },
        });

        // 4. Update Snapshot status if all approved
        const remaining = await tx.aiPricingRecommendation.count({
          where: { snapshotId: rec.snapshotId, status: 'PENDING' },
        });

        await tx.economicOptimizationSnapshot.update({
          where: { id: rec.snapshotId },
          data: {
            status: remaining === 0 ? 'APPLIED' : 'PARTIALLY_APPLIED',
            appliedBy: admin.id,
            appliedAt: new Date(),
          },
        });

        // 5. Audit Log (Financial Integrity)
        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'APPLY_AI_PRICING_RECOMMENDATION',
          target: rec.serviceId,
          targetType: 'SERVICE',
          oldValue: { markup: rec.currentMarkup, priceRub: rec.currentPriceRub },
          newValue: { markup: rec.proposedMarkup, priceRub: rec.proposedPriceRub, gain: rec.projectedMonthlyGainRub },
        });
      });

      revalidatePath('/admin/economics/recommendations');
      revalidatePath('/admin/catalog/services');

      return {
        success: true,
        data: {
          serviceId: rec.serviceId,
          newPriceRub: rec.proposedPriceRub,
          newMarkup: rec.proposedMarkup,
        },
      };
    } catch (err: unknown) {
      console.error('[applyAiRecommendationAction] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Внутренняя ошибка сервера' };
    }
  });
}

/**
 * Bulk 1-Click Apply for multiple AI pricing recommendations in a snapshot.
 */
export async function bulkApplyAiRecommendationsAction(
  snapshotId: string,
  recommendationIds: string[]
): Promise<ActionResult<{ appliedCount: number }>> {
  const parsed = bulkApplySchema.safeParse({ snapshotId, recommendationIds });
  if (!parsed.success) {
    return { success: false, error: 'Неверные параметры пакетного применения' };
  }

  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    try {
      const recommendations = await db.aiPricingRecommendation.findMany({
        where: {
          id: { in: recommendationIds },
          snapshotId,
          status: 'PENDING',
        },
        include: { service: true },
      });

      if (recommendations.length === 0) {
        return { success: false, error: 'Нет доступных рекомендаций для применения' };
      }

      const usdToRub = await SettingsProvider.getExchangeRateUSD();

      await db.$transaction(async (tx) => {
        for (const rec of recommendations) {
          const exchangeRate = rec.service.providerCurrency === 'RUB' ? 1.0 : usdToRub;
          const newPriceCents = Math.round(
            applyBeautifulRounding(rec.service.rate * rec.proposedMarkup * exchangeRate) * 100
          );

          await tx.service.update({
            where: { id: rec.serviceId },
            data: {
              markup: rec.proposedMarkup,
              pricePer1000Cents: newPriceCents,
            },
          });

          await tx.servicePriceHistory.create({
            data: {
              serviceId: rec.serviceId,
              rate: rec.service.rate,
            },
          });

          await tx.aiPricingRecommendation.update({
            where: { id: rec.id },
            data: {
              status: 'APPROVED',
              appliedAt: new Date(),
            },
          });
        }

        const remainingCount = await tx.aiPricingRecommendation.count({
          where: { snapshotId, status: 'PENDING' },
        });

        await tx.economicOptimizationSnapshot.update({
          where: { id: snapshotId },
          data: {
            status: remainingCount === 0 ? 'APPLIED' : 'PARTIALLY_APPLIED',
            appliedBy: admin.id,
            appliedAt: new Date(),
          },
        });

        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'BULK_APPLY_AI_PRICING_RECOMMENDATIONS',
          target: snapshotId,
          targetType: 'ECONOMIC_SNAPSHOT',
          newValue: { appliedCount: recommendations.length, appliedIds: recommendations.map((r) => r.id) },
        });
      });

      revalidatePath('/admin/economics/recommendations');
      revalidatePath('/admin/catalog/services');

      return {
        success: true,
        data: { appliedCount: recommendations.length },
      };
    } catch (err: unknown) {
      console.error('[bulkApplyAiRecommendationsAction] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Внутренняя ошибка сервера' };
    }
  });
}

/**
 * Reject an AI pricing recommendation with a mandatory justification.
 */
export async function rejectAiRecommendationAction(
  recommendationId: string,
  reason: string
): Promise<ActionResult<{ rejectedId: string }>> {
  const parsed = rejectSchema.safeParse({ recommendationId, reason });
  if (!parsed.success) {
    return { success: false, error: 'Обоснование отклонения обязательно (до 500 символов)' };
  }

  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    try {
      const rec = await db.aiPricingRecommendation.findUnique({
        where: { id: recommendationId },
      });

      if (!rec) {
        return { success: false, error: 'Рекомендация не найдена' };
      }

      await db.aiPricingRecommendation.update({
        where: { id: recommendationId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason.trim(),
        },
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'REJECT_AI_PRICING_RECOMMENDATION',
        target: recommendationId,
        targetType: 'AI_RECOMMENDATION',
        newValue: { reason: reason.trim() },
      });

      revalidatePath('/admin/economics/recommendations');

      return { success: true, data: { rejectedId: recommendationId } };
    } catch (err: unknown) {
      console.error('[rejectAiRecommendationAction] Error:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Внутренняя ошибка сервера' };
    }
  });
}
