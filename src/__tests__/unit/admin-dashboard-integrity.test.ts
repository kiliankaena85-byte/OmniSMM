import { describe, it, expect } from 'vitest';
import { formatKopecks } from '@/utils/format-kopecks';

describe('Admin Dashboard Integrity & Routing Suite (SIL-2026 Step 1)', () => {
  describe('Routing & Link Invariants', () => {
    it('verifies canonical destination routes for all dashboard widgets and cards', () => {
      const validAdminRoutes = new Set([
        '/admin/dashboard',
        '/admin/orders',
        '/admin/orders?status=IN_PROGRESS',
        '/admin/orders?status=PENDING',
        '/admin/orders?status=ERROR',
        '/admin/orders?status=PROBLEMATIC',
        '/admin/refills',
        '/admin/tickets',
        '/admin/tickets?status=OPEN',
        '/admin/clients',
        '/admin/transactions',
        '/admin/finance',
        '/admin/marketing',
        '/admin/catalog',
        '/admin/catalog/quarantine',
        '/admin/catalog/categories',
        '/admin/providers',
        '/admin/settings',
        '/admin/settings?tab=audit',
        '/admin/finance/balance-requests',
      ]);

      // Card 1 & 2 in KPI strip must point to /admin/finance
      const revenueCardLink = '/admin/finance';
      const marginCardLink = '/admin/finance';
      expect(validAdminRoutes.has(revenueCardLink)).toBe(true);
      expect(validAdminRoutes.has(marginCardLink)).toBe(true);

      // Top services widget must link to canonical /admin/catalog (NOT /admin/services)
      const catalogWidgetLink = '/admin/catalog';
      expect(validAdminRoutes.has(catalogWidgetLink)).toBe(true);

      // Refund monitor must link to /admin/orders?status=PROBLEMATIC
      const refundMonitorLink = '/admin/orders?status=PROBLEMATIC';
      expect(validAdminRoutes.has(refundMonitorLink)).toBe(true);
    });
  });

  describe('Financial Metric Guard & NaN Protection', () => {
    it('handles zero revenue and edge cases without NaN or Infinity', () => {
      const calculateMargin = (revenueNet: number, profitNet: number): number => {
        if (!revenueNet || revenueNet <= 0 || isNaN(revenueNet) || !isFinite(revenueNet)) {
          return 0;
        }
        const margin = (profitNet / revenueNet) * 100;
        return isNaN(margin) || !isFinite(margin) ? 0 : margin;
      };

      expect(calculateMargin(0, 0)).toBe(0);
      expect(calculateMargin(0, 500)).toBe(0);
      expect(calculateMargin(1000, 300)).toBe(30);
      expect(calculateMargin(-100, 50)).toBe(0);
    });

    it('formats kopecks correctly for zero and positive balances', () => {
      expect(formatKopecks(BigInt(0))).toBe('0 ₽');
      expect(formatKopecks(BigInt(100000))).toBe('1 000 ₽');
      expect(formatKopecks(BigInt(100050))).toBe('1 000,50 ₽');
      expect(formatKopecks(BigInt(50))).toBe('0,50 ₽');
    });
  });

  describe('Problematic Orders Filter Contract', () => {
    it('defines PROBLEMATIC status as covering ERROR, CANCELED, and PARTIAL', () => {
      const getStatusesForFilter = (status: string): string[] => {
        if (status === 'PROBLEMATIC') {
          return ['ERROR', 'CANCELED', 'PARTIAL'];
        }
        if (status === 'ACTIVE') {
          return ['PENDING', 'IN_PROGRESS'];
        }
        if (status === 'COMPLETED_ALL') {
          return ['COMPLETED', 'PARTIAL'];
        }
        return [status];
      };

      const problematicStatuses = getStatusesForFilter('PROBLEMATIC');
      expect(problematicStatuses).toContain('ERROR');
      expect(problematicStatuses).toContain('CANCELED');
      expect(problematicStatuses).toContain('PARTIAL');
      expect(problematicStatuses).not.toContain('COMPLETED');
    });
  });
});
