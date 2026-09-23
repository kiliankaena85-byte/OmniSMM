import { db } from '@/lib/db';
import { providerService } from '@/services/providers/provider.service';
import { RefundPolicyService } from '@/services/financial/refund-policy.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { runSerializableTransaction } from '@/lib/transactions';
import { WalletOps } from '@/services/financial/wallet-ops';

export class OrderProviderSyncService {
  /**
   * Sync single order status directly from upstream provider.
   */
  static async syncOrderStatusWithProvider(
    orderId: string,
    admin?: { id: string; email: string; tenantId?: string }
  ) {
    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { provider: true, service: true, user: true },
    });

    if (!order.provider || !order.externalId) {
      throw new Error(`У заказа #${order.numericId} отсутствует внешний ID провайдера.`);
    }

    const providerInstance = await providerService.getProviderInstance(order.provider);
    const statusResult = await providerInstance.getOrderStatus(order.externalId);
    if (!statusResult || typeof statusResult !== 'object' || !statusResult.status) {
      throw new Error(`Провайдер вернул некорректный ответ: ${JSON.stringify(statusResult)}`);
    }

    const rawStatus = String(statusResult.status).toLowerCase();
    let targetStatus: 'COMPLETED' | 'CANCELED' | 'PARTIAL' | 'IN_PROGRESS' | null = null;
    if (['completed', 'complete', 'success'].includes(rawStatus)) targetStatus = 'COMPLETED';
    else if (['canceled', 'cancelled', 'cancel'].includes(rawStatus)) targetStatus = 'CANCELED';
    else if (['partial', 'partially completed'].includes(rawStatus)) targetStatus = 'PARTIAL';
    else if (['processing', 'in progress', 'in_progress', 'pending'].includes(rawStatus)) targetStatus = 'IN_PROGRESS';

    const remainsNum = statusResult.remains !== undefined ? parseInt(String(statusResult.remains), 10) : undefined;
    const startCountNum = statusResult.start_count !== undefined ? parseInt(String(statusResult.start_count), 10) : undefined;

    let updatedStatus = order.status;
    let message = `Статус у провайдера: ${statusResult.status}`;

    if (targetStatus === 'CANCELED') {
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELED', remains: order.quantity, error: statusResult.error || 'Провайдер подтвердил отмену заказа' },
        });
        await RefundPolicyService.processRefund(
          { id: order.id, userId: order.userId, charge: Number(order.charge), quantity: order.quantity, remains: order.quantity, status: 'CANCELED', tenantId: order.tenantId },
          'Возврат: отмена подтверждена провайдером', tx
        );
      });
      updatedStatus = 'CANCELED';
      message = `Провайдер подтвердил отмену заказа #${order.numericId}. Средства возвращены клиенту.`;
    } else if (targetStatus === 'PARTIAL') {
      const rawRemains = (remainsNum !== undefined && !isNaN(remainsNum) && remainsNum > 0) ? remainsNum : 0;
      const safeRemains = Math.min(order.quantity, Math.max(0, rawRemains));
      await db.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PARTIAL', remains: safeRemains, startCount: startCountNum !== undefined && !isNaN(startCountNum) ? startCountNum : undefined },
        });
        await RefundPolicyService.processRefund(
          { id: order.id, userId: order.userId, charge: Number(order.charge), quantity: order.quantity, remains: safeRemains, status: 'PARTIAL', tenantId: order.tenantId },
          'Возврат за недовыполненную часть заказа', tx
        );
      });
      updatedStatus = 'PARTIAL';
      message = `Провайдер выполнил заказ #${order.numericId} частично (остаток: ${safeRemains}). Возврат оформлен.`;
    } else if (targetStatus === 'COMPLETED') {
      await db.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED', remains: 0, startCount: startCountNum !== undefined && !isNaN(startCountNum) ? startCountNum : undefined },
      });
      updatedStatus = 'COMPLETED';
      message = `Провайдер завершил выполнение заказа #${order.numericId}.`;
    } else {
      const safeProgressRemains = (remainsNum !== undefined && !isNaN(remainsNum)) ? Math.min(order.quantity, Math.max(0, remainsNum)) : undefined;
      await db.order.update({
        where: { id: order.id },
        data: { remains: safeProgressRemains, startCount: startCountNum !== undefined && !isNaN(startCountNum) ? startCountNum : undefined },
      });
      message = order.status === 'CANCELING'
        ? `Заказ #${order.numericId} всё ещё отменяется. Провайдер сообщает статус: ${statusResult.status}. Средства на эскроу-холде.`
        : `Статус заказа #${order.numericId} у провайдера: ${statusResult.status}.`;
    }

    if (admin) {
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'ORDER_SYNC_PROVIDER',
        target: orderId,
        targetType: 'ORDER',
        oldValue: { status: order.status },
        newValue: { status: updatedStatus, providerStatus: statusResult.status, description: message },
      });
    }

    return { status: updatedStatus, providerStatus: statusResult.status, message };
  }

  /**
   * Restart a failed/error order by resetting it to PENDING.
   */
  static async restartOrder(orderId: string, admin: { id: string; email: string; tenantId?: string }) {
    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { user: true },
      });

      if (order.status !== 'ERROR' && order.status !== 'PENDING_CHECK' && order.status !== 'CANCELED') {
        throw new Error(`Order ${order.numericId} cannot be restarted (status: ${order.status}). Используйте "Дублировать заказ".`);
      }

      if (order.status === 'ERROR' || order.status === 'CANCELED') {
        await WalletOps.charge(tx, order.userId, Number(order.charge),
          `Перезапуск заказа #${order.numericId} администратором - Повторное списание`,
          { adminId: admin.id, idempotencyKey: `restart-charge-${order.id}-${order.updatedAt.getTime()}` }
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PENDING', error: null, retryCount: 0, externalId: null, actualProviderCost: null, realMarginDelta: null },
      });

      return { orderNumericId: order.numericId, oldStatus: order.status, oldError: order.error, charge: order.charge };
    });

    try {
      const { ordersQueue, getRedisConnection } = await import('@/lib/queue-manager');
      const connection = getRedisConnection();
      await connection.del(`order:dispatched:${orderId}`);
      const jobId = `dispatch-${orderId}-${Date.now()}`;
      await ordersQueue.add('order-dispatch', { orderId }, { jobId });
    } catch (queueErr) {
      console.error(`[AdminOrderService] Failed to enqueue restarted order ${orderId}:`, queueErr);
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_RESTART',
      target: orderId,
      targetType: 'ORDER',
      oldValue: { status: result.oldStatus, error: result.oldError },
      newValue: { status: 'PENDING', reChargeCents: result.oldStatus === 'PENDING_CHECK' ? 0 : result.charge },
    });

    return { orderNumericId: result.orderNumericId };
  }
}
