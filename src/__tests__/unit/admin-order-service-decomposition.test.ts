import { describe, it, expect, vi } from 'vitest';
import { resolveOrderOrderBy } from '@/services/admin/order/types';
import { buildOrderWhereClause } from '@/services/admin/order/order-filter-builder';
import { adminOrderService } from '@/services/admin/order.service';

describe('Wave 23: Admin Order Service Decomposition (CDD-TDD)', () => {
  describe('resolveOrderOrderBy', () => {
    it('should default to createdAt desc if no sortField provided', () => {
      expect(resolveOrderOrderBy()).toEqual({ createdAt: 'desc' });
    });

    it('should sort by allowed direct fields', () => {
      expect(resolveOrderOrderBy('numericId', 'asc')).toEqual({ numericId: 'asc' });
      expect(resolveOrderOrderBy('status', 'desc')).toEqual({ status: 'desc' });
      expect(resolveOrderOrderBy('charge', 'asc')).toEqual({ charge: 'asc' });
      expect(resolveOrderOrderBy('providerCost', 'desc')).toEqual({ providerCost: 'desc' });
    });

    it('should sort by user email for client/user/email fields', () => {
      expect(resolveOrderOrderBy('client', 'asc')).toEqual({ user: { email: 'asc' } });
      expect(resolveOrderOrderBy('email', 'desc')).toEqual({ user: { email: 'desc' } });
    });
  });

  describe('buildOrderWhereClause', () => {
    it('should handle numeric ID query', () => {
      const where = buildOrderWhereClause({ query: '#1234' });
      expect(where.OR).toEqual([
        { numericId: 1234 },
        { externalId: { equals: '1234' } },
      ]);
    });

    it('should handle status filters', () => {
      const activeWhere = buildOrderWhereClause({ status: 'ACTIVE' });
      expect(activeWhere.status).toEqual({ in: ['PENDING', 'IN_PROGRESS'] });

      const probWhere = buildOrderWhereClause({ status: 'PROBLEMATIC' });
      expect(probWhere.status).toEqual({ in: ['ERROR', 'CANCELED', 'PARTIAL'] });
    });

    it('should handle tenant filtering', () => {
      const where = buildOrderWhereClause({ tenantId: 'smmflux' });
      expect(where.tenantId).toBe('smmflux');
    });

    it('should handle price range filters in kopecks', () => {
      const where = buildOrderWhereClause({ minPrice: 10, maxPrice: 50 });
      expect(where.charge).toEqual({ gte: 1000, lte: 5000 });
    });
  });

  describe('adminOrderService Coordinator Facade', () => {
    it('should expose all required methods', () => {
      expect(typeof adminOrderService.searchOrders).toBe('function');
      expect(typeof adminOrderService.cancelOrder).toBe('function');
      expect(typeof adminOrderService.syncOrderStatusWithProvider).toBe('function');
      expect(typeof adminOrderService.restartOrder).toBe('function');
      expect(typeof adminOrderService.getOrderStats).toBe('function');
      expect(typeof adminOrderService.getOrdersTimeseries).toBe('function');
      expect(typeof adminOrderService.getRecentOrders).toBe('function');
      expect(typeof adminOrderService.getTopServices).toBe('function');
      expect(typeof adminOrderService.getRefundAndFailureStats).toBe('function');
    });
  });
});
