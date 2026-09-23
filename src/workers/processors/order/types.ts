import type { db } from '../../../lib/db';
import type { PrioritizedRoute } from '../../../services/providers/smart-routing.service';

export class DatabaseOrderError extends Error {
  isDatabaseError = true;
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseOrderError';
  }
}

export type OrderWithRelations = NonNullable<Awaited<ReturnType<typeof fetchOrderWithRelations>>>;

export async function fetchOrderWithRelations(database: typeof db, orderId: string) {
  return database.order.findUnique({
    where: { id: orderId },
    include: {
      service: {
        include: {
          provider: true,
          category: { include: { network: true } }
        }
      },
      user: { select: { id: true, email: true, tenantId: true } },
      smartCampaign: true
    }
  });
}

export interface RouteCapabilityCheckResult {
  isCompatible: boolean;
  reason?: string;
  isMarginError?: boolean;
}

export interface DispatchLoopContext {
  order: OrderWithRelations;
  candidateRoutes: PrioritizedRoute[];
  primaryProviderId: string;
  redisKey: string;
}
