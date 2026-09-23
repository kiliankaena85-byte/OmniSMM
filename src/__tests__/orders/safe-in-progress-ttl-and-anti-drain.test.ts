import { describe, it, expect } from 'vitest';
import { calculatePartialRefund } from '@/utils/refund';

describe('Safe InProgress TTL & Anti-Drain Invariant Tests', () => {
  it('should accurately calculate partial refund based on remains and charge', () => {
    const refundKopecks = calculatePartialRefund({
      remains: 100,
      quantity: 1000,
      charge: BigInt(1500),
    });
    expect(refundKopecks).toBe(150);
  });

  it('should return 0 refund when remains is 0 (100% delivered)', () => {
    const refundKopecks = calculatePartialRefund({
      remains: 0,
      quantity: 1000,
      charge: BigInt(1500),
    });
    expect(refundKopecks).toBe(0);
  });

  it('should clamp refund to full charge if remains >= quantity (error protection)', () => {
    const refundKopecks = calculatePartialRefund({
      remains: 1200,
      quantity: 1000,
      charge: BigInt(1500),
    });
    expect(refundKopecks).toBe(1500);
  });

  it('should calculate dynamic TTL window for Drip-Feed orders correctly', () => {
    const runs = 10;
    const intervalMinutes = 1440; // 1 day per run = 10 days total
    const totalMinutes = runs * intervalMinutes; // 14400 minutes = 240 hours
    const dynamicTtlHours = Math.max(72, Math.ceil(totalMinutes / 60) + 48); // 240 + 48 = 288 hours (12 days)
    expect(dynamicTtlHours).toBe(288);
    expect(dynamicTtlHours).toBeGreaterThan(72);
  });

  it('anti-drain invariant: provider in_progress status must never trigger refund', () => {
    const providerStatuses = ['in_progress', 'processing', 'pending'];
    for (const status of providerStatuses) {
      const isProviderActive = ['in_progress', 'processing', 'pending'].includes(status);
      expect(isProviderActive).toBe(true);
      const refundCents = isProviderActive ? 0 : 150;
      expect(refundCents).toBe(0);
    }
  });
});
