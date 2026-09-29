/**
 * wave3-order-engine-invariants.test.ts
 * Юнит-тесты на инварианты Волны 3: Order Engine, Drip-Feed Floor, MarginGuard и Idempotency.
 */

import { describe, it, expect, vi } from 'vitest';
import { assertDripFeedFloor, getDripFeedFloorViolation } from '@/services/orders/drip-feed-floor';
import { MarginGuard } from '@/services/providers/smart-routing.service';
import { ProviderIdempotencyGenerator } from '@/services/provider/idempotency-key-generator';
import { SettingsProvider } from '@/lib/settings';

describe('Wave 3 Invariants: Order Engine, Providers & Hot-Swap', () => {
  it('1. Drip-Feed Floor Invariant: Rejects quantity allocations below service.minQty per run', () => {
    // 500 total, 10 runs => 50 per run. If minQty is 100 => Violation!
    const violationRuns = getDripFeedFloorViolation(500, 10, 100, 'runs');
    expect(violationRuns).toContain('Для Drip-feed количество на один запуск (50) не может быть меньше минимального (100)');

    expect(() => assertDripFeedFloor(500, 10, 100, 'runs')).toThrowError(
      /Для Drip-feed количество на один запуск/
    );

    // Smart Drip mode check
    const violationSmart = getDripFeedFloorViolation(300, 5, 100, 'smart');
    expect(violationSmart).toContain('Для Умного Drip-feed количество на 1 день (60) не может быть меньше минимального (100)');

    // Valid allocation: 1000 total, 5 runs => 200 per run >= 100 minQty => Valid!
    expect(getDripFeedFloorViolation(1000, 5, 100, 'runs')).toBeNull();
    expect(() => assertDripFeedFloor(1000, 5, 100, 'runs')).not.toThrow();
  });

  it('2. MarginGuard Hot-Swap Protection: Blocks failover if candidate route produces negative margin', async () => {
    vi.spyOn(SettingsProvider, 'getExchangeRateUSD').mockResolvedValue(100);

    // Client paid 50.00 RUB = 5000 kopecks
    // Quantity = 1000
    // Candidate Provider Rate = $1.00 per 1000 units
    // With 5% currency buffer: Rate in RUB = 1.00 * 100 * 1.05 = 105 RUB = 10500 kopecks
    // 10500 > 5000 => Unprofitable (Loss)
    const unprofitableResult = await MarginGuard.checkMargin(
      5000n, // Client paid 50 RUB
      1000,
      1.0,   // $1.00
      'USD',
      0.05
    );

    expect(unprofitableResult.isProfitable).toBe(false);
    expect(unprofitableResult.reason).toContain('Себестоимость');

    // Candidate Provider Rate = $0.20 per 1000 units
    // Cost in RUB = 0.20 * 100 * 1.05 = 21.00 RUB = 2100 kopecks
    // 2100 <= 5000 => Profitable!
    const profitableResult = await MarginGuard.checkMargin(
      5000n, // Client paid 50 RUB
      1000,
      0.2,   // $0.20
      'USD',
      0.05
    );

    expect(profitableResult.isProfitable).toBe(true);
    expect(profitableResult.costCents).toBe(2100n);
  });

  it('3. Provider Idempotency Generator: Produces deterministic SHA-256 keys and changes on parameter mutation', () => {
    const paramsA = {
      orderId: 'ord-123',
      userId: 'user-456',
      serviceId: 'srv-789',
      link: 'https://t.me/durov',
      quantity: 1000,
      runs: 1,
    };

    const paramsB = {
      orderId: 'ord-123',
      userId: 'user-456',
      serviceId: 'srv-789',
      link: 'https://t.me/durov/', // trailing slash difference
      quantity: 1000,
      runs: 1,
    };

    const keyA = ProviderIdempotencyGenerator.generateKey(paramsA);
    const keyB = ProviderIdempotencyGenerator.generateKey(paramsB);

    // Normalized URLs produce matching keys
    expect(keyA).toBe(keyB);
    expect(keyA).toMatch(/^[a-f0-9]{64}$/);

    // Changing quantity produces a completely new key
    const keyDifferentQty = ProviderIdempotencyGenerator.generateKey({
      ...paramsA,
      quantity: 2000,
    });
    expect(keyDifferentQty).not.toBe(keyA);
  });
});
