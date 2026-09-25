'use server';

import { verifySession } from '@/lib/session';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { SettingsProvider } from '@/lib/settings';

export async function requestClientRefillAction(input: string | { orderId: string }) {
  const isModuleEnabled = await SettingsProvider.isRefillModuleEnabled();
  if (!isModuleEnabled) {
    return {
      success: false as const,
      error: 'Сервис автоматических гарантийных докруток временно приостановлен. Пожалуйста, обратитесь в службу поддержки.',
    };
  }

  const session = await verifySession();
  if (!session || !session.userId) {
    return { success: false as const, error: 'Пользователь не авторизован' };
  }

  const orderId = typeof input === 'string' ? input : input?.orderId;
  if (!orderId || typeof orderId !== 'string') {
    return { success: false as const, error: 'ID заказа не указан' };
  }

  try {
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        userId: session.userId,
        tenantId: session.tenantId,
      },
      include: {
        service: {
          select: {
            isRefillEnabled: true,
          },
        },
        refills: {
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!order) {
      return { success: false as const, error: 'Заказ не найден или недоступен' };
    }

    if (!order.service?.isRefillEnabled) {
      return {
        success: false as const,
        error: 'Для данной услуги бесплатная докрутка не предусмотрена',
      };
    }

    if (order.status !== 'COMPLETED' && order.status !== 'PARTIAL') {
      return {
        success: false as const,
        error: 'Докрутка доступна только для завершенных или частично выполненных заказов',
      };
    }

    const hasActiveRefill = order.refills.some((r) =>
      ['PENDING', 'IN_PROGRESS'].includes(r.status)
    );

    if (hasActiveRefill) {
      const activeRefill = order.refills.find((r) =>
        ['PENDING', 'IN_PROGRESS'].includes(r.status)
      );
      return {
        success: false as const,
        error: 'Заявка на докрутку уже принята и находится в обработке',
        refill: activeRefill
          ? {
              id: activeRefill.id,
              status: activeRefill.status,
              createdAt: activeRefill.createdAt.toISOString(),
            }
          : undefined,
      };
    }

    const latestRefill = order.refills && order.refills.length > 0 ? order.refills[0] : null;
    if (latestRefill) {
      const elapsedMs = Date.now() - new Date(latestRefill.createdAt).getTime();
      const COOLDOWN_24H_MS = 24 * 60 * 60 * 1000;
      const COOLDOWN_1H_MS = 60 * 60 * 1000;

      if (latestRefill.status === 'REJECTED' && elapsedMs < COOLDOWN_24H_MS - 1000) {
        const remainingHours = Math.max(1, Math.ceil((COOLDOWN_24H_MS - elapsedMs) / (1000 * 60 * 60)));
        return {
          success: false as const,
          error: `Предыдущая заявка была отклонена поставщиком (списания не зафиксированы или гарантия недоступна). Повторный запрос будет доступен через ${remainingHours} ч.`,
          refill: {
            id: latestRefill.id,
            status: latestRefill.status,
            createdAt: latestRefill.createdAt.toISOString(),
          },
        };
      }

      if (latestRefill.status === 'COMPLETED' && elapsedMs < COOLDOWN_24H_MS - 1000) {
        const remainingHours = Math.max(1, Math.ceil((COOLDOWN_24H_MS - elapsedMs) / (1000 * 60 * 60)));
        return {
          success: false as const,
          error: `Предыдущая докрутка была успешно выполнена. Повторный запрос возможен через ${remainingHours} ч.`,
          refill: {
            id: latestRefill.id,
            status: latestRefill.status,
            createdAt: latestRefill.createdAt.toISOString(),
          },
        };
      }

      if (latestRefill.status === 'ERROR' && elapsedMs < COOLDOWN_1H_MS - 1000) {
        const remainingMinutes = Math.max(1, Math.ceil((COOLDOWN_1H_MS - elapsedMs) / (1000 * 60)));
        return {
          success: false as const,
          error: `При отправке предыдущей заявки произошла ошибка. Повторный запрос будет доступен через ${remainingMinutes} мин.`,
          refill: {
            id: latestRefill.id,
            status: latestRefill.status,
            createdAt: latestRefill.createdAt.toISOString(),
          },
        };
      }
    }

    try {
      const { getRedisConnection } = await import('@/lib/queue-manager');
      const redis = typeof getRedisConnection === 'function' ? getRedisConnection() : null;
      if (redis && typeof redis.set === 'function') {
        const acquired = await redis.set(`refill:client-lock:${order.id}`, '1', 'EX', 15, 'NX');
        if (!acquired) {
          return {
            success: false as const,
            error: 'Запрос на докрутку уже обрабатывается. Пожалуйста, подождите.',
          };
        }
      }
    } catch (redisErr) {
      console.error('[RefillAction] Redis lock failure:', redisErr);
      return {
        success: false as const,
        error: 'Временный сбой сервиса очередей. Пожалуйста, повторите запрос позже.',
      };
    }

    const refill = await db.refill.create({
      data: {
        orderId: order.id,
        status: 'PENDING',
      },
    });

    try {
      const { refillQueue } = await import('@/lib/queue-manager');
      if (!refillQueue) {
        throw new Error('Очередь обработки докруток недоступна');
      }
      await refillQueue.add('process-refill', { refillId: refill.id, tenantId: order.tenantId });
    } catch (queueErr) {
      console.error('[RefillAction] Failed to add refill to queue:', queueErr);
      
      // Cleanup the pending refill so the user is not permanently locked
      await db.refill.update({
        where: { id: refill.id },
        data: { status: 'ERROR' }
      });

      return {
        success: false as const,
        error: 'Ошибка постановки заявки на докрутку в очередь. Пожалуйста, повторите попытку.',
      };
    }

    revalidatePath('/dashboard/orders');
    revalidatePath(`/dashboard/orders/${order.id}`);

    return {
      success: true as const,
      message: 'Заявка на докрутку принята',
      refill: {
        id: refill.id,
        status: refill.status,
        createdAt: refill.createdAt.toISOString(),
      },
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false as const,
      error: errorMsg || 'Ошибка при запросе докрутки',
    };
  }
}

