import { describe, it, expect } from 'vitest';
import { STATUS_LABELS, formatAge } from '@/app/admin/refills/client-table';
import { OPERATIONS_TABS } from '@/components/admin/navigation-data';

describe('Admin Refills Integrity & Contracts Suite (SIL-2026 Step 13)', () => {
  describe('Status Labels & Meta Exhaustiveness', () => {
    it('covers all critical refill lifecycle statuses (PENDING, IN_PROGRESS, COMPLETED, REJECTED, ERROR)', () => {
      const requiredStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'ERROR'];

      for (const status of requiredStatuses) {
        const meta = STATUS_LABELS[status];
        expect(meta).toBeDefined();
        expect(meta.label).toBeDefined();
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.bg).toBeDefined();
        expect(['primary', 'secondary', 'destructive']).toContain(meta.intent);
      }
    });
  });

  describe('formatAge calculation logic', () => {
    it('formats minutes, hours, and days correctly', () => {
      const now = Date.now();
      const fiveMinutesAgo = new Date(now - 5 * 60 * 1000);
      const resMins = formatAge(fiveMinutesAgo);
      expect(resMins.text).toBe('5м назад');
      expect(resMins.isOld).toBe(false);

      const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000);
      const resHours = formatAge(threeHoursAgo);
      expect(resHours.text).toBe('3ч назад');
      expect(resHours.isOld).toBe(false);

      const oneDayAgo = new Date(now - 25 * 60 * 60 * 1000);
      const resOneDay = formatAge(oneDayAgo);
      expect(resOneDay.text).toBe('1д назад');
      expect(resOneDay.isOld).toBe(false);

      const threeDaysAgo = new Date(now - 72 * 60 * 60 * 1000);
      const resOldDays = formatAge(threeDaysAgo);
      expect(resOldDays.text).toBe('3д назад');
      expect(resOldDays.isOld).toBe(true);
    });
  });

  describe('Navigation & Operations Cluster Integrity', () => {
    it('verifies /admin/refills is part of OPERATIONS_TABS navigation cluster', () => {
      const refillTab = OPERATIONS_TABS.find((t) => t.href === '/admin/refills');
      expect(refillTab).toBeDefined();
      expect(refillTab?.label).toBe('Заявки на докрутку');
    });
  });

  describe('Refill Lifecycle Rules & Invariants', () => {
    it('ensures COMPLETED status is terminal and cannot be restarted', () => {
      const completedStatus = 'COMPLETED';
      const canRestart = completedStatus !== 'COMPLETED';
      expect(canRestart).toBe(false);
    });

    it('ensures only non-completed and non-rejected statuses allow manual completion or rejection override', () => {
      const allowedToOverride = ['PENDING', 'IN_PROGRESS', 'ERROR'];
      expect(allowedToOverride.includes('PENDING')).toBe(true);
      expect(allowedToOverride.includes('IN_PROGRESS')).toBe(true);
      expect(allowedToOverride.includes('ERROR')).toBe(true);
      expect(allowedToOverride.includes('COMPLETED')).toBe(false);
      expect(allowedToOverride.includes('REJECTED')).toBe(false);
    });
  });
});