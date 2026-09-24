import { db } from '../../lib/db';
import { OrderStatus } from '@prisma/client';
import { SettingsProvider } from '../../lib/settings';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { WalletService } from '../financial/wallet.service';
import { WalletOps } from '../financial/wallet-ops';
import { calculatePartialRefund } from '@/utils/refund';
import { CompensationService } from '@/services/financial/compensation.service';
import { runSerializableTransaction } from '@/lib/transactions';

import { ordersQueue } from '@/lib/queue-manager';

/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

type CreateOrderInput = {
  serviceId: string;
  link: string;
  quantity: number;
  charge: number;       // totalCents
  providerCost: number; // providerCostCents 
  runs?: number;
  interval?: number;
  email?: string;
  isTestMode?: boolean;
  customData?: string;
  isLinkOverridden?: boolean;
};

class OrderService {
  /**
   * Fast secure path for Orders.
   * Atomically deducts balance via WalletService and dispatches to BullMQ.
   */
  async createOrder(userId: string, input: CreateOrderInput, idempotencyKey?: string): Promise<{ success: boolean; error?: string; orderId?: string }> {
    try {
      // 1. [FIN-005] Currency Circuit Breaker: Prevent orders if CBR sync is stale
      const settings = await SettingsProvider.get();
      if (settings.exchangeRateUpdatedAt) {
        const syncTime = new Date(settings.exchangeRateUpdatedAt).getTime();
        if (!isNaN(syncTime)) {
          const hoursSinceSync = (Date.now() - syncTime) / (1000 * 60 * 60);
          if (hoursSinceSync > 48) {
            throw new Error('SYSTEM_HALT: Currency exchange rate is older than 48 hours. Orders are temporarily suspended to prevent financial loss.');
          }
        }
      }

      const isDripFeed = input.runs ? input.runs > 1 : false;

      // 2. Atomic Charge & Creation (Prevents Ghost Deductions)
      const newOrder = await runSerializableTransaction(async (tx) => {
        // 2a. Fetch User tenant and validate service tenant isolation
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, tenantId: true }
        });

        if (!user) {
          throw new Error('USER_NOT_FOUND');
        }

        if (!user.tenantId) {
          throw new Error('USER_TENANT_MISSING');
        }

        const userTenantId = user.tenantId;

        const service = await tx.service.findUnique({
          where: { id: input.serviceId },
          select: {
            id: true,
            name: true,
            providerId: true,
            externalId: true,
            tenantId: true,
            targetType: true,
            isActive: true,
            minQty: true,
            maxQty: true,
            category: {
              select: { name: true, tenantId: true }
            }
          }
        });

        if (!service) {
          throw new Error('SERVICE_NOT_FOUND');
        }

        if (!service.tenantId) {
          throw new Error('SERVICE_TENANT_MISSING');
        }

        if (!service.isActive) {
          throw new Error('SERVICE_INACTIVE');
        }

        // 2a.1 Link-Service Domain Compatibility Check
        if (!input.isLinkOverridden) {
          const { isLinkServiceCompatible, getCompatibilityError, normalizeServiceTargetType } = await import('@/constants/link-service-compatibility');
          let detectedLinkType = 'generic_link';
          try {
            const { IntelligenceLinkAnalyzer } = await import('@/services/analyzer/link-analyzer');
            const analyzer = new IntelligenceLinkAnalyzer();
            const analysis = await analyzer.analyze(input.link.trim());
            detectedLinkType = analysis?.type || 'generic_link';
          } catch (e) {
            console.warn(`[OrderService] IntelligenceLinkAnalyzer error:`, e);
            detectedLinkType = 'generic_link';
          }
          const resolvedTargetType = service.targetType || (service.category?.name ? (await import('@/utils/target-type')).inferTargetTypeFromCategory(service.category.name) : 'POST');
          const serviceTargetType = normalizeServiceTargetType(resolvedTargetType);

          if (!isLinkServiceCompatible(detectedLinkType, serviceTargetType)) {
            const errorMsg = getCompatibilityError(detectedLinkType, serviceTargetType, service.name);
            throw new Error(`LINK_SERVICE_MISMATCH: ${errorMsg}`);
          }
        }

        const serviceTenantId = service.tenantId;
        if (serviceTenantId !== userTenantId) {
          // [R1-P0-01] Persist SecurityEvent via tx to eliminate connection pool leak
          try {
            await tx.securityEvent.create({
              data: {
                event: 'CROSS_TENANT_ORDER_ATTEMPT',
                severity: 'CRITICAL',
                details: {
                  userId,
                  userTenantId,
                  serviceId: input.serviceId,
                  serviceTenantId,
                  charge: input.charge
                }
              }
            });
          } catch (err) {
            console.error('[SecurityEvent] failed to persist:', err);
          }

          // REMEDIATION HARDENING: Return normalized error to prevent tenant enumeration
          throw new Error('SERVICE_NOT_FOUND');
        }

        if (input.quantity < service.minQty || input.quantity > service.maxQty) {
          throw new Error(`QUANTITY_OUT_OF_BOUNDS: Allowed ${service.minQty}-${service.maxQty}`);
        }

        // 2b. Unconditionally attempt charge (Double spreading & Race condition protected)
        await WalletOps.charge(
          tx,
          userId, 
          input.charge, 
          `Order Creation (Service ID: ${input.serviceId})`,
          { idempotencyKey }
        );

        // 2c. Snapshot Routing (Filtered by active provider)
        const primaryRoute = await tx.serviceRoute.findFirst({
          where: {
            serviceId: input.serviceId,
            isPrimary: true,
            isActive: true,
            provider: {
              isActive: true
            }
          },
          select: {
            providerId: true,
            providerServiceId: true,
          },
        });

        const resolvedProviderId = primaryRoute?.providerId ?? service?.providerId;
        const resolvedExternalId = primaryRoute?.providerServiceId ?? service?.externalId;

        // 2d. Create Order in DB
        const createdOrder = await tx.order.create({
          data: {
            userId,
            tenantId: userTenantId,
            serviceId: input.serviceId,
            providerId: resolvedProviderId,
            providerServiceId: resolvedExternalId,
            link: input.link,
            isLinkOverridden: input.isLinkOverridden || false,
            quantity: input.quantity,
            status: 'PENDING',
            charge: input.charge,
            providerCost: input.providerCost,
            remains: input.quantity,
            runs: input.runs,
            interval: input.interval,
            isDripFeed,
            currentRun: 0,
            nextRunAt: isDripFeed ? new Date() : null,
            email: input.email?.toLowerCase(),
            isTest: input.isTestMode || false,
            customData: input.customData,
          }
        });

        // 2e. Award pending commission based on Margin
        const margin = input.charge - input.providerCost;
        if (margin > 0) {
          const { LoyaltyService } = await import('../users/loyalty.service');
          await LoyaltyService.awardCommission(tx, userId, margin, createdOrder.id);
        }

        return createdOrder;
      });

      // 3. Dispatch to Queues (Drip-feed is now passed natively to the provider)
      try {
        await ordersQueue.add('order-dispatch', { orderId: newOrder.id, tenantId: newOrder.tenantId }, { jobId: `dispatch-${newOrder.id}`, delay: 3 * 60 * 1000 });
      } catch (queueError: unknown) {
        // [FIN-006] Premortem Bugfix: Ghost Order Prevention.
        // If Redis is down, we MUST NOT fail the request since the balance is already charged 
        // and the DB order is committed. Returning 500 would make the user retry and get double charged.
        // The sweep-orphans cron job will pick up this PENDING order later.
        console.error('[OrderService] Non-fatal queue dispatch error:', (queueError instanceof Error ? queueError.message : String(queueError)));
      }

      // 4. Return success instantly to User Interface. No delays!
      // Email Notification (Fire and Forget)
      import('../../lib/smtp').then(({ sendOrderBalanceDebitMail }) => {
        db.user.findUnique({ where: { id: userId }, select: { email: true, balance: true, tenantId: true } }).then(u => {
          if (u?.email) {
            db.service.findUnique({ where: { id: input.serviceId }, select: { name: true } }).then(s => {
              if (s?.name) {
                sendOrderBalanceDebitMail({
                  email: u.email,
                  orderId: newOrder.numericId.toString(),
                  serviceName: s.name,
                  chargedCents: input.charge,
                  remainingBalanceCents: u.balance,
                  tenantId: u.tenantId
                }).catch(console.error);
              }
            });
          }
        });
      });

      return { success: true, orderId: newOrder.id };

    } catch (e: unknown) {
      console.error('[OrderService] Creation failed:', (e instanceof Error ? e.message : String(e)));
      // We return (e instanceof Error ? e.message : String(e)) here so that WalletOps throw "Insufficient funds" bubbles up to UI
      return { success: false, error: (e instanceof Error ? e.message : String(e)) || 'Internal system error during order compilation.' };
    }
  }

  /**
   * Stage 2: Cooling-off Period Cancellation
   * Client-facing cancellation for PENDING orders to preserve revenue internally.
   */
  async cancelPendingOrderClient(orderId: string, userId: string, tenantId?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await runSerializableTransaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId }
        });

        if (!order || order.userId !== userId || (tenantId && order.tenantId !== tenantId)) {
          return { success: false, error: 'Заказ не найден или доступ ограничен' };
        }

        if (order.status !== 'PENDING' && order.status !== 'AWAITING_PAYMENT') {
          return { success: false, error: 'Заказ уже ушел в работу или отменен' };
        }

        const charge = order.charge; // totalCents
        const wasAwaitingPayment = order.status === 'AWAITING_PAYMENT';

        // 1. Cancel the order atomically
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            userId,
            ...(tenantId ? { tenantId } : {}),
            status: { in: ['PENDING', 'AWAITING_PAYMENT'] }
          },
          data: { status: 'CANCELED' }
        });

        if (updated.count === 0) {
          return { success: false, error: 'Заказ уже ушел в работу или отменен' };
        }

        // Cascade cancel associated SmartCampaign and pending SmartTasks
        const campaigns = await tx.smartCampaign.findMany({
          where: { orderId: order.id, status: { in: ['PLANNED', 'RUNNING', 'PAUSED'] } },
          select: { id: true }
        });
        for (const camp of campaigns) {
          await tx.smartCampaign.update({
            where: { id: camp.id },
            data: { status: 'ERROR' }
          });
          await tx.smartTask.updateMany({
            where: { campaignId: camp.id, status: 'PLANNED' },
            data: { status: 'ERROR', error: 'Заказ отменен клиентом' }
          });
        }

        // Handle Referral Commissions (Reverse since canceled)
        const { LoyaltyService } = await import('../users/loyalty.service');
        await LoyaltyService.reverseCommission(tx, order.id);

        // 2. Refund to User Balance (ONLY if it was paid)
        if (!wasAwaitingPayment) {
          const refundKey = `refund-client-cancel-${order.id}`;
          const existingLedger = await tx.ledgerEntry.findFirst({
             where: { idempotencyKey: refundKey, tenantId: order.tenantId }
          });

          if (!existingLedger) {
            await WalletOps.refund(tx, userId, Number(charge),
              `Отмена заказа #${order.numericId} клиентом (Store Credit)`,
              { idempotencyKey: refundKey, tenantId: order.tenantId }
            );
          }
        }

        // [R1-P0-02] Prepare email payload inside transaction, send AFTER commit
        const [targetUser, targetService] = await Promise.all([
          tx.user.findUnique({ where: { id: userId }, select: { email: true } }),
          tx.service.findUnique({ where: { id: order.serviceId }, select: { name: true } })
        ]);

        return {
          success: true,
          emailPayload: targetUser?.email && targetService?.name ? {
            email: targetUser.email,
            numericId: order.numericId.toString(),
            serviceName: targetService.name,
            tenantId: order.tenantId
          } : null
        };
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      if (result.emailPayload) {
        import('../../lib/smtp').then(({ sendOrderCanceledMail }) => {
          sendOrderCanceledMail(
            result.emailPayload!.email,
            result.emailPayload!.numericId,
            result.emailPayload!.serviceName,
            result.emailPayload!.tenantId
          ).catch(console.error);
        }).catch(console.error);
      }

      return { success: true };
    } catch (e: unknown) {
      console.error('[OrderService] cancelPendingOrderClient failed:', (e instanceof Error ? e.message : String(e)));
      return { success: false, error: 'Внутренняя ошибка при отмене заказа' };
    }
  }

  /**
   * Universal Status Updater (System Level).
   * Called by Webhooks or Sync Workers to update order state and handle refunds.
   * Ensures high consistency via transactions and ledger entries.
   */
  async processStatusUpdate(externalId: string, providerStatus: string, remains: number): Promise<{ success: boolean; orderId?: string; status?: string }> {
    try {
      // 1. Map Provider Status to Internal Status
      const statusMap: Record<string, string> = {
        'Pending':     'PENDING',
        'In progress': 'IN_PROGRESS',
        'In_progress': 'IN_PROGRESS',
        'Processing':  'IN_PROGRESS',
        'Completed':   'COMPLETED',
        'Partial':     'PARTIAL',
        'Canceled':    'CANCELED',
        'Cancelled':   'CANCELED',
        'Error':       'ERROR'
      };

      const internalStatus = (statusMap[providerStatus] || providerStatus?.toUpperCase()) as OrderStatus;

      if (!internalStatus || !Object.values(OrderStatus).includes(internalStatus)) {
        console.error(`[ORDER_SERVICE] Invalid status mapping: providerStatus "${providerStatus}" mapped to non-enum value "${internalStatus}"`);
        return { success: false };
      }

      // 2. Run Atomic Transaction
      return await runSerializableTransaction(async (tx) => {
        // tenant-isolation-ignore: Provider webhook updates order status by externalId across tenants
        const order = await tx.order.findFirst({
          where: { externalId },
          include: { user: true }
        });

        if (!order) return { success: false };

        // If status hasn't changed and remains are the same, skip to save DB I/O
        if (order.status === internalStatus && order.remains === remains) {
          return { success: true, orderId: order.id, status: order.status };
        }

        // If order was already terminal, do not revert it and do not re-process refunds (security gate)
        // Once a terminal state (COMPLETED, CANCELED, PARTIAL, ERROR) is reached, we only allow updating remains for record keeping.
        if (['COMPLETED', 'CANCELED', 'PARTIAL', 'ERROR'].includes(order.status)) {
           if (order.remains !== remains) {
              await tx.order.update({
                where: { id: order.id },
                data: { remains: Math.max(0, remains) }
              });
           }
           return { success: true, orderId: order.id, status: order.status };
        }

        let refundCents = 0;
        
        // 3. Calculate Refund if status is terminal and non-complete
        // We only refund if transition is TO a terminal state FROM a non-terminal state
        if (internalStatus === 'PARTIAL' || internalStatus === 'CANCELED') {
           if (internalStatus === 'CANCELED' && (remains <= 0 || order.quantity <= 0)) {
              refundCents = Number(order.charge);
           } else {
              refundCents = calculatePartialRefund({ remains, quantity: order.quantity, charge: order.charge });
           }
        }


        // 4. Update Order
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: internalStatus,
            remains: Math.max(0, remains),
            updatedAt: new Date()
          }
        });

        // 4.5. Handle Referral Commissions
        const { LoyaltyService } = await import('../users/loyalty.service');
        if (internalStatus === 'COMPLETED') {
           await LoyaltyService.confirmCommission(tx, order.id);
        } else if (internalStatus === 'ERROR' || internalStatus === 'CANCELED') {
           await LoyaltyService.reverseCommission(tx, order.id);
        }

        // 5. Apply Refund if needed
        if (refundCents > 0) {
          // Use a deterministic idempotency key to prevent double-crediting
          const refundKey = `refund-order-${order.id}`;
          
          // Check if ledger entry with this key already exists
          const existingLedger = await tx.ledgerEntry.findFirst({
             where: { idempotencyKey: refundKey, tenantId: order.tenantId }
          });

          if (!existingLedger) {
            await WalletOps.refund(tx, order.userId, Number(refundCents),
              `Системный возврат за заказ #${order.numericId} (Статус: ${internalStatus}, Остаток: ${remains})`,
              { idempotencyKey: refundKey, tenantId: order.tenantId }
            );
          }
        }

        return { success: true, orderId: order.id, status: internalStatus };
      });

    } catch (e: unknown) {
      console.error(`[OrderService] processStatusUpdate failed for extId ${externalId}:`, (e instanceof Error ? e.message : String(e)));
      return { success: false };
    }
  }

  /**
   * Terminal Failure (DLQ).
   * Marks order as ERROR, refunds the full amount automatically.
   */
  async failOrderTerminal(orderId: string, reason: string, isRawReason: boolean = false): Promise<void> {
    try {
      const txResult = await runSerializableTransaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { user: true, service: true }
        });

        if (!order || ['COMPLETED', 'CANCELED', 'PARTIAL', 'ERROR', 'IN_PROGRESS'].includes(order.status)) {
          return null; // Already terminal or in progress
        }

        // Update status
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'ERROR', updatedAt: new Date() }
        });

        // Handle Referral Commissions (Reverse since error)
        const { LoyaltyService } = await import('../users/loyalty.service');
        await LoyaltyService.reverseCommission(tx, order.id);

        // Full Refund
        const refundKey = `refund-dlq-${order.id}`;
        const existingLedger = await tx.ledgerEntry.findFirst({
           where: { idempotencyKey: refundKey, tenantId: order.tenantId }
        });

        if (!existingLedger && order.charge > 0) {
          const finalReason = isRawReason 
            ? reason 
            : `Авто-возврат: Ошибка запуска (DLQ). Заказ #${order.numericId}. ${reason}`;

          await WalletOps.refund(tx, order.userId, Number(order.charge),
            finalReason,
            { idempotencyKey: refundKey, tenantId: order.tenantId }
          );
        }

        return {
          email: order.user?.email,
          numericId: order.numericId.toString(),
          serviceName: order.service?.name,
          tenantId: order.tenantId
        };
      });

      // Email Notification for Failed/Canceled
      if (txResult?.email && txResult?.serviceName) {
        try {
          const { sendOrderCanceledMail } = await import('../../lib/smtp');
          await sendOrderCanceledMail(txResult.email, txResult.numericId, txResult.serviceName, txResult.tenantId);
        } catch (mailErr: unknown) {
          console.error(`[OrderService] Failed to send cancellation email for ${orderId}:`, (mailErr instanceof Error ? mailErr.message : String(mailErr)));
        }
      }

      CompensationService.trackCompensation(orderId).catch(err => console.error('[OrderService] Failed to track compensation', err));
    } catch (e: unknown) {
      console.error(`[OrderService] failOrderTerminal failed for ${orderId}:`, (e instanceof Error ? e.message : String(e)));
      try {
        const { sendAdminAlert } = await import('@/lib/notifications');
        sendAdminAlert(
          `🚨 failOrderTerminal ERROR\n\norderId: ${orderId}\nreason: ${reason}\nerror: ${(e instanceof Error ? e.message : String(e))}`,
          'CRITICAL'
        );
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (importErr) {
        // Fallback catch in case import itself fails
      }
    }
  }

  /**
   * Fail-Fast Order Termination (Zero Retries).
   * Instantly marks order as CANCELED, refunds full charge, reverses
   * affiliate commission, and sends a critical admin alert.
   *
   * ARCHITECTURE: This is the primary error handler under the "Fail-Fast"
   * directive — any provider API failure (network or business) triggers
   * immediate, atomic cancellation. No retries, no quarantine, no rerouting.
   */
  async failOrderTerminalFast(orderId: string, reason: string): Promise<void> {
    try {
      const txResult = await runSerializableTransaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { user: true, service: true }
        });

        // Prevent duplicate processing on terminal orders
        if (!order || ['COMPLETED', 'CANCELED', 'PARTIAL', 'ERROR'].includes(order.status)) {
          return null;
        }

        // 1. Atomically change order status to CANCELED
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELED',
            error: `Fail-Fast: ${reason}`,
            updatedAt: new Date()
          }
        });

        // 2. Reverse affiliate commission if it was awarded
        const { LoyaltyService } = await import('../users/loyalty.service');
        await LoyaltyService.reverseCommission(tx, order.id);

        // 3. Full refund via LedgerEntry (idempotent — prevents double-spend)
        const refundKey = `refund-failfast-${order.id}`;
        const existingLedger = await tx.ledgerEntry.findFirst({
          where: { idempotencyKey: refundKey, tenantId: order.tenantId }
        });

        if (!existingLedger && order.charge > 0) {
          await WalletOps.refund(
            tx,
            order.userId,
            Number(order.charge),
            `Возврат средств: Заказ #${order.numericId} отменён системой. Средства в полном объёме возвращены на баланс.`,
            { idempotencyKey: refundKey, tenantId: order.tenantId }
          );
        }

        return {
          numericId: order.numericId,
          serviceName: order.service?.name || 'Неизвестная услуга',
          email: order.user?.email,
          tenantId: order.tenantId
        };
      });

      // 4. Fire-and-forget notifications (outside transaction)
      if (txResult) {
        // Admin alert
        try {
          const { sendAdminAlert } = await import('@/lib/notifications');
          await sendAdminAlert(
            `🚨 [FAIL-FAST] Заказ #${txResult.numericId} автоматически отменен!\n` +
            `Услуга: ${txResult.serviceName}\n` +
            `Ошибка провайдера: ${reason}`,
            'CRITICAL'
          );
        } catch (err) { console.warn('[OrderService] Telegram notification failed:', err); }

        // Email notification to client
        if (txResult.email) {
          try {
            const { sendOrderCanceledMail } = await import('../../lib/smtp');
            await sendOrderCanceledMail(
              txResult.email,
              txResult.numericId.toString(),
              txResult.serviceName,
              txResult.tenantId
            );
          } catch (err) { console.warn('[OrderService] Auto-status refund notification failed:', err); }
        }
      }

      CompensationService.trackCompensation(orderId).catch(err => console.error('[OrderService] Failed to track compensation', err));
    } catch (e: unknown) {
      console.error(`[OrderService] failOrderTerminalFast failed for ${orderId}:`, (e instanceof Error ? e.message : String(e)));
      // Last-resort admin alert
      try {
        const { sendAdminAlert } = await import('@/lib/notifications');
        sendAdminAlert(
          `🚨 failOrderTerminalFast CRITICAL ERROR\n\norderId: ${orderId}\nreason: ${reason}\nerror: ${(e instanceof Error ? e.message : String(e))}`,
          'CRITICAL'
        );
      } catch (err) { console.error('[OrderService] Sync fail recovery failed:', err); }
    }
  }
}

export const orderService = new OrderService();
