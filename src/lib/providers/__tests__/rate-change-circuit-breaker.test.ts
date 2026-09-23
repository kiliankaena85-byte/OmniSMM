import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderCircuitBreaker } from '../circuit-breaker';
import { preFlightRateCheck } from '../rate-change-detector';
import { db } from '@/lib/db';

describe('PREM-07: Provider Circuit Breaker & Rate Change Pre-Flight', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('ProviderCircuitBreaker', () => {
    it('initializes in closed state and permits API calls', async () => {
      const cb = new ProviderCircuitBreaker('test_provider_1', 3, 5000);
      await cb.recordSuccess();

      const can = await cb.canCall();
      expect(can).toBe(true);
    });

    it('trips to OPEN state after exceeding failure threshold', async () => {
      const cb = new ProviderCircuitBreaker('test_provider_flaky', 3, 5000);

      await cb.recordFailure();
      await cb.recordFailure();
      expect(await cb.canCall()).toBe(true);

      // 3rd failure trips the breaker
      await cb.recordFailure();
      expect(await cb.canCall()).toBe(false);

      // Success recovers the breaker
      await cb.recordSuccess();
      expect(await cb.canCall()).toBe(true);
    });
  });

  describe('preFlightRateCheck', () => {
    it('blocks fulfillment when rate increase exceeds 20%', async () => {
      vi.spyOn(db.service, 'findUnique').mockResolvedValueOnce({
        id: 'ps_test_1',
        providerId: 'prov_1',
        rate: 15.0, // 15.0 RUB
        markup: 1.5,
      } as any);

      // Expected was 10.0 RUB, but current is 15.0 RUB (+50% increase)
      const res = await preFlightRateCheck({
        providerServiceId: 'ps_test_1',
        expectedRate: 10.0,
        customerPriceRub: 20.0,
      });

      expect(res.ok).toBe(false);
      expect(res.deltaPct).toBe(50);
      expect(res.reason).toContain('вырос на 50.0%');
    });

    it('blocks fulfillment when provider rate exceeds retail customer price (negative margin)', async () => {
      vi.spyOn(db.service, 'findUnique').mockResolvedValueOnce({
        id: 'ps_test_2',
        providerId: 'prov_2',
        rate: 25.0, // Provider charges 25 RUB
        markup: 1.0,
      } as any);

      const res = await preFlightRateCheck({
        providerServiceId: 'ps_test_2',
        expectedRate: 25.0,
        customerPriceRub: 20.0,
      });

      expect(res.ok).toBe(false);
      expect(res.reason).toContain('Отрицательная маржа');
    });

    it('approves fulfillment when rate is within normal margin limits', async () => {
      vi.spyOn(db.service, 'findUnique').mockResolvedValueOnce({
        id: 'ps_test_3',
        providerId: 'prov_3',
        rate: 10.5,
        markup: 2.0,
      } as any);

      const res = await preFlightRateCheck({
        providerServiceId: 'ps_test_3',
        expectedRate: 10.0, // +5% change is well under 20% threshold
        customerPriceRub: 20.0,
      });

      expect(res.ok).toBe(true);
      expect(res.currentRate).toBe(10.5);
    });
  });
});
