// tenant-isolation-ignore: Background worker executed within order.processor runWithTenant wrapper
import { Job, UnrecoverableError } from 'bullmq';
import { db } from '../../../lib/db';
import { OrderJobPayload, getRedisConnection } from '@/lib/queue-manager';
import { logger } from '../../../lib/logger';
import { fetchOrderWithRelations, OrderWithRelations } from './types';

const log = logger.child({ component: 'OrderPreflightGuard' });

export class OrderPreflightGuard {
  static async validateAndFetchOrder(job: Job<OrderJobPayload>): Promise<{ order: OrderWithRelations | null; redisKey: string }> {
    let orderId: string;
    try {
      const { OrderJobSchema } = await import('../../../schemas/jobs.schema');
      const parsed = OrderJobSchema.parse(job.data);
      orderId = parsed.orderId;
    } catch (zodErr) {
      log.error(`[OrderProcessor] Invalid job payload for job ${job.id}`, { cause: zodErr });
      throw new UnrecoverableError('Invalid job payload');
    }

    const order = await fetchOrderWithRelations(db, orderId);
    if (!order) {
      log.warn(`[OrderProcessor] Order ${orderId} not found.`);
      return { order: null, redisKey: '' };
    }

    if (order.status !== 'PENDING') {
      log.warn(`[OrderProcessor] Order ${orderId} is not PENDING (current status: ${order.status}). Skip.`);
      return { order: null, redisKey: '' };
    }

    if (order.smartCampaign) {
      log.info(`[OrderProcessor] Intercepted SmartDrip parent order ${orderId}. Activating SmartCampaign.`);
      await db.$transaction([
        db.order.update({
          where: { id: order.id },
          data: { status: 'IN_PROGRESS' }
        }),
        db.smartCampaign.update({
          where: { id: order.smartCampaign.id },
          data: { status: 'RUNNING' }
        })
      ]);
      return { order: null, redisKey: '' };
    }

    // TEST ORDER GUARD
    const envMode = order.environmentMode;
    const isMockProvider = envMode === 'SANDBOX' || envMode === 'ACQUIRING_TEST';
    if (order.isTest && !isMockProvider && envMode !== 'HYBRID') {
      log.error(`[OrderProcessor] CRITICAL: Test order ${orderId} picked up in production mode. Failing safely.`);
      const { orderService } = await import('../../../services/core/order.service');
      await orderService.failOrderTerminal(
        orderId,
        'SYSTEM_GUARD: Попытка отправки тестового заказа реальному провайдеру в боевом режиме прервана.'
      );
      return { order: null, redisKey: '' };
    }

    if (order.externalId) {
      log.warn(`[OrderProcessor] Order ${orderId} already has an externalId (${order.externalId}). Skipping to prevent duplicate dispatch.`);
      return { order: null, redisKey: '' };
    }

    // Duplicate dispatch guard via Redis
    const connection = getRedisConnection();
    const redisKey = `order:dispatched:${order.id}`;
    const alreadyDispatched = await connection.get(redisKey);

    if (alreadyDispatched) {
      log.warn(`[OrderProcessor] Duplicate Dispatch Guard: Order ${order.id} was already dispatched to provider but DB write failed previously. Shifting to PENDING_CHECK.`);
      await db.order.update({
        where: { id: order.id },
        data: {
          status: 'PENDING_CHECK',
          error: 'Попытка повторной отправки заблокирована: заказ уже был отправлен провайдеру.'
        }
      });

      try {
        const { sendAdminAlert } = await import('@/lib/notifications');
        await sendAdminAlert(
          `🛡️ [ЗАЩИТА ОТ ДВОЙНОГО СПИСАНИЯ] Заказ #${order.numericId} (Услуга: ${order.service.name})\n` +
          `Система предотвратила повторную отправку заказа поставщику.\n` +
          `Заказ переведён в статус «На проверке» (PENDING_CHECK). Проверьте в кабинете поставщика, был ли создан заказ, чтобы не платить дважды.`,
          'CRITICAL'
        );
      } catch { /* ignore */ }

      throw new UnrecoverableError(`Duplicate dispatch prevented: already sent to provider.`);
    }

    // Atomic SET NX lock to prevent TOCTOU concurrent double dispatch
    const dispatchLockKey = `order:dispatch_lock:${order.id}`;
    const acquiredLock = await connection.set(dispatchLockKey, '1', 'EX', 120, 'NX');
    if (!acquiredLock) {
      log.warn(`[OrderProcessor] Concurrent dispatch lock active for order ${order.id}. Skipping duplicate.`);
      return { order: null, redisKey: '' };
    }

    return { order, redisKey };
  }
}
