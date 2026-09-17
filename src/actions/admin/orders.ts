'use server';

/**
 * Order Management Actions
 * Unified from orders.ts and orders-extended.ts
 *
 * Security: requireStaffPermission('orders', 'edit', ...)
 * Financial operations: Serializable isolation + calculatePartialRefund utility.
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { runSerializableTransaction } from '@/lib/transactions';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { calculatePartialRefund } from '@/utils/refund';
import { adminOrderService } from '@/services/admin/order.service';
import { WalletOps } from '@/services/financial/wallet-ops';
import { orderIdSchema } from '@/validators/admin.validators';
import { ordersQueue } from '@/lib/queue-manager';
import { redis } from '@/lib/redis';
import { SettingsManager } from '@/lib/settings';
import { CompensationService } from '@/services/financial/compensation.service';

/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

// ── Types & Schemas ──

const ALLOWED_MANUAL_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'] as const;
type OrderStatus = typeof ALLOWED_MANUAL_STATUSES[number];

const setStatusSchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(ALLOWED_MANUAL_STATUSES),
  remains: z.number().int().min(0).optional(),
});

const bulkCancelSchema = z.object({
  orderIds: z.array(z.string().min(1)).max(500),
});

// ── Single Order Actions ──

export async function cancelOrderAction(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing orderId' };
    const { orderId } = parsed.data;

    await adminOrderService.cancelOrder(orderId, {
      id: admin.id,
      email: admin.email,
    });

    // SD-13 SECURITY FIX: Await audit for financial operations to guarantee non-repudiation
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_CANCEL',
      target: orderId,
      targetType: 'ORDER',
    });

    revalidatePath('/admin/orders');
    return { success: true as const };
  });
}

export async function restartOrderAction(formData: FormData) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = orderIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing orderId' };
    const { orderId } = parsed.data;

    await adminOrderService.restartOrder(orderId, {
      id: admin.id,
      email: admin.email,
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_RESTART',
      target: orderId,
      targetType: 'ORDER',
    });

    revalidatePath('/admin/orders');
    return { success: true as const };
  });
}

/**
 * Manual status override with audit and partial refund logic.
 */
export async function setOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  remains?: number
) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = setStatusSchema.safeParse({ orderId, status, remains });
    if (!parsed.success) throw new Error(parsed.error.errors[0].message);
    const { orderId: validatedOrderId, status: validatedStatus, remains: validatedRemains } = parsed.data;

    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: validatedOrderId },
        include: { user: { select: { id: true, balance: true } } },
      });

      const oldStatus = order.status;
      const newStatus = validatedStatus;

      if (oldStatus === newStatus) {
        return { oldStatus, refundCents: 0, numericId: order.numericId };
      }

      const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
        AWAITING_PAYMENT: ['PENDING', 'CANCELED', 'ERROR'],
        PENDING: ['IN_PROGRESS', 'CANCELED', 'ERROR', 'COMPLETED'],
        PENDING_CHECK: ['PENDING', 'IN_PROGRESS', 'CANCELED', 'ERROR'],
        IN_PROGRESS: ['COMPLETED', 'PARTIAL', 'CANCELED', 'ERROR'],
        PARTIAL: ['COMPLETED', 'CANCELED'],
        COMPLETED: ['PARTIAL', 'CANCELED'],
        CANCELED: [],
        ERROR: ['CANCELED'],
      };

      const allowedNextStatuses = VALID_STATUS_TRANSITIONS[oldStatus] || [];
      if (!allowedNextStatuses.includes(newStatus)) {
        throw new Error(`Переход заказа из статуса "${oldStatus}" в "${newStatus}" не допускается бизнес-логикой`);
      }

      // Защита от "пустых" завершений (Provider ID Constraint)
      if (['COMPLETED', 'PARTIAL', 'IN_PROGRESS'].includes(newStatus)) {
        if (order.providerId !== null && !order.externalId) {
          throw new Error(`Заказ привязан к провайдеру, но ещё не был ему отправлен (отсутствует ID провайдера). Перевод в статус "Выполнен" невозможен. Дождитесь отправки провайдеру или выполните отмену заказа.`);
        }
      }

      let calculatedRefundCents = 0;

      if (['CANCELED', 'ERROR'].includes(newStatus)) {
        if (oldStatus === 'AWAITING_PAYMENT') {
          calculatedRefundCents = 0;
        } else if (['PENDING', 'PENDING_CHECK'].includes(oldStatus)) {
          calculatedRefundCents = Number(order.charge);
        } else {
          const refundRemains = (oldStatus === 'COMPLETED' && validatedRemains === undefined) ? order.quantity : (validatedRemains ?? order.remains);
          calculatedRefundCents = calculatePartialRefund({ ...order, remains: refundRemains });
        }
      } else if (newStatus === 'PARTIAL') {
        if (oldStatus === 'AWAITING_PAYMENT') {
          calculatedRefundCents = 0;
        } else {
          const refundRemains = validatedRemains ?? order.remains;
          calculatedRefundCents = calculatePartialRefund({ ...order, remains: refundRemains });
        }
      }

      // Ledger Delta Check (Anti-Double-Refund Guard)
      let refundCents = 0;
      if (calculatedRefundCents > 0) {
        const previousRefunds = await tx.ledgerEntry.aggregate({
          where: {
            userId: order.userId,
            idempotencyKey: { startsWith: `refund_${order.id}_` },
            status: 'APPROVED',
          },
          _sum: { amount: true },
        });
        const alreadyRefunded = Number(previousRefunds._sum.amount || 0);
        refundCents = Math.max(0, calculatedRefundCents - alreadyRefunded);
      }

      const newRemains = validatedRemains ?? order.remains;

      await tx.order.update({
        where: { id: validatedOrderId },
        data: {
          status: newStatus,
          remains: newRemains,
          ...(newStatus === 'COMPLETED' ? { remains: 0 } : {}),
        },
      });

      // Лояльность (Loyalty Sync)
      const { LoyaltyService } = await import('@/services/users/loyalty.service');
      if (['CANCELED', 'ERROR'].includes(newStatus)) {
        await LoyaltyService.reverseCommission(tx, order.id);
      } else if (newStatus === 'COMPLETED') {
        await LoyaltyService.confirmCommission(tx, order.id);
      } else if (newStatus === 'PARTIAL') {
        await LoyaltyService.handlePartialCommission(tx, order.id, newRemains, order.quantity);
      }

      if (refundCents > 0) {
        await WalletOps.refund(tx, order.userId, refundCents,
          `Ручная смена статуса заказа #${order.numericId}: ${oldStatus}→${newStatus}`,
          { adminId: admin.id, idempotencyKey: `refund_${order.id}_${newStatus}_${Date.now()}` }
        );
      }

      return { oldStatus, refundCents, numericId: order.numericId };
    });

    // SD-13 SECURITY FIX: Await audit for refund-bearing status override
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_STATUS_OVERRIDE',
      target: validatedOrderId,
      targetType: 'ORDER',
      oldValue: { status: result.oldStatus },
      newValue: { status: validatedStatus, remains: validatedRemains, refund: result.refundCents },
    });

    revalidatePath('/admin/orders');
    CompensationService.trackCompensation(validatedOrderId).catch(err => console.error('[AdminOrders] Failed to track compensation', err));
    return { success: true as const, refundCents: result.refundCents, numericId: result.numericId };
  });
}


/**
 * Force COMPLETE: moves order to COMPLETED status and refunds for undelivered quantity.
 */
export async function forceCompleteOrderAction(orderId: string) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      if (['COMPLETED', 'CANCELED', 'ERROR', 'PARTIAL'].includes(order.status)) {
        throw new Error('Order is already in a terminal state');
      }

      // Защита от "пустых" завершений (Provider ID Constraint)
      if (order.providerId !== null && !order.externalId) {
        throw new Error(`Заказ привязан к провайдеру, но ещё не был ему отправлен (отсутствует ID провайдера). Перевод в статус "Выполнен" невозможен. Дождитесь отправки провайдеру или выполните отмену заказа.`);
      }

      // CRITICAL FIX: Unpaid orders in AWAITING_PAYMENT must never generate refunds
      const refundCents = order.status === 'AWAITING_PAYMENT' ? 0 : calculatePartialRefund(order);

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'COMPLETED',
          remains: 0,
        },
      });

      // Лояльность (Loyalty Sync)
      const { LoyaltyService } = await import('@/services/users/loyalty.service');
      await LoyaltyService.confirmCommission(tx, order.id);

      if (refundCents > 0) {
        await WalletOps.refund(tx, order.userId, refundCents,
          `Force Complete #${order.numericId} with partial refund`,
          { adminId: admin.id, idempotencyKey: `refund_${order.id}_FORCE_COMPLETE` }
        );
      }

      return { numericId: order.numericId, refundCents };
    });

    // SD-13 SECURITY FIX: Await audit for force complete with potential refund
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_FORCE_COMPLETE',
      target: orderId,
      targetType: 'ORDER',
      newValue: { refund: result.refundCents },
    });

    CompensationService.trackCompensation(orderId).catch(err => console.error('[Orders] Failed to track compensation', err));

    revalidatePath('/admin/orders');
    return { success: true as const, refundCents: result.refundCents, numericId: result.numericId };
  });
}

// ── Bulk Actions ──

export async function bulkCancelOrdersAction(
  orderIds: string[],
  reason?: string,
  ticketId?: string
) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const parsed = bulkCancelSchema.safeParse({ orderIds });
    if (!parsed.success) return { success: false as const, error: 'Invalid IDs or too many items' };

    // Hard ceiling: max 100 items per execution batch
    const BATCH_LIMIT = 100;
    const targetIds = parsed.data.orderIds.slice(0, BATCH_LIMIT);
    const skippedCount = parsed.data.orderIds.length - targetIds.length;

    const orders = await db.order.findMany({
      where: { id: { in: targetIds }, tenantId: admin.tenantId ?? 'smmplan' },
      select: { id: true, userId: true, numericId: true, status: true, charge: true, quantity: true, remains: true, providerCost: true }
    });

    if (orders.length === 0) {
      return { success: false as const, error: 'Заказы не найдены' };
    }

    // RBAC & Anti-Sabotage Policy:
    // OWNER & ADMIN can bulk-cancel across all clients.
    // SUPPORT can bulk-cancel orders for single client or batch-cancel ERROR orders with audit log.
    if (admin.role === 'SUPPORT') {
      const distinctUserIds = new Set(orders.map(o => o.userId));
      const hasNonError = orders.some(o => o.status !== 'ERROR' && o.status !== 'PENDING_CHECK');
      if (distinctUserIds.size > 1 && hasNonError) {
        return {
          success: false as const,
          error: 'Запрещено массовое действие: саппорт может массово отменять активные заказы только по одному конкретному клиенту'
        };
      }
    } else if (!['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT'].includes(admin.role)) {
      return {
        success: false as const,
        error: 'Недостаточно прав для массовой отмены заказов'
      };
    }

    let totalRefunded = 0;
    let count = 0;

    for (const order of orders) {
      if (!['CANCELED'].includes(order.status)) { // Allow COMPLETED
        try {
          await runSerializableTransaction(async (tx) => {
            const safeOrder = await tx.order.findFirst({
              where: { id: order.id, tenantId: admin.tenantId ?? 'smmplan' }
            });
            
            if (!safeOrder || ['CANCELED'].includes(safeOrder.status)) return; // Allow COMPLETED

            let calculatedRefundCents = 0;
            if (safeOrder.status === 'AWAITING_PAYMENT') {
              calculatedRefundCents = 0;
            } else if (['PENDING', 'PENDING_CHECK'].includes(safeOrder.status)) {
              calculatedRefundCents = Number(safeOrder.charge);
            } else if (['IN_PROGRESS', 'PARTIAL', 'COMPLETED'].includes(safeOrder.status)) {
              const refundRemains = safeOrder.status === 'COMPLETED' ? safeOrder.quantity : safeOrder.remains;
              calculatedRefundCents = calculatePartialRefund({ ...safeOrder, remains: refundRemains });
            }

            let refundCents = 0;
            if (calculatedRefundCents > 0) {
              const previousRefunds = await tx.ledgerEntry.aggregate({
                where: { userId: safeOrder.userId, idempotencyKey: { startsWith: `refund_${safeOrder.id}_` }, status: 'APPROVED' },
                _sum: { amount: true },
              });
              refundCents = Math.max(0, calculatedRefundCents - Number(previousRefunds._sum.amount || 0));
            }

            await tx.order.update({
              where: { id: safeOrder.id },
              data: { status: 'CANCELED' },
            });

            const { LoyaltyService } = await import('@/services/users/loyalty.service');
            await LoyaltyService.reverseCommission(tx, safeOrder.id);

            if (refundCents > 0) {
              await WalletOps.refund(tx, safeOrder.userId, refundCents,
                `Массовая отмена заказа #${safeOrder.numericId}${reason ? ` (${reason})` : ''}`,
                { adminId: admin.id, idempotencyKey: `refund_${safeOrder.id}_CANCELED_${Date.now()}` }
              );
            }
            totalRefunded += refundCents;
            count++;
          });

          CompensationService.trackCompensation(order.id).catch(err => console.error('[Orders] Failed to track compensation', err));
        } catch (e) {
          console.error(`[bulkCancelOrdersAction] Failed to cancel order ${order.id}:`, e);
        }
      }
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_BULK_CANCEL',
      target: 'batch',
      targetType: 'ORDER',
      newValue: { count, totalRefunded, skippedCount, reason, ticketId },
    });

    revalidatePath('/admin/orders');
    return { 
      success: true as const, 
      cancelledCount: count,
      skippedCount,
      totalRefundCents: totalRefunded 
    };
  });
}

export async function bulkRestartOrdersAction(orderIds: string[]) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const BATCH_LIMIT = 100;
    const targetIds = orderIds.slice(0, BATCH_LIMIT);

    const orders = await db.order.findMany({
      where: {
        id: { in: targetIds },
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      }
    });

    let restartedCount = 0;
    for (const order of orders) {
      if (['ERROR', 'PENDING'].includes(order.status)) {
        try {
          await adminOrderService.restartOrder(order.id, {
            id: admin.id,
            email: admin.email,
          });
          restartedCount++;
        } catch (e) {
          console.error(`[bulkRestartOrdersAction] Error restarting order ${order.id}:`, e);
        }
      }
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_BULK_RESTART',
      target: 'batch',
      targetType: 'ORDER',
      newValue: { count: restartedCount }
    });

    revalidatePath('/admin/orders');
    return { success: true as const, restartedCount };
  });
}

// ── Manual Failover Actions ──

export async function getFailoverPreview(orderId: string) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const order = await db.order.findFirst({
      where: { id: orderId, tenantId: admin.tenantId ?? 'smmplan' },
      include: {
        service: {
          include: {
            routes: {
              where: { isActive: true },
              include: { provider: true }
            }
          }
        },
        user: { select: { balance: true } }
      }
    });

    if (!order) throw new Error('Order not found');
    if (!['ERROR', 'CANCELED', 'PENDING_CHECK'].includes(order.status)) {
      throw new Error('Заказ должен быть в статусе ERROR, PENDING_CHECK или CANCELED для перезапуска');
    }

    const usdToRub = await SettingsManager.getExchangeRateUSD();
    const availableRoutes = order.service.routes.filter(
      r => r.providerId !== order.providerId
    );

    const shadowConditions = availableRoutes
      .filter(r => r.providerId && r.providerServiceId)
      .map(r => ({ providerId: r.providerId, externalId: String(r.providerServiceId) }));

    const allShadowSvcs = shadowConditions.length > 0 ? await db.shadowService.findMany({
      where: { OR: shadowConditions }
    }) : [];

    const shadowMap = new Map<string, typeof allShadowSvcs[0]>();
    for (const s of allShadowSvcs) {
      shadowMap.set(`${s.providerId}_${s.externalId}`, s);
    }

    const routesWithPreview = availableRoutes.map((route) => {
      const shadowSvc = shadowMap.get(`${route.providerId}_${String(route.providerServiceId)}`);
      
      const hasValidPrice = !!shadowSvc && Number.isFinite(shadowSvc.rate) && shadowSvc.rate > 0;
      if (!hasValidPrice) {
        return {
          routeId: route.id,
          providerName: route.provider.name,
          priceUnknown: true,
          newCostCents: null,
          marginCents: null,
          marginPercent: null,
          isMarginPositive: false
        };
      }

      const exchangeRate = route.provider.balanceCurrency === 'RUB' ? 1.0 : usdToRub;
      const newCostCents = BigInt(Math.round(shadowSvc.rate * exchangeRate * 100));
      const chargeCents = BigInt(order.charge);
      const marginCents = chargeCents - newCostCents;
      const marginPercent = chargeCents > BigInt(0)
        ? Number((marginCents * BigInt(100)) / chargeCents)
        : 0;

      return {
        routeId: route.id,
        providerName: route.provider.name,
        priceUnknown: false,
        newCostCents: Number(newCostCents),
        marginCents: Number(marginCents),
        marginPercent,
        isMarginPositive: marginCents > BigInt(0)
      };
    });

    return {
      success: true,
      clientPaidCents: Number(order.charge),
      currentBalance: Number(order.user.balance),
      routes: routesWithPreview
    };
  });
}

export async function manualRerouteOrder(orderId: string, newRouteId: string, acknowledgeBlindReroute = false) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId: admin.tenantId ?? 'smmplan' },
        select: { id: true, numericId: true, status: true, charge: true, userId: true, serviceId: true, providerId: true }
      });

      if (!order) throw new Error('Order not found');
      if (!['ERROR', 'CANCELED', 'PENDING_CHECK'].includes(order.status)) {
        throw new Error('Заказ уже обрабатывается');
      }

      const newRoute = await tx.serviceRoute.findFirst({
        where: { id: newRouteId, serviceId: order.serviceId, isActive: true },
        include: { provider: true }
      });

      if (!newRoute) throw new Error('Маршрут не найден или не активен');
      if (newRoute.providerId === order.providerId) {
        throw new Error('Выбран тот же самый провайдер');
      }

      const shadowSvc = await tx.shadowService.findUnique({
        where: {
          providerId_externalId: {
            providerId: newRoute.providerId,
            externalId: String(newRoute.providerServiceId)
          }
        }
      });

      const isPriceUnknown = !shadowSvc || !Number.isFinite(shadowSvc.rate) || shadowSvc.rate <= 0;
      if (isPriceUnknown && !acknowledgeBlindReroute) {
        throw new Error('Цена провайдера неизвестна. Синхронизируйте каталог или подтвердите reroute вслепую.');
      }

      const user = await tx.user.findUnique({
        where: { id: order.userId },
        select: { balance: true }
      });

      if (!user) throw new Error('User not found');
      if (user.balance < order.charge) {
        throw new Error(`Недостаточно средств: баланс ${(Number(user.balance)/100).toFixed(2)} ₽, требуется ${(Number(order.charge)/100).toFixed(2)} ₽`);
      }

      const usdToRub = await SettingsManager.getExchangeRateUSD();
      const exchangeRate = newRoute.provider.balanceCurrency === 'RUB' ? 1.0 : usdToRub;
      const providerRate = shadowSvc ? shadowSvc.rate : 0.0;
      const newProviderCostCents = Math.round(providerRate * exchangeRate * 100);

      // Списание с баланса (перезапуск за счет пользователя, т.к. при ERROR/CANCELED был refund) via WalletOps
      const idempotencyKey = `reroute_${orderId}_${newRouteId}`;
      await WalletOps.charge(tx, order.userId, Number(order.charge), `MANUAL_REROUTE: Order #${order.numericId}`, {
        idempotencyKey,
        adminId: admin.id
      });

      // Обновление заказа
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PENDING',
          providerId: newRoute.providerId,
          providerServiceId: newRoute.providerServiceId,
          providerCost: newProviderCostCents,
          externalId: null,
          error: null,
          retryCount: 0
        }
      });

      // Лог маршрутизации
      await tx.routingAuditLog.create({
        data: {
          serviceId: order.serviceId,
          action: isPriceUnknown ? 'BLIND_REROUTE' : 'MANUAL_OVERRIDE',
          fromProviderId: order.providerId,
          toProviderId: newRoute.providerId,
          reason: `Admin ${admin.email} triggered manual failover ${isPriceUnknown ? '(BLIND REROUTE)' : ''}`
        }
      });

      return { numericId: order.numericId, newProviderId: newRoute.providerId };
    });

    // После транзакции — отправка в BullMQ
    // Clear duplicate dispatch mutex and ensure unique BullMQ jobId with timestamp
    await redis.del(`order:dispatched:${orderId}`).catch(() => {});
    const jobId = `dispatch-${orderId}-${Date.now()}`;
    await ordersQueue.add('order-dispatch', { orderId }, { jobId });

    // Запись аудита администратора
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'MANUAL_REROUTE',
      target: orderId,
      targetType: 'ORDER',
      newValue: { newProviderId: result.newProviderId }
    });

    revalidatePath('/admin/orders');
    return { success: true as const, numericId: result.numericId };
  });
}

export async function getOrderDetailsAction(orderId: string) {
  return requireStaffPermission('orders', 'view', async (admin) => {
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      },
      include: {
        user: { select: { email: true } },
        provider: { select: { name: true } },
        payment: { select: { id: true, gatewayId: true, gateway: true } },
        service: {
          select: {
            name: true,
            etaP50Seconds: true,
            etaP90Seconds: true,
            etaSampleCount: true,
            etaSpeedClass: true,
            etaUpdatedAt: true,
            category: {
              select: {
                name: true,
                network: { select: { name: true } }
              }
            }
          }
        }
      }
    });
    if (!order) return null;
    return {
      id: order.id,
      numericId: order.numericId,
      externalId: order.externalId ?? null,
      link: order.link,
      quantity: order.quantity,
      remains: order.remains,
      status: order.status,
      charge: Number(order.charge),
      providerCost: Number(order.providerCost ?? 0),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      isDripFeed: order.isDripFeed,
      dripExternalIds: order.dripExternalIds,
      runs: order.runs ?? null,
      interval: order.interval ?? null,
      currentRun: order.currentRun,
      error: order.error ?? null,
      tenantId: order.tenantId,
      environmentMode: order.environmentMode,
      isTest: order.isTest,
      payment: order.payment ? {
        id: order.payment.id,
        gatewayId: order.payment.gatewayId ?? null,
        gateway: order.payment.gateway,
      } : null,
      user: { email: order.user.email },
      providerName: order.provider?.name ?? null,
      service: {
        name: order.service.name,
        etaP50Seconds: order.service.etaP50Seconds,
        etaP90Seconds: order.service.etaP90Seconds,
        etaSampleCount: order.service.etaSampleCount,
        etaSpeedClass: order.service.etaSpeedClass,
        etaUpdatedAt: order.service.etaUpdatedAt ? order.service.etaUpdatedAt.toISOString() : null,
        category: {
          name: order.service.category.name,
          network: order.service.category.network ? { name: order.service.category.network.name } : null
        }
      }
    };
  });
}

export async function sendReorderOfferAction(orderId: string, customNote?: string) {
  return requireStaffPermission('orders', 'edit', async (admin) => {
    const order = await db.order.findFirst({
      where: {
        id: orderId,
        ...(admin.tenantId ? { tenantId: admin.tenantId } : {})
      },
      include: {
        user: { select: { id: true, email: true, balance: true } },
        service: { select: { id: true, name: true } }
      }
    });

    if (!order) {
      return { success: false as const, error: 'Заказ не найден' };
    }

    if (order.status !== 'CANCELED') {
      return { success: false as const, error: 'Предложение перезапуска доступно только для отменённых заказов' };
    }

    // Find or create active support ticket with customer
    let ticket = await db.ticket.findFirst({
      where: {
        userId: order.userId,
        status: { in: ['OPEN', 'PENDING'] },
        ...(order.tenantId ? { tenantId: order.tenantId } : (admin.tenantId ? { tenantId: admin.tenantId } : {}))
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!ticket) {
      ticket = await db.ticket.create({
        data: {
          userId: order.userId,
          subject: `Возобновление заказа #${order.numericId} («${order.service.name}»)`,
          status: 'OPEN',
          source: 'WEB',
          orderId: order.id,
          tenantId: order.tenantId ?? 'smmplan'
        }
      });
    }

    const formattedCost = (Number(order.charge) / 100).toFixed(2);
    const offerMessageText = `⚡ **Поставщик устранил сбой по услуге «${order.service.name}»!**\n\nМы можем автоматически перезапустить ваш отменённый заказ #${order.numericId} (${order.quantity} шт.) с вашего баланса (${formattedCost} ₽).\n\n${customNote ? `💬 Комментарий поддержки: ${customNote}\n\n` : ''}Для подтверждения нажмите кнопку подтверждения в личном кабинете или ответьте в этом диалоге.`;

    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        sender: 'STAFF',
        text: offerMessageText,
        orderId: order.id
      }
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_REORDER_OFFER_SENT',
      target: order.id,
      targetType: 'ORDER',
      newValue: { numericId: order.numericId, clientEmail: order.user.email, ticketId: ticket.id }
    });

    revalidatePath(`/admin/orders`);
    revalidatePath(`/admin/tickets`);
    return { 
      success: true as const, 
      ticketId: ticket.id, 
      message: `Предложение перезапуска отправлено клиенту в тикет #${ticket.id}` 
    };
  });
}



