import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculatePriceAction } from '@/actions/order/checkout';
import { db } from '@/lib/db';
import { marketingService } from '@/services/marketing.service';

describe('Security: Data Leak Prevention (Trust Boundaries)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calculatePriceAction must NOT leak providerCostCents or markup to the client', async () => {
    // 1. Mock DB service
    vi.spyOn(db.service, 'findUnique').mockResolvedValue({
      id: 'test-service',
      isActive: true,
      name: 'Test Service',
      // ... other fields are irrelevant for the mock as they aren't used deeply here
    } as any);

    // 2. Mock marketing service to return a leak-prone result
    vi.spyOn(marketingService, 'calculatePrice').mockResolvedValue({
      totalCents: 10000,
      originalTotalCents: 10000,
      discountCents: 0,
      discountPercent: 0,
      safetyFloorCents: 6000,
      tier: 'REGULAR',
      providerCostCents: 2000, // HIGHLY CONFIDENTIAL: Buy price
    });

    // 3. Call the action
    const res = await calculatePriceAction('test-service', 100);

    // 4. Assert success
    expect(res.success).toBe(true);

    // 5. ASSERT NO LEAKS
    expect(res.data).toBeDefined();
    
    // The client should know what they are paying
    expect(res.data?.totalCents).toBe(10000);
    
    // The client MUST NEVER know what we are paying
    expect((res.data as any).providerCostCents).toBeUndefined();
    expect((res.data as any).markup).toBeUndefined();
  });
});
