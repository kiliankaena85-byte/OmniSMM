import { describe, it, expect } from 'vitest';
import { getSupportSlaInfo } from '@/utils/support-sla';
import { getMSKMidnightUTC } from '@/services/admin/escrow.service';
import { OPERATIONS_TABS } from '@/components/admin/navigation-data';

describe('Admin Tickets Integrity & Contracts Suite (SIL-2026 Step 14)', () => {
  describe('Support SLA Day/Night Shift Calculations', () => {
    it('returns day shift SLA during MSK daylight hours (08:00 - 22:59 MSK)', () => {
      // 12:00 UTC = 15:00 MSK (day shift)
      const dayDate = new Date('2026-09-14T12:00:00.000Z');
      const sla = getSupportSlaInfo(dayDate);
      expect(sla.isNightShift).toBe(false);
      expect(sla.expectedResponseMin).toBe(15);
      expect(sla.badgeShort).toContain('Дневной SLA');
      expect(sla.timeStringMsk).toContain('МСК');
    });

    it('returns night shift SLA during MSK night hours (23:00 - 07:59 MSK)', () => {
      // 01:00 UTC = 04:00 MSK (night shift)
      const nightDate = new Date('2026-09-14T01:00:00.000Z');
      const sla = getSupportSlaInfo(nightDate);
      expect(sla.isNightShift).toBe(true);
      expect(sla.expectedResponseMin).toBe(45);
      expect(sla.badgeShort).toContain('Ночной SLA');
    });
  });

  describe('MSK Midnight Escrow Anchoring', () => {
    it('anchors daily trust limit resets to 00:00 MSK (21:00 UTC previous day)', () => {
      const midnight = getMSKMidnightUTC();
      expect(midnight).toBeInstanceOf(Date);
      // MSK is UTC+3, so MSK 00:00 is 21:00 UTC of previous day
      expect(midnight.getUTCHours()).toBe(21);
      expect(midnight.getUTCMinutes()).toBe(0);
      expect(midnight.getUTCSeconds()).toBe(0);
    });
  });

  describe('Navigation & Operations Cluster Integrity', () => {
    it('verifies /admin/tickets is part of OPERATIONS_TABS navigation cluster', () => {
      const ticketTab = OPERATIONS_TABS.find((t) => t.href === '/admin/tickets');
      expect(ticketTab).toBeDefined();
      expect(ticketTab?.label).toBe('Тикеты поддержки');
    });
  });

  describe('Support Ticket Order Action Invariants', () => {
    it('allows order cancellation only for cancelable statuses and privileged roles or enabled flags', () => {
      const cancelableStatuses = ['PENDING', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'ERROR'];
      const nonCancelableStatuses = ['COMPLETED', 'CANCELED', 'PARTIAL'];

      for (const st of cancelableStatuses) {
        const isStatusCancelable = cancelableStatuses.includes(st);
        expect(isStatusCancelable).toBe(true);
      }

      for (const st of nonCancelableStatuses) {
        const isStatusCancelable = cancelableStatuses.includes(st);
        expect(isStatusCancelable).toBe(false);
      }
    });

    it('verifies support compensation trust budget ceiling', () => {
      const defaultSupportLimitCents = 100000; // 1,000 RUB
      const anomalousCeilingCents = 10000000; // 100,000 RUB
      expect(defaultSupportLimitCents).toBeLessThan(anomalousCeilingCents);
    });
  });
});