'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { SettingsProvider } from '@/lib/settings';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const restartRefillSchema = z.object({
  refillId: z.string().min(1),
});

const updateRefillStatusSchema = z.object({
  refillId: z.string().min(1),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'ERROR']),
});

/**
 * ⚡ Toggle Global Refill Module (Kill-Switch)
 */
export async function toggleRefillModuleAction(enable: boolean) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    try {
      await SettingsProvider.setRefillModuleEnabled(enable);

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'REFILL_MODULE_TOGGLE',
        target: 'GLOBAL_SETTINGS',
        targetType: 'SYSTEM_SETTINGS',
        newValue: { isRefillModuleEnabled: enable },
      });

      revalidatePath('/admin/refills');
      revalidatePath('/dashboard/orders');
      return { success: true as const, isEnabled: enable };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка при переключении статуса модуля' };
    }
  });
}

/**
 * 🔄 Restart a failed or stuck refill
 */
export async function directRestartRefillAction(refillId: string) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    try {
      const refill = await db.refill.findUnique({
        where: { id: refillId },
        include: { order: { select: { tenantId: true } } },
      });

      if (!refill) {
        return { success: false as const, error: 'Докрутка не найдена' };
      }

      if (refill.status === 'COMPLETED') {
        return { success: false as const, error: 'Докрутка уже успешно завершена' };
      }

      await db.refill.update({
        where: { id: refillId },
        data: {
          status: 'PENDING',
          externalId: null,
        },
      });

      try {
        const { getRedisConnection } = await import('@/lib/queue-manager');
        const redis = getRedisConnection();
        if (redis && typeof redis.del === 'function') {
          await redis.del(`refill:dispatched:${refillId}`).catch(() => {});
          await redis.del(`refill:client-lock:${refill.orderId}`).catch(() => {});
        }
      } catch {
        // Non-blocking Redis cleanup
      }

      const { refillQueue } = await import('@/lib/queue-manager');
      await refillQueue.add('process-refill', { refillId, tenantId: refill.order?.tenantId || 'smmplan' });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'REFILL_RESTART',
        target: refillId,
        targetType: 'REFILL',
        oldValue: { status: refill.status },
        newValue: { status: 'PENDING' },
      });

      revalidatePath('/admin/refills');
      return { success: true as const };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка при перезапуске докрутки' };
    }
  });
}

/**
 * 🛠️ Direct status override by support agent / admin
 */
export async function directUpdateRefillStatusAction(
  refillId: string,
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'ERROR'
) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    try {
      const refill = await db.refill.findUnique({
        where: { id: refillId },
      });

      if (!refill) {
        return { success: false as const, error: 'Докрутка не найдена' };
      }

      await db.refill.update({
        where: { id: refillId },
        data: { status },
      });

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'REFILL_STATUS_OVERRIDE',
        target: refillId,
        targetType: 'REFILL',
        oldValue: { status: refill.status },
        newValue: { status },
      });

      revalidatePath('/admin/refills');
      return { success: true as const };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка при изменении статуса докрутки' };
    }
  });
}

/**
 * Legacy Form-Action support
 */
export async function restartRefillAction(formData: FormData) {
  const parsed = restartRefillSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false as const, error: 'Некорректный ID докрутки' };
  }
  return directRestartRefillAction(parsed.data.refillId);
}

export async function updateRefillStatusAction(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false as const, error: 'Некорректные данные' };
  }
  const parsed = updateRefillStatusSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { success: false as const, error: 'Некорректные данные' };
  }
  return directUpdateRefillStatusAction(parsed.data.refillId, parsed.data.status);
}
