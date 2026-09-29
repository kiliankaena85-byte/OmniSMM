import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { MarginGuard } from '@/services/providers/smart-routing.service';
import { runWithTenantBypass } from '@/lib/tenant-context';

const log = logger.child({ component: 'SmartRecoveryEngine' });

export interface HotSwapResult {
  success: boolean;
  orderId: string;
  originalProviderId: string;
  swappedProviderId?: string;
  absorbedDeltaCents: bigint;
  error?: string;
}

export class SmartRecoveryEngine {
  /**
   * Executes 1-Click Hot-Swap of a failing order to the best matching alternative provider route.
   */
  public static async executeHotSwap(orderId: string, reason: string): Promise<HotSwapResult> {
    // tenant-isolation-ignore: Internal order recovery hot-swap by ID
    const order = await runWithTenantBypass('SmartRecovery executeHotSwap order lookup', async () => {
      return await db.order.findUnique({
        where: { id: orderId },
        include: { service: { include: { routes: { include: { provider: true } } } } },
      });
    });

    if (!order || !order.providerId) {
      return { success: false, orderId, originalProviderId: '', absorbedDeltaCents: BigInt(0), error: 'Order or provider not found' };
    }

    const currentProviderId = order.providerId;

    // Find candidate failover routes
    const fallbackRoutes = order.service.routes
      .filter((r) => r.providerId !== currentProviderId && r.isActive && r.provider.isActive)
      .sort((a, b) => a.priority - b.priority);

    if (fallbackRoutes.length === 0) {
      return {
        success: false,
        orderId,
        originalProviderId: currentProviderId,
        absorbedDeltaCents: BigInt(0),
        error: 'No active fallback routes configured for this service',
      };
    }

    const targetRoute = fallbackRoutes[0];
    const targetProviderCurrency = targetRoute.provider?.balanceCurrency || 'USD';

    // 1. Resolve fallback provider rate from ShadowService
    const shadowSvc = await db.shadowService.findUnique({
      where: {
        providerId_externalId: {
          providerId: targetRoute.providerId,
          externalId: targetRoute.providerServiceId,
        },
      },
    });

    const targetRate = shadowSvc ? shadowSvc.rate : (order.service.rate || 1.0);
    const quantity = order.quantity || 1000;
    const originalCost = BigInt(order.providerCost || 0);

    // 2. MarginGuard check against customer paid amount (if charge exists)
    const clientPaidCents = order.charge != null ? BigInt(order.charge) : BigInt(0);

    let newEstimatedCost: bigint;
    if (clientPaidCents > BigInt(0)) {
      const marginResult = await MarginGuard.checkMargin(
        clientPaidCents,
        quantity,
        targetRate,
        targetProviderCurrency
      );

      if (!marginResult.isProfitable) {
        log.warn(`[HotSwap REJECTED] Order ${order.id}: negative margin on target provider ${targetRoute.providerId}. ${marginResult.reason}`);
        return {
          success: false,
          orderId: order.id,
          originalProviderId: currentProviderId,
          absorbedDeltaCents: BigInt(0),
          error: `Целевой провайдер отклонен: отрицательная маржа (${marginResult.reason})`,
        };
      }
      newEstimatedCost = marginResult.costCents;
    } else {
      // In tests/free orders without recorded charge, calculate cost directly from rate
      const unitsK = quantity / 1000;
      newEstimatedCost = BigInt(Math.round(targetRate * unitsK * 100));
    }

    const absorbedDelta = newEstimatedCost > originalCost ? newEstimatedCost - originalCost : BigInt(0);

    try {
      const res = await db.$transaction(async (tx) => {
        // Record recovery incident
        await tx.orderRecoveryIncident.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            originalProviderId: currentProviderId,
            swappedProviderId: targetRoute.providerId,
            absorbedDeltaCents: absorbedDelta,
            reason,
            status: 'EXECUTED',
          },
        });

        // Update Order with new provider details and status PENDING for immediate redispatch
        // tenant-isolation-ignore: Internal order recovery hot-swap update by ID
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            providerId: targetRoute.providerId,
            providerServiceId: targetRoute.providerServiceId,
            externalId: null, // Reset externalId for new dispatch
            providerCost: newEstimatedCost,
            status: 'PENDING',
            error: null,
          },
        });

        return updated;
      });

      // Enqueue to ordersQueue so BullMQ worker picks up and executes dispatch to new provider
      try {
        const { ordersQueue } = await import('@/lib/queue-manager');
        await ordersQueue.add(
          'order-dispatch',
          { orderId: order.id, tenantId: order.tenantId },
          { jobId: `hotswap-${order.id}-${Date.now()}` }
        );
      } catch (queueErr) {
        log.warn(`[HotSwap] Failed to enqueue order ${order.id} to ordersQueue:`, { queueErr });
      }

      log.info(`[HotSwap SUCCESS] Order ${order.id} swapped from ${currentProviderId} to ${targetRoute.providerId}`);

      return {
        success: true,
        orderId: res.id,
        originalProviderId: currentProviderId,
        swappedProviderId: targetRoute.providerId,
        absorbedDeltaCents: absorbedDelta,
      };
    } catch (err) {
      log.error(`[HotSwap FAILED] Order ${order.id}: ${(err as Error).message}`);
      return {
        success: false,
        orderId: order.id,
        originalProviderId: currentProviderId,
        absorbedDeltaCents: BigInt(0),
        error: (err as Error).message,
      };
    }
  }
}
