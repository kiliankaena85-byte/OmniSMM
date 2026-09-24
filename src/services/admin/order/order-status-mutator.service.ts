import { db } from '@/lib/db';
import { calculatePartialRefund } from '@/utils/refund';
import { WalletOps } from '@/services/financial/wallet-ops';
import { runSerializableTransaction } from '@/lib/transactions';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { CompensationService } from '@/services/financial/compensation.service';
import { providerService } from '@/services/providers/provider.service';

export class OrderStatusMutatorService {
  /**
   * Cancel an order and refund the user's balance.
   * Partial refund: if order is IN_PROGRESS/PARTIAL with remains > 0,
   * refund only the undelivered portion.
   */
  static async cancelOrder(
    orderId: string,
    admin: { id: string; email: string; tenantId?: string },
    options?: { forceWriteOff?: boolean }
  ) {
    const orderBefore = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { provider: true, service: true },
    });

    if (['CANCELED', 'ERROR', 'PARTIAL'].includes(orderBefore.status)) {
      throw new Error(`Order ${orderBefore.numericId} is already in terminal state ${orderBefore.status} and cannot be canceled.`);
    }
    if (orderBefore.status === 'CANCELING') {
      throw new Error(`Заказ ${orderBefore.numericId} уже находится в процессе отмены у провайдера.`);
    }

    const hasExternalOrder = Boolean(orderBefore.externalId && orderBefore.externalId.trim().length > 0);

    if (hasExternalOrder) {
      if (!orderBefore.service.isCancelEnabled && !options?.forceWriteOff) {
        const caller = await db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { role: true } });
        const msg = caller.role === 'SUPPORT'
          ? `Отмена невозможна: услуга "${orderBefore.service.name}" не поддерживает отмену на стороне провайдера. Только Администратор или Владелец могут принудительно отменить этот заказ со списанием в убыток.`
          : `Услуга "${orderBefore.service.name}" не поддерживает автоматическую отмену на стороне провайдера. Вы можете запросить отмену у поддержки провайдера либо подтвердить принудительное списание в убыток компании.`;
        throw new Error(msg);
      }

      if (orderBefore.service.isCancelEnabled && !options?.forceWriteOff) {
        return this.initiateEscrowHold(orderId, orderBefore, admin);
      }
    }

    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { user: true, service: true },
      });

      let calculatedRefundCents = 0;
      if (order.status === 'AWAITING_PAYMENT') calculatedRefundCents = 0;
      else if (['PENDING', 'PENDING_CHECK'].includes(order.status)) calculatedRefundCents = Number(order.charge);
      else if (order.status === 'COMPLETED') calculatedRefundCents = calculatePartialRefund({ ...order, remains: order.quantity });
      else calculatedRefundCents = calculatePartialRefund(order);

      let refundCents = 0;
      if (calculatedRefundCents > 0) {
        const previousRefunds = await tx.ledgerEntry.aggregate({
          where: {
            userId: order.userId,
            idempotencyKey: { startsWith: `refund_${order.id}_` },
            status: 'APPROVED',
            ...(order.tenantId ? { tenantId: order.tenantId } : {}),
          },
          _sum: { amount: true },
        });
        refundCents = Math.max(0, calculatedRefundCents - Number(previousRefunds._sum.amount || 0));
      }

      await tx.order.update({ where: { id: orderId }, data: { status: 'CANCELED' } });

      // Cascade cancel associated SmartCampaign and pending SmartTasks
      const campaigns = await tx.smartCampaign.findMany({
        where: { orderId, status: { in: ['PLANNED', 'RUNNING', 'PAUSED'] } },
        select: { id: true },
      });
      for (const camp of campaigns) {
        await tx.smartCampaign.update({ where: { id: camp.id }, data: { status: 'ERROR' } });
        await tx.smartTask.updateMany({
          where: { campaignId: camp.id, status: 'PLANNED' },
          data: { status: 'ERROR', error: 'Заказ отменен администратором' },
        });
      }

      const { LoyaltyService } = await import('@/services/users/loyalty.service');
      await LoyaltyService.reverseCommission(tx, orderId);

      // Roll back promo code uses if it was never paid
      if (order.status === 'AWAITING_PAYMENT' && order.promoCodeId) {
        const count = order.paymentId ? await tx.order.count({
          where: {
            paymentId: order.paymentId,
            promoCodeId: order.promoCodeId,
            id: { not: order.id },
            status: 'AWAITING_PAYMENT',
            ...(order.tenantId ? { tenantId: order.tenantId } : {}),
          },
        }) : 0;

        if (count === 0) {
          await tx.promoCode.updateMany({
            where: { id: order.promoCodeId, uses: { gt: 0 }, ...(order.tenantId ? { tenantId: order.tenantId } : {}) },
            data: { uses: { decrement: 1 } },
          });
        }
      }

      if (refundCents > 0) {
        await WalletOps.refund(tx, order.userId, refundCents,
          `Отмена заказа ${order.numericId} администратором - Возврат средств`,
          { adminId: admin.id, idempotencyKey: `refund_${order.id}_CANCELED`, tenantId: order.tenantId }
        );
      }

      return { status: 'CANCELED', refundCents, orderNumericId: order.numericId, statusBefore: order.status, remainsBefore: order.remains };
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: options?.forceWriteOff ? 'ORDER_CANCEL_WRITE_OFF' : 'ORDER_CANCEL',
      target: orderId,
      targetType: 'ORDER',
      oldValue: { status: result.statusBefore, remains: result.remainsBefore },
      newValue: { status: 'CANCELED', refundCents: result.refundCents, isForceWriteOff: Boolean(options?.forceWriteOff) },
    });

    CompensationService.trackCompensation(orderId).catch((err) => console.error('[AdminOrderService] Failed to track compensation', err));
    return { status: 'CANCELED', refundCents: result.refundCents, orderNumericId: result.orderNumericId };
  }

  private static async initiateEscrowHold(
    orderId: string,
    orderBefore: any,
    admin: { id: string; email: string }
  ) {
    let parsedCustomData: Record<string, unknown> = {};
    if (orderBefore.customData) {
      try { parsedCustomData = JSON.parse(orderBefore.customData); } catch { parsedCustomData = {}; }
    }
    await db.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELING',
        customData: JSON.stringify({
          ...parsedCustomData,
          cancelRequestedAt: new Date().toISOString(),
          cancelRequestedBy: admin.id,
        }),
      },
    });

    if (orderBefore.provider) {
      try {
        const providerInstance = await providerService.getProviderInstance(orderBefore.provider);
        if (providerInstance.cancelOrder) await providerInstance.cancelOrder(orderBefore.externalId!);
      } catch (pErr) {
        console.warn(`[OrderService] Provider cancelOrder failed for ${orderId}:`, pErr);
      }
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_CANCEL_REQUESTED',
      target: orderId,
      targetType: 'ORDER',
      oldValue: { status: orderBefore.status },
      newValue: {
        status: 'CANCELING',
        externalId: orderBefore.externalId,
        description: `Запрос на отмену отправлен провайдеру (ID: ${orderBefore.externalId}). Средства на эскроу-холде.`,
      },
    });

    return {
      status: 'CANCELING',
      refundCents: 0,
      orderNumericId: orderBefore.numericId,
      statusBefore: orderBefore.status,
      remainsBefore: orderBefore.remains,
      requiresProviderConfirmation: true,
      message: 'Запрос на отмену отправлен поставщику. Средства удерживаются в эскроу до подтверждения отмены.',
    };
  }
}
