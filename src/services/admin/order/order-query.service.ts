import { db } from '@/lib/db';
import { paginatedQuery, type PaginatedResult } from '@/lib/pagination';
import { AdminOrderRow, OrderSearchParams, resolveOrderOrderBy } from './types';
import { buildOrderWhereClause } from './order-filter-builder';

export class OrderQueryService {
  /**
   * Omni-Search: searches by email, link/URL, order numericId, or externalId.
   * Returns paginated results with support for offset and cursor.
   */
  static async searchOrders(params: OrderSearchParams): Promise<PaginatedResult<AdminOrderRow>> {
    const { cursor, page, pageSize = 50 } = params;
    const where = buildOrderWhereClause(params);
    const orderBy = resolveOrderOrderBy(params.sortField, params.sortOrder);

    return paginatedQuery<AdminOrderRow>(db.order, {
      cursor,
      page,
      pageSize,
      where,
      orderBy,
      include: {
        user: { select: { id: true, email: true } },
        provider: { select: { name: true, ticketUrl: true } },
        payment: { select: { id: true, gatewayId: true, gateway: true } },
        service: {
          select: {
            id: true,
            name: true,
            numericId: true,
            etaP50Seconds: true,
            etaP90Seconds: true,
            etaSampleCount: true,
            etaSpeedClass: true,
            etaUpdatedAt: true,
            category: { select: { name: true, network: { select: { name: true } } } },
          },
        },
      },
    });
  }
}
