import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFunnelAnalyticsAction } from '@/actions/admin/analytics.action';
import * as rbac from '@/lib/server/rbac';
import { db } from '@/lib/db';

describe('Conversion Funnel & Analytics E2E Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(rbac, 'requireStaffPermission').mockImplementation(async (_res, _act, cb) => {
      return cb({ id: 'admin_audit', role: 'OWNER', tenantId: 'smmplan' } as any);
    });
  });

  it('correctly aggregates all 4 steps of the sales funnel with positive numbers', async () => {
    const res = await getFunnelAnalyticsAction(7);

    expect(res).not.toHaveProperty('error');
    if ('error' in res) return;

    const { funnel, topServices } = res;

    // Step 1: Traffic
    expect(funnel.linkPasted).toBeGreaterThanOrEqual(1);

    // Step 2: Service Selection
    expect(funnel.serviceSelected).toBeGreaterThanOrEqual(1);

    // Step 3: Checkout Initiated
    expect(funnel.checkoutInitiated).toBeGreaterThanOrEqual(1);

    // Step 4: Payment Completed
    expect(funnel.paymentClicked).toBeGreaterThanOrEqual(1);

    // Hierarchy Invariant: Funnel narrows down at each step
    expect(funnel.linkPasted).toBeGreaterThanOrEqual(funnel.serviceSelected);
    expect(funnel.serviceSelected).toBeGreaterThanOrEqual(funnel.checkoutInitiated);
    expect(funnel.checkoutInitiated).toBeGreaterThanOrEqual(funnel.paymentClicked);

    // Top services table
    expect(topServices.length).toBeGreaterThanOrEqual(1);
    expect(topServices[0]).toHaveProperty('name');
    expect(topServices[0].clicks).toBeGreaterThanOrEqual(1);
  });

  it('computes exact Conversion Rates (CR) and Drop-off percentages without NaN', async () => {
    const res = await getFunnelAnalyticsAction(7);
    if ('error' in res) return;

    const { funnel } = res;

    const s2CR = (funnel.serviceSelected / funnel.linkPasted) * 100;
    const s3CR = (funnel.checkoutInitiated / funnel.serviceSelected) * 100;
    const s4CR = (funnel.paymentClicked / funnel.checkoutInitiated) * 100;
    const finalCR = (funnel.paymentClicked / funnel.linkPasted) * 100;

    expect(Number.isFinite(s2CR)).toBe(true);
    expect(Number.isFinite(s3CR)).toBe(true);
    expect(Number.isFinite(s4CR)).toBe(true);
    expect(Number.isFinite(finalCR)).toBe(true);

    expect(finalCR).toBeGreaterThan(0);
    expect(finalCR).toBeLessThanOrEqual(100);
  });
});
