import { db } from '@/lib/db';
import { SettingsProvider } from '@/lib/settings';
import { logger } from '@/lib/logger';
import type { Provider, ServiceRoute } from '@prisma/client';

const log = logger.child({ component: 'SmartRoutingService' });

export type PrioritizedRoute = ServiceRoute & { provider: Provider };

export interface MarginCheckResult {
  isProfitable: boolean;
  costCents: bigint;
  clientPaidCents: bigint;
  marginPercent: number;
  reason?: string;
}

export class MarginGuard {
  /**
   * Asserts whether dispatching to candidate route preserves financial margin (>= 0%).
   * Cost = (rate * exchangeRate * (1 + buffer) / 1000) * quantity
   * Applies a default 5% currency volatility buffer on foreign currency (USD).
   */
  static async checkMargin(
    clientPaidCents: bigint,
    quantity: number,
    providerRate: number,
    providerCurrency: string,
    bufferPercent: number = 0.05
  ): Promise<MarginCheckResult> {
    const usdToRub = await SettingsProvider.getExchangeRateUSD();
    const currUpper = providerCurrency.toUpperCase();
    let exchangeRate = 1.0;
    if (currUpper === 'USD') {
      exchangeRate = usdToRub;
    } else if (currUpper === 'EUR') {
      exchangeRate = usdToRub * 1.08;
    }
    const rateMultiplier = currUpper !== 'RUB' ? exchangeRate * (1 + bufferPercent) : 1.0;

    // Total cost in RUB
    const costRub = (providerRate * rateMultiplier / 1000) * quantity;
    // Cost in cents (BigInt)
    const costCents = BigInt(Math.ceil(costRub * 100));

    if (costCents > clientPaidCents) {
      const lossCents = costCents - clientPaidCents;
      return {
        isProfitable: false,
        costCents,
        clientPaidCents,
        marginPercent: -Number((lossCents * BigInt(100)) / (costCents || BigInt(1))),
        reason: `Себестоимость (${costCents.toString()} коп) превышает оплату клиента (${clientPaidCents.toString()} коп)`
      };
    }

    const profitCents = clientPaidCents - costCents;
    const marginPercent = Number((profitCents * BigInt(100)) / (clientPaidCents || BigInt(1)));

    return {
      isProfitable: true,
      costCents,
      clientPaidCents,
      marginPercent
    };
  }
}

export class SmartRoutingService {
  /**
   * Retrieves all candidate routes for a service ordered by:
   * 1. isPrimary (true first)
   * 2. priority (ASC: 0 is highest)
   * 3. createdAt (ASC)
   * Degraded providers (errorCount5m > 10) are pushed to the end.
   */
  static async getPrioritizedRoutes(serviceId: string): Promise<PrioritizedRoute[]> {
    const rawRoutes = await db.serviceRoute.findMany({
      where: {
        serviceId,
        isActive: true,
        provider: {
          isActive: true
        }
      },
      include: {
        provider: true
      },
      orderBy: [
        { isPrimary: 'desc' },
        { priority: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Filter out providers with critical error spike (> 10 errors in 5m)
    const healthyRoutes: PrioritizedRoute[] = [];
    const degradedRoutes: PrioritizedRoute[] = [];

    for (const route of rawRoutes) {
      if (route.provider.errorCount5m > 10) {
        degradedRoutes.push(route as unknown as PrioritizedRoute);
      } else {
        healthyRoutes.push(route as unknown as PrioritizedRoute);
      }
    }

    // Healthy routes first, degraded routes as last resort
    return [...healthyRoutes, ...degradedRoutes];
  }

  /**
   * Records a routing failover or manual override event in RoutingAuditLog.
   */
  static async recordFailoverEvent(params: {
    serviceId: string;
    adminId?: string;
    action: string;
    fromProviderId?: string;
    toProviderId?: string;
    reason: string;
  }): Promise<void> {
    try {
      await db.routingAuditLog.create({
        data: {
          serviceId: params.serviceId,
          adminId: params.adminId || null,
          action: params.action,
          fromProviderId: params.fromProviderId || null,
          toProviderId: params.toProviderId || null,
          reason: params.reason
        }
      });
      log.info(`[SmartRoutingService] Routing audit event recorded: ${params.action} for service ${params.serviceId}`);
    } catch (err) {
      log.warn(`[SmartRoutingService] Failed to record routing audit log`, { err });
    }
  }
}
