/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Robust Order Dispatcher with Outbox Pattern & Circuit Breaker Protection.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { CircuitBreaker } from '@/lib/resilience/circuit-breaker';
import { ProviderIdempotencyGenerator } from './idempotency-key-generator';
import { ProviderService } from '@/services/providers/provider.service';

export interface DispatchOrderInput {
  orderId: string;
  userId: string;
  serviceId: string;
  providerId: string;
  externalServiceId: string;
  link: string;
  quantity: number;
  runs?: number;
  interval?: number;
  customData?: string;
}

export interface DispatchResult {
  success: boolean;
  providerOrderId?: string;
  cached?: boolean;
  error?: string;
}

export class OrderDispatchService {
  private static readonly providerService = new ProviderService();

  /**
   * Dispatches an order to the provider with Outbox de-duplication and Circuit Breaker.
   */
  static async dispatchOrder(input: DispatchOrderInput): Promise<DispatchResult> {
    const idempotencyKey = ProviderIdempotencyGenerator.generateKey({
      orderId: input.orderId,
      userId: input.userId,
      serviceId: input.serviceId,
      link: input.link,
      quantity: input.quantity,
      runs: input.runs,
      customData: input.customData,
    });

    // 1. Outbox Check / Creation
    let outbox = await db.providerOutbox.findUnique({
      where: { idempotencyKey },
    });

    if (outbox && outbox.status === 'SENT' && outbox.providerOrderId) {
      console.info(`[OrderDispatch] Order ${input.orderId} already sent to provider (Idempotency Hit: ${outbox.providerOrderId})`);
      return { success: true, providerOrderId: outbox.providerOrderId, cached: true };
    }

    if (!outbox) {
      outbox = await db.providerOutbox.create({
        data: {
          orderId: input.orderId,
          providerId: input.providerId,
          idempotencyKey,
          status: 'PENDING',
          payload: input as unknown as Prisma.InputJsonValue,
          attempts: 0,
        },
      });
    }

    // 2. Fetch Provider configuration
    const provider = await db.provider.findUnique({
      where: { id: input.providerId },
    });

    if (!provider || !provider.isActive) {
      await db.providerOutbox.update({
        where: { id: outbox.id },
        data: { status: 'FAILED', error: 'Provider inactive or not found' },
      });
      return { success: false, error: 'Провайдер временно неактивен' };
    }

    // 3. Execute external HTTP call protected by Circuit Breaker
    try {
      const response = await CircuitBreaker.execute(provider.id, provider.name, async () => {
        const instance = await this.providerService.getProviderInstance(provider);
        return await instance.createOrder({
          service: input.externalServiceId,
          link: input.link,
          quantity: input.quantity,
          runs: input.runs,
          interval: input.interval,
        });
      });

      if (!response || response.error || !response.order) {
        throw new Error(response?.error || 'Provider returned unsuccessful response');
      }

      const orderRef = String(response.order);

      // 4. Update Outbox and Order with externalId
      await db.providerOutbox.update({
        where: { id: outbox.id },
        data: {
          status: 'SENT',
          providerOrderId: orderRef,
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      await db.order.update({
        where: { id: input.orderId },
        data: {
          externalId: orderRef,
          status: 'IN_PROGRESS',
        },
      });

      return { success: true, providerOrderId: orderRef, cached: false };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[OrderDispatch] Failed to dispatch order ${input.orderId}:`, errorMsg);

      await db.providerOutbox.update({
        where: { id: outbox.id },
        data: {
          status: 'FAILED',
          error: errorMsg,
          lastAttemptAt: new Date(),
          attempts: { increment: 1 },
        },
      });

      return { success: false, error: errorMsg };
    }
  }

  /**
   * Dispatches an order with automatic cascade failover across active ServiceRoutes
   * if the primary provider fails. Ensures MarginGuard profitability before routing.
   */
  static async dispatchOrderWithFailover(input: DispatchOrderInput): Promise<DispatchResult & { failoverUsed?: boolean; fallbackProviderId?: string }> {
    // 1. Try primary dispatch
    const primaryResult = await this.dispatchOrder(input);
    if (primaryResult.success) {
      return primaryResult;
    }

    const primaryError = primaryResult.error || 'Unknown primary provider error';
    console.warn(`[OrderDispatch] Primary provider ${input.providerId} failed for order ${input.orderId}: ${primaryError}. Initiating Smart Cascade Failover...`);

    // 2. Lookup candidate fallback routes
    const { SmartRoutingService, MarginGuard } = await import('@/services/providers/smart-routing.service');
    const prioritizedRoutes = await SmartRoutingService.getPrioritizedRoutes(input.serviceId);

    // Filter out the provider that just failed
    const fallbackRoutes = prioritizedRoutes.filter(
      (r) => r.providerId !== input.providerId && r.isActive && r.provider?.isActive
    );

    if (fallbackRoutes.length === 0) {
      console.info(`[OrderDispatch] No alternative active routes available for service ${input.serviceId}`);
      return primaryResult;
    }

    // 3. Get order charge to verify margin
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { charge: true, quantity: true }
    });

    const clientPaidCents = order?.charge ? BigInt(Number(order.charge)) : BigInt(0);

    // 4. Iterate over fallback routes in priority order
    for (const route of fallbackRoutes) {
      const providerRate = (route as unknown as { rate?: number }).rate ?? 0;
      const marginCheck = await MarginGuard.checkMargin(
        clientPaidCents,
        input.quantity,
        providerRate,
        route.provider.balanceCurrency || 'USD'
      );

      if (!marginCheck.isProfitable) {
        console.warn(`[OrderDispatch] Skipping fallback route ${route.id} (${route.provider.name}): unprofitable (${marginCheck.reason})`);
        continue;
      }

      console.info(`[OrderDispatch] Attempting fallback route ${route.id} (${route.provider.name}) for order ${input.orderId}...`);

      const fallbackResult = await this.dispatchOrder({
        ...input,
        providerId: route.providerId,
        externalServiceId: route.providerServiceId || input.externalServiceId,
      });

      if (fallbackResult.success) {
        console.info(`[OrderDispatch] Fallback successfully routed order ${input.orderId} to provider ${route.provider.name}`);

        await db.routingAuditLog.create({
          data: {
            serviceId: input.serviceId,
            action: 'AUTOMATIC_FAILOVER',
            fromProviderId: input.providerId,
            toProviderId: route.providerId,
            reason: `Auto failover for order #${input.orderId}: Primary provider failed (${primaryError})`
          }
        }).catch((auditErr) => console.error('[OrderDispatch] Failed to log routing audit:', auditErr));

        return {
          ...fallbackResult,
          failoverUsed: true,
          fallbackProviderId: route.providerId
        };
      }
    }

    return primaryResult;
  }
}
