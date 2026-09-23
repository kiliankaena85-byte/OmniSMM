import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { POST } from '@/app/api/v2/route';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

import { RateLimitService } from '@/services/core/rate-limit.service';
import { vi } from 'vitest';

describe('Security & Concurrency (Race Conditions)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: any;

  beforeEach(async () => {
    vi.spyOn(RateLimitService, 'checkCustomKey').mockResolvedValue(true);

    const apiKey = `RACE_SECRET_${Date.now()}_${Math.random()}`;
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // 1. Seed user with precisely enough balance for ONLY 1 order
    user = await db.user.create({
      data: {
        email: `race.user.${Date.now()}@test.com`,
        tenantId: 'smmplan',
        apiKeyHash: hashedKey,
        balance: 30000, // 300 RUB
      }
    });
    // Add raw api key property just for tests 
    user.apiKey = apiKey;

    const category = await db.category.create({
      data: { name: 'Race Test Services', tenantId: 'smmplan' }
    });

    // 2. Seed a service with fixed cost
    service = await db.service.create({
      data: {
        name: 'API Service Race',
        tenantId: 'smmplan',
        categoryId: category.id,
        rate: 100 / 95, 
        markup: 3.0,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
        numericId: Math.floor(Math.random() * 800000) + 100000
      }
    });

    const { marketingService } = await import('@/services/marketing.service');
    const pricing = await marketingService.calculatePrice(user.id, service.id, 1000);

    // Set user balance to precisely enough for exactly 1 order
    user = await db.user.update({
      where: { id: user.id },
      data: { balance: pricing.totalCents }
    });
    user.apiKey = apiKey;

    // Disable rate limiting for this user to allow parallel execution test
    await db.rateLimit.deleteMany();
  });

  const makeRequest = async (payload: Record<string, string>) => {
    const searchParams = new URLSearchParams(payload);
    const req = new NextRequest('http://localhost/api/v2', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: searchParams
    });
    return POST(req);
  };

  it('Prevents balance dropping below zero on parallel B2B requests (Double Spend Attack)', async () => {
    // Launch 10 simultaneous requests to buy a 1k item.
    // The user ONLY has enough balance for 1 item (30000 cents).
    
    // Create an array of 50 promises running exactly at the same time
    const promises = Array.from({ length: 50 }).map(() => makeRequest({ 
      key: user.apiKey, 
      action: 'add',
      service: service.numericId.toString(),
      link: 'https://example.com/race',
      quantity: '1000' 
    }));

    const responses = await Promise.all(promises);
    const jsonResults = await Promise.all(responses.map(r => r.json().catch(() => ({}))));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < responses.length; i++) {
      if (responses[i].status === 200 && jsonResults[i].order) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // Only 1 transaction should have succeeded, the rest should fail with INSUFFICIENT_FUNDS
    expect(successCount).toBe(1);
    expect(failCount).toBe(49);

    // Verify DB
    const checkDbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(checkDbUser!.balance).toBe(0n); // 30000 - 30000
    
    // Only 1 order should have been created
    const orders = await db.order.count({ where: { userId: user.id } });
    expect(orders).toBe(1);
  });
});
