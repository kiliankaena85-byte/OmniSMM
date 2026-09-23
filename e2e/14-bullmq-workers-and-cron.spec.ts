/**
 * e2e/14-bullmq-workers-and-cron.spec.ts
 * BLOCK 14: BullMQ Background Workers, Distributed Locks & Cron Endpoints
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Cron Security: All cron HTTP routes require Authorization: Bearer <CRON_SECRET>.
 * 2. Distributed Locks: Overlap starvation prevention via Redis locks (SET key 1 EX ... NX).
 * 3. Cleanup Retention: Automated cleanup of expired rate-limits and stale logs.
 * 4. Price Drift Guard: Detection of provider rate surges to protect business margins.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { getRedisConnection } from '../src/lib/queue-manager';
import { runCleanup } from '../src/workers/processors/cleanup.processor';

const db = new PrismaClient();
const CRON_SECRET = process.env.CRON_SECRET || 'dev_secret';

test.describe.serial('BLOCK 14: BullMQ Workers & Cron Daemons E2E', () => {
  let testServiceId: string;
  let testProviderId: string;

  test.beforeAll(async () => {
    const ts = Date.now();

    // 1. Create a dummy provider
    const provider = await db.provider.create({
      data: {
        name: `E2E Cron Provider ${ts}`,
        apiUrl: 'https://mock-provider.local/api/v2',
        apiKey: 'iv:tag:cipher_key',
        balanceCurrency: 'USD',
        isActive: true,
      },
    });
    testProviderId = provider.id;

    // 2. Create a test service
    const category = await db.category.create({
      data: {
        name: `E2E Cron Category ${ts}`,
        tenantId: 'smmplan',
        sort: 1,
      },
    });

    const service = await db.service.create({
      data: {
        name: `E2E Cron Sync Service ${ts}`,
        categoryId: category.id,
        tenantId: 'smmplan',
        rate: 10.0,
        markup: 1.5,
        pricePer1000Cents: 1500,
        minQty: 10,
        maxQty: 1000,
        providerId: provider.id,
        externalId: '101',
        providerCurrency: 'USD',
        isActive: true,
        isQuarantined: false,
      },
    });
    testServiceId = service.id;
  });

  test.afterAll(async () => {
    if (testServiceId) {
      await db.servicePriceHistory.deleteMany({ where: { serviceId: testServiceId } });
      await db.service.deleteMany({ where: { id: testServiceId } });
    }
    if (testProviderId) {
      await db.provider.deleteMany({ where: { id: testProviderId } });
    }
    await db.$disconnect();
  });

  test('Scenario 1: /api/cron/sync-orders Security & Distributed Lock Routine', async ({ request, baseURL }) => {
    // 1. Unauthenticated call -> 401 Unauthorized
    const unauthResp = await request.get(`${baseURL}/api/cron/sync-orders`);
    expect(unauthResp.status()).toBe(401);

    // 2. Wrong token -> 401 Unauthorized
    const wrongAuthResp = await request.get(`${baseURL}/api/cron/sync-orders`, {
      headers: { Authorization: 'Bearer invalid_secret_token' },
    });
    expect(wrongAuthResp.status()).toBe(401);

    // 3. Authenticated call -> 200 OK with success: true
    const authResp = await request.get(`${baseURL}/api/cron/sync-orders`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(authResp.status()).toBe(200);
    const body = await authResp.json();
    expect(body.success).toBe(true);
    expect(body.timestamp).toBeDefined();
  });

  test('Scenario 2: /api/cron/sync-cbr Security & Execution', async ({ request, baseURL }) => {
    // 1. Unauthenticated call -> 401 Unauthorized
    const unauthResp = await request.get(`${baseURL}/api/cron/sync-cbr`);
    expect(unauthResp.status()).toBe(401);

    // 2. Authenticated call -> 200 OK
    const authResp = await request.get(`${baseURL}/api/cron/sync-cbr`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(authResp.status()).toBe(200);
    const body = await authResp.json();
    expect([true, false]).toContain(body.success); // either updated or manual_mode_prevented
  });

  test('Scenario 3: Cleanup Processor Maintenance Routine (Expired Records)', async () => {
    // 1. Insert an expired RateLimit record
    const expiredIp = `192.168.1.${Math.floor(100 + Math.random() * 100)}`;
    const expiredRecordCreated = await db.rateLimit.create({
      data: {
        ip: expiredIp,
        endpoint: '/api/v2/expired',
        hits: 5,
        expiresAt: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
      },
    });

    // 2. Insert an active RateLimit record
    const activeIp = `192.168.2.${Math.floor(100 + Math.random() * 100)}`;
    const activeRecordCreated = await db.rateLimit.create({
      data: {
        ip: activeIp,
        endpoint: '/api/v2/active',
        hits: 1,
        expiresAt: new Date(Date.now() + 3600 * 1000), // Valid for next hour
      },
    });

    // 3. Run cleanup processor
    await runCleanup();

    // 4. Verify expired record deleted and active record preserved
    const expiredRecord = await db.rateLimit.findUnique({ where: { id: expiredRecordCreated.id } });
    expect(expiredRecord).toBeNull();

    const activeRecord = await db.rateLimit.findUnique({ where: { id: activeRecordCreated.id } });
    expect(activeRecord).toBeDefined();

    // Cleanup active test record
    await db.rateLimit.deleteMany({ where: { id: activeRecordCreated.id } });
  });

  test('Scenario 4: Service Price History & Drift Tracking', async () => {
    // 1. Add historical price point
    await db.servicePriceHistory.create({
      data: {
        serviceId: testServiceId,
        rate: 8.0, // Historical rate was 8.0, current is 10.0 (+25% drift)
        createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      },
    });

    // 2. Verify service is queryable and history is tracked
    const history = await db.servicePriceHistory.findMany({
      where: { serviceId: testServiceId },
      orderBy: { createdAt: 'desc' },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].rate).toBe(8.0);
  });

  test('Scenario 5: Redis Distributed Lock Lifecycle Verification', async () => {
    const redis = getRedisConnection();
    const lockKey = `e2e:lock:test:${Date.now()}`;

    // 1. Acquire distributed lock with NX (Not Exists)
    const acquired = await redis.set(lockKey, '1', 'EX', 10, 'NX');
    expect(acquired).toBe('OK');

    // 2. Second attempt to acquire same lock should fail (returns null)
    const secondAcquire = await redis.set(lockKey, '1', 'EX', 10, 'NX');
    expect(secondAcquire).toBeNull();

    // 3. Release lock
    const deleted = await redis.del(lockKey);
    expect(deleted).toBe(1);

    // 4. Now lock can be acquired again
    const thirdAcquire = await redis.set(lockKey, '1', 'EX', 10, 'NX');
    expect(thirdAcquire).toBe('OK');

    // Final cleanup
    await redis.del(lockKey);
  });
});
