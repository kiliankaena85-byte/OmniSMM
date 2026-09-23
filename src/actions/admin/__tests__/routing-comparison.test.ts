import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { verifySession } from '@/lib/session';
import { getProviderComparisonData, executeHotSwap } from '@/actions/admin/routing.actions';
// Mock verifySession to control it per test
vi.mock('@/lib/session', async (importOriginal: any) => {
  const actual = await (importOriginal as <T>() => Promise<T>)<typeof import('@/lib/session')>();
  return {
    ...actual,
    verifySession: vi.fn(),
  };
});

describe('Operational Routing: Comparison Matrix & SLA Analytics Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let providerA: any;
  let providerB: any;
  let category: any;
  let service: any;
  let routeA: any;
  let routeB: any;

  beforeEach(async () => {


    // 2. Enable test mode and set USD/RUB rate in systemSettings
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true, exchangeRateUSD: 100.0 },
      create: { id: 'global', isTestMode: true, exchangeRateUSD: 100.0 },
    });

    // 3. Create Admin and Standard Users
    adminUser = await db.user.create({
      data: {
        email: 'admin_routing@smmplan.local',
        role: 'OWNER',
        isActive: true,
      },
    });

    regularUser = await db.user.create({
      data: {
        email: 'regular_routing@smmplan.local',
        role: 'USER',
        isActive: true,
      },
    });

    // 4. Create providers
    providerA = await db.provider.create({
      data: {
        name: 'Provider A (USD)',
        apiUrl: 'http://localhost/api/a',
        apiKey: 'key-a',
        balanceCurrency: 'USD'
      }
    });

    providerB = await db.provider.create({
      data: {
        name: 'Provider B (RUB)',
        apiUrl: 'http://localhost/api/b',
        apiKey: 'key-b',
        balanceCurrency: 'RUB'
      }
    });

    // 5. Create category and service
    const network = await db.network.create({
      data: { name: 'Telegram', slug: 'telegram' }
    });

    category = await db.category.create({
      data: { name: 'TG Views', networkId: network.id }
    });

    service = await db.service.create({
      data: {
        name: 'TG Views Manual Service',
        categoryId: category.id,
        providerId: providerA.id,
        rate: 0.1, // 0.1 USD per 1000
        markup: 3.0, // 300% markup (cost rate * 3)
        minQty: 10,
        maxQty: 10000,
        externalId: 'ext-100'
      }
    });

    // 6. Create service routes
    routeA = await db.serviceRoute.create({
      data: {
        serviceId: service.id,
        providerId: providerA.id,
        providerServiceId: 'ext-100',
        isPrimary: true,
        isActive: true,
        priority: 1,
        failoverMode: 'manual'
      }
    });

    routeB = await db.serviceRoute.create({
      data: {
        serviceId: service.id,
        providerId: providerB.id,
        providerServiceId: 'ext-200',
        isPrimary: false,
        isActive: true,
        priority: 2,
        failoverMode: 'manual'
      }
    });

    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Cleanup all test entities created in beforeEach (each run creates new records)
    if (routeA?.id) await db.serviceRoute.deleteMany({ where: { id: routeA.id } }).catch(() => {});
    if (routeB?.id) await db.serviceRoute.deleteMany({ where: { id: routeB.id } }).catch(() => {});
    if (service?.id) await db.service.deleteMany({ where: { id: service.id } }).catch(() => {});
    if (category?.id) await db.category.deleteMany({ where: { id: category.id } }).catch(() => {});
    // Delete the 'telegram' network only if it was freshly created (may conflict with real one)
    await db.network.deleteMany({ where: { slug: 'telegram', name: 'Telegram', categories: { none: {} } } }).catch(() => {});
    if (providerA?.id) await db.provider.deleteMany({ where: { id: providerA.id } }).catch(() => {});
    if (providerB?.id) await db.provider.deleteMany({ where: { id: providerB.id } }).catch(() => {});
    if (adminUser?.id) await db.user.deleteMany({ where: { id: adminUser.id } }).catch(() => {});
    if (regularUser?.id) await db.user.deleteMany({ where: { id: regularUser.id } }).catch(() => {});
  });

  it('should fail with Forbidden error response if queried by a regular user', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: regularUser.id });

    const result = await getProviderComparisonData(service.id);
    const failureResult = result as { success: false; error: string };
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toContain('Forbidden: Administrator/Staff context required');
  });

  it('should aggregate comparative data successfully with fallback to DB properties for primary route if DB shadow catalog is cold', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // DB shadow catalog is cold (no records seeded)

    const result = await getProviderComparisonData(service.id);
    const successResult = result as { success: true; data: any[] };
    expect(successResult.success).toBe(true);
    const primaryData = successResult.data.find((d: any) => d.routeId === routeA.id);
    const nonPrimaryData = successResult.data.find((d: any) => d.routeId === routeB.id);

    if (!primaryData || !nonPrimaryData) throw new Error('Expected primaryData and nonPrimaryData');

    // Primary route fallback
    expect(primaryData.providerMinQty).toBe(service.minQty);
    expect(primaryData.providerMaxQty).toBe(service.maxQty);
    expect(primaryData.procurementRatePer1kUsd).toBe(0.1);
    expect(primaryData.procurementCostPerUnitUsd).toBe(0.0001); // 0.1 / 1000
    expect(primaryData.procurementCostPerUnitRub).toBeCloseTo(0.01, 2);
    expect(primaryData.limitsMismatch).toBe(false);

    // Non-primary route should have null values for pricing/limits since DB catalog is cold
    expect(nonPrimaryData.providerMinQty).toBeNull();
    expect(nonPrimaryData.procurementRatePer1kUsd).toBeNull();
    expect(nonPrimaryData.limitsMismatch).toBe(false);
  });

  it('should aggregate comparative data successfully using DB shadow catalog and detect limit incompatibilities correctly', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Seed DB with shadow services instead of mocking Redis
    await db.shadowService.createMany({
      data: [
        {
          providerId: providerA.id,
          externalId: 'ext-100',
          name: 'Ext 100 Service Name',
          rate: 0.08,
          rateRub: 8.0, // rate 0.08 * 100 usdRate
          min: 50,
          max: 20000,
          platform: 'telegram',
          normalizedCategory: 'VIEWS'
        },
        {
          providerId: providerB.id,
          externalId: 'ext-200',
          name: 'Ext 200 Service Name',
          rate: 5.0,
          rateRub: 5.0,
          min: 5,
          max: 5000,
          platform: 'telegram',
          normalizedCategory: 'VIEWS'
        }
      ]
    });

    const result = await getProviderComparisonData(service.id);
    const successResult = result as { success: true; data: any[] };
    expect(successResult.success).toBe(true);
    const compA = successResult.data.find((d: any) => d.routeId === routeA.id);
    const compB = successResult.data.find((d: any) => d.routeId === routeB.id);

    if (!compA || !compB) throw new Error('Expected compA and compB');

    // Provider A check
    expect(compA.providerMinQty).toBe(50);
    expect(compA.providerMaxQty).toBe(20000);
    expect(compA.limitsMismatch).toBe(true); // minQty 50 > 10
    expect(compA.procurementRatePer1kUsd).toBe(0.08);

    // Provider B check (currency is RUB)
    expect(compB.providerMinQty).toBe(5);
    expect(compB.providerMaxQty).toBe(5000);
    expect(compB.limitsMismatch).toBe(true); // maxQty 5000 < 10000
    expect(compB.procurementRatePer1kRub).toBe(5.0); // rate was 5.0 RUB
    expect(compB.procurementRatePer1kUsd).toBeCloseTo(0.05, 1);
  });

  it('should calculate SLA and ETA statistics correctly based on orders in the last 7 days', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: adminUser.id });

    // Create completed orders
    const now = new Date();
    const createdAgo5m = new Date(now.getTime() - 5 * 60 * 1000);
    const createdAgo10m = new Date(now.getTime() - 10 * 60 * 1000);

    // 2 Completed orders (A took 300s, B took 600s)
    await db.order.create({
      data: {
        id: 'ord-1',
        serviceId: service.id,
        providerId: providerA.id,
        userId: adminUser.id,
        quantity: 100,
        charge: BigInt(3000),
        providerCost: BigInt(100),
        status: 'COMPLETED',
        link: 'https://t.me/post',
        createdAt: createdAgo5m,
        updatedAt: now
      }
    });

    await db.order.create({
      data: {
        id: 'ord-2',
        serviceId: service.id,
        providerId: providerA.id,
        userId: adminUser.id,
        quantity: 100,
        charge: BigInt(3000),
        providerCost: BigInt(100),
        status: 'COMPLETED',
        link: 'https://t.me/post',
        createdAt: createdAgo10m,
        updatedAt: now
      }
    });

    // 1 Canceled order
    await db.order.create({
      data: {
        id: 'ord-3',
        serviceId: service.id,
        providerId: providerA.id,
        userId: adminUser.id,
        quantity: 100,
        charge: BigInt(3000),
        providerCost: BigInt(100),
        status: 'CANCELED',
        link: 'https://t.me/post',
        createdAt: createdAgo10m,
        updatedAt: now
      }
    });

    // SLA should be successful / totalTerminal = 2 / 3 = 66.67%
    // Avg ETA should be (300 + 600) / 2 = 450s

    const result = await getProviderComparisonData(service.id);
    const successResult = result as { success: true; data: any[] };
    expect(successResult.success).toBe(true);
    const compA = successResult.data.find((d: any) => d.routeId === routeA.id);
    if (!compA) throw new Error('Expected compA');

    expect(compA.sla).toBeCloseTo(66.67, 1);
    expect(compA.avgEtaSeconds).toBe(450);
  });
});
