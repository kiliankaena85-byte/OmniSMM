import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: { service: { include: { routes: { include: { provider: true } } } } },
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
    const originalCost = BigInt(order.providerCost || 0);
    const unitsK = (order.quantity || 1000) / 1000;
    const rate = order.service.rate || 1.0;
    const newEstimatedCost = BigInt(Math.round(rate * unitsK * 100));
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

        // Update Order with new provider details
        const updated = await tx.order.update({
          where: { id: order.id },
          data: {
            providerId: targetRoute.providerId,
            externalId: null, // Reset externalId for new dispatch
            status: 'IN_PROGRESS',
          },
        });

        return updated;
      });

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
