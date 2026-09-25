import type { PaginatedResult } from '@/lib/pagination';
import {
  AdminOrderRow,
  OrderSearchParams,
  resolveOrderOrderBy,
} from './order/types';
import { OrderQueryService } from './order/order-query.service';
import { OrderStatusMutatorService } from './order/order-status-mutator.service';
import { OrderProviderSyncService } from './order/order-provider-sync.service';
import { OrderTimeseriesService } from './order/order-timeseries.service';
import { OrderAnalyticsService } from './order/order-analytics.service';

export { resolveOrderOrderBy, type AdminOrderRow, type OrderSearchParams };

/**
 * AdminOrderService (OmniSMM 1.0)
 * High-performance coordinator for order management, provider synchronization,
 * cancellation/refund escrow workflows, and real-time dashboard telemetry.
 */
class AdminOrderService {
  /**
   * Omni-Search: searches by email, link/URL, order numericId, or externalId.
   * Returns paginated results with support for offset and cursor.
   */
  async searchOrders(params: OrderSearchParams): Promise<PaginatedResult<AdminOrderRow>> {
    return OrderQueryService.searchOrders(params);
  }

  /**
   * Cancel an order and refund the user's balance.
   * Partial refund: if order is IN_PROGRESS/PARTIAL with remains > 0,
   * refund only the undelivered portion.
   */
  async cancelOrder(
    orderId: string,
    admin: { id: string; email: string; tenantId?: string; role?: string },
    options?: { forceWriteOff?: boolean }
  ) {
    return OrderStatusMutatorService.cancelOrder(orderId, admin, options);
  }

  /**
   * Sync single order status directly from upstream provider.
   */
  async syncOrderStatusWithProvider(
    orderId: string,
    admin?: { id: string; email: string; tenantId?: string; role?: string }
  ) {
    return OrderProviderSyncService.syncOrderStatusWithProvider(orderId, admin);
  }

  /**
   * Restart a failed/error order by resetting it to PENDING.
   * The provision worker will pick it up on next cycle.
   */
  async restartOrder(
    orderId: string,
    admin: { id: string; email: string; tenantId?: string; role?: string }
  ) {
    return OrderProviderSyncService.restartOrder(orderId, admin);
  }

  /**
   * Retrieves order stats using a single high-performance groupBy query with 15s cache.
   */
  async getOrderStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    return OrderAnalyticsService.getOrderStats(startDate, endDate, tenantId);
  }

  /**
   * Retrieves order counts grouped by hour/day/week/month to build the Orders Dynamics Chart.
   */
  async getOrdersTimeseries(
    startDate: Date,
    endDate: Date,
    step: 'hour' | 'day' | 'week' | 'month',
    tenantId?: string
  ) {
    return OrderTimeseriesService.getOrdersTimeseries(startDate, endDate, step, tenantId);
  }

  /**
   * Get recent live orders for dashboard feed
   */
  async getRecentOrders(limit = 6, tenantId?: string) {
    return OrderAnalyticsService.getRecentOrders(limit, tenantId);
  }

  /**
   * Get top services by volume and revenue for analytics
   */
  async getTopServices(limit = 6, startDate?: Date, endDate?: Date, tenantId?: string) {
    return OrderAnalyticsService.getTopServices(limit, startDate, endDate, tenantId);
  }

  /**
   * Get refund and failure monitoring stats
   */
  async getRefundAndFailureStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    return OrderAnalyticsService.getRefundAndFailureStats(startDate, endDate, tenantId);
  }
}

export const adminOrderService = new AdminOrderService();
