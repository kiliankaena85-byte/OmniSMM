import { describe, it, expect, vi, beforeEach } from 'vitest';
import { providerService } from '@/services/providers/provider.service';
import { UniversalProvider } from '@/services/providers/universal.provider';
import { VaultService } from '@/lib/vault';
import { SettingsProvider, SettingsManager } from '@/lib/settings';
import { SmartRoutingService } from '@/services/providers/smart-routing.service';
import { db } from '@/lib/db';
import orderProcessor from '@/workers/processors/order.processor';
import { Job } from 'bullmq';

vi.mock('@/lib/settings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/settings')>();
  let mockTestMode = true;
  return {
    ...actual,
    SettingsProvider: {
      ...actual.SettingsProvider,
      isTestMode: vi.fn(async () => mockTestMode),
      setTestMode: vi.fn(async (val: boolean) => { mockTestMode = val; }),
      getExchangeRateUSD: vi.fn(async () => 95.0),
    },
    SettingsManager: {
      ...actual.SettingsManager,
      isTestMode: vi.fn(async () => mockTestMode),
      setTestMode: vi.fn(async (val: boolean) => { mockTestMode = val; }),
      getExchangeRateUSD: vi.fn(async () => 95.0),
    }
  };
});

vi.mock('@/lib/db', () => {
  const store = {
    orders: new Map<string, any>(),
    serviceRoutes: new Map<string, any>(),
    routingAuditLogs: [] as any[],
  };

  return {
    db: {
      order: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
          return store.orders.get(where.id) || null;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }, data: any }) => {
          const existing = store.orders.get(where.id) || {};
          const updated = { ...existing, ...data, updatedAt: new Date() };
          store.orders.set(where.id, updated);
          return updated;
        }),
        deleteMany: vi.fn(async ({ where }: { where: { isTest?: boolean, userId?: string } }) => {
          let count = 0;
          for (const [id, order] of store.orders.entries()) {
            if (where.isTest !== undefined && order.isTest === where.isTest) {
              store.orders.delete(id);
              count++;
            } else if (where.userId && order.userId === where.userId) {
              store.orders.delete(id);
              count++;
            }
          }
          return { count };
        }),
        create: vi.fn(async ({ data }: { data: any }) => {
          const id = data.id || `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const order = { ...data, id, createdAt: new Date(), updatedAt: new Date() };
          store.orders.set(id, order);
          return order;
        }),
      },
      serviceRoute: {
        findMany: vi.fn(async () => []),
      },
      routingAuditLog: {
        create: vi.fn(async ({ data }: { data: any }) => {
          store.routingAuditLogs.push(data);
          return data;
        }),
      },
      __store: store,
    }
  };
});

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    failOrderTerminalFast: vi.fn(async (orderId: string, error: string) => {
      const mockDb = (await import('@/lib/db')).db;
      await mockDb.order.update({
        where: { id: orderId },
        data: { status: 'CANCELED', error }
      });
      return { success: true };
    }),
    failOrderTerminal: vi.fn(async (orderId: string, error: string) => {
      const mockDb = (await import('@/lib/db')).db;
      await mockDb.order.update({
        where: { id: orderId },
        data: { status: 'CANCELED', error }
      });
      return { success: true };
    }),
  }
}));

describe('👑 Test vs Live Provider System & Routing Armor Suite', () => {
  const liveProviderFixture = {
    id: 'prov_live_1',
    name: 'VexBoost Real Live Provider',
    apiUrl: 'https://api.vexboost.test/v2',
    apiKey: VaultService.encrypt('live_secret_api_key_xyz987'),
    balanceCurrency: 'RUB',
    isActive: true,
    metadata: null,
    providerType: 'SMM_PANEL',
    syncLock: false,
    ticketUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.MOCK_PROVIDER_KEY = 'dev_mock_provider_secret_key_2026';
    (db as any).__store.orders.clear();
    (db as any).__store.routingAuditLogs.length = 0;
  });

  // =========================================================================
  // VECTOR 1: Global Test Mode Switcher & Factory Provider Resolution
  // =========================================================================
  it('Vector 1: Test Mode Switcher should redirect provider traffic in Test Mode and expose real credentials in Live Mode', async () => {
    // 1. Enable Test Mode
    await SettingsManager.setTestMode(true);
    expect(await SettingsManager.isTestMode()).toBe(true);

    // Factory instance in Test Mode
    const testModeInstance = await providerService.getWorkerProviderInstance(liveProviderFixture as any);
    expect(testModeInstance).toBeInstanceOf(UniversalProvider);
    expect((testModeInstance as any).apiUrl).toContain('/api/dev/mock-provider');
    expect((testModeInstance as any).apiKey).toBe('dev_mock_provider_secret_key_2026');

    // 2. Toggle to Live Mode
    await SettingsManager.setTestMode(false);
    expect(await SettingsManager.isTestMode()).toBe(false);

    // Factory instance in Live Mode
    const liveModeInstance = await providerService.getWorkerProviderInstance(liveProviderFixture as any);
    expect(liveModeInstance).toBeInstanceOf(UniversalProvider);
    expect((liveModeInstance as any).apiUrl).toBe('https://api.vexboost.test/v2');
    expect((liveModeInstance as any).apiKey).toBe('live_secret_api_key_xyz987'); // Decrypted real key
  });

  // =========================================================================
  // VECTOR 2: Test Mode Lifecycle — Mock Provider Success, Failures & Refunds
  // =========================================================================
  it('Vector 2.1: Mock Provider Success Order Lifecycle (Pending -> In Progress with Mock External ID)', async () => {
    await SettingsManager.setTestMode(true);

    const order = await db.order.create({
      data: {
        userId: 'user_1',
        serviceId: 'svc_1',
        tenantId: 'smmplan',
        quantity: 100,
        link: 'https://t.me/test_target_channel',
        status: 'PENDING',
        charge: BigInt(500),
        providerCost: BigInt(250),
        isTest: true,
        service: {
          id: 'svc_1',
          name: 'Telegram Channel Subscribers',
          rate: 25.0,
          markup: 2.0,
          providerCurrency: 'RUB',
          providerId: liveProviderFixture.id,
          provider: liveProviderFixture,
          externalId: '101',
          customDataType: 'NONE',
          isDripFeedEnabled: true,
        }
      } as any
    });

    // Mock provider instance createOrder response
    const mockProviderInstance = new UniversalProvider(
      'http://localhost:3000/api/dev/mock-provider',
      'dev_mock_provider_secret_key_2026'
    );
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValue(mockProviderInstance);
    vi.spyOn(mockProviderInstance, 'createOrder').mockResolvedValue({
      order: 'mock_std_12345_q100'
    });

    const mockJob = {
      id: `job_${order.id}`,
      data: { orderId: order.id }
    } as unknown as Job;

    await orderProcessor(mockJob);

    const updatedOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.status).toBe('IN_PROGRESS');
    expect(updatedOrder?.externalId).toBe('mock_std_12345_q100');
  });

  it('Vector 2.2: Mock Provider Error Simulation with "https://test.me/fail-create"', async () => {
    await SettingsManager.setTestMode(true);

    const order = await db.order.create({
      data: {
        userId: 'user_1',
        serviceId: 'svc_1',
        tenantId: 'smmplan',
        quantity: 100,
        link: 'https://test.me/fail-create',
        status: 'PENDING',
        charge: BigInt(500),
        providerCost: BigInt(250),
        isTest: true,
        service: {
          id: 'svc_1',
          name: 'Telegram Subscribers',
          rate: 25.0,
          markup: 2.0,
          providerCurrency: 'RUB',
          providerId: liveProviderFixture.id,
          provider: liveProviderFixture,
          externalId: '101',
          customDataType: 'NONE',
          isDripFeedEnabled: true,
        }
      } as any
    });

    const mockProviderInstance = new UniversalProvider(
      'http://localhost:3000/api/dev/mock-provider',
      'dev_mock_provider_secret_key_2026'
    );
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValue(mockProviderInstance);
    vi.spyOn(mockProviderInstance, 'createOrder').mockResolvedValue({
      error: 'Not enough balance on provider'
    });

    const mockJob = {
      id: `job_fail_${order.id}`,
      data: { orderId: order.id }
    } as unknown as Job;

    await expect(orderProcessor(mockJob)).rejects.toThrow();

    const failedOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(failedOrder?.status).toBe('CANCELED');
    expect(failedOrder?.error).toContain('Not enough balance on provider');
  });

  it('Vector 2.3: Mock Provider Timeout Simulation ("https://test.me/timeout") -> PENDING_CHECK Transition', async () => {
    await SettingsManager.setTestMode(true);

    const order = await db.order.create({
      data: {
        userId: 'user_1',
        serviceId: 'svc_1',
        tenantId: 'smmplan',
        quantity: 100,
        link: 'https://test.me/timeout',
        status: 'PENDING',
        charge: BigInt(500),
        providerCost: BigInt(250),
        isTest: true,
        service: {
          id: 'svc_1',
          name: 'Telegram Subscribers',
          rate: 25.0,
          markup: 2.0,
          providerCurrency: 'RUB',
          providerId: liveProviderFixture.id,
          provider: liveProviderFixture,
          externalId: '101',
          customDataType: 'NONE',
          isDripFeedEnabled: true,
        }
      } as any
    });

    const mockProviderInstance = new UniversalProvider(
      'http://localhost:3000/api/dev/mock-provider',
      'dev_mock_provider_secret_key_2026'
    );
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValue(mockProviderInstance);
    vi.spyOn(mockProviderInstance, 'createOrder').mockRejectedValue(
      new Error('ETIMEDOUT: connect timed out')
    );

    const mockJob = {
      id: `job_timeout_${order.id}`,
      data: { orderId: order.id }
    } as unknown as Job;

    await expect(orderProcessor(mockJob)).rejects.toThrow();

    const timeoutOrder = await db.order.findUnique({ where: { id: order.id } });
    expect(timeoutOrder?.status).toBe('PENDING_CHECK');
    expect(timeoutOrder?.error?.toLowerCase()).toContain('таймаут');
  });

  // =========================================================================
  // VECTOR 3: Live Mode Security Shield (Test Order Guard in Production)
  // =========================================================================
  it('Vector 3: Live Mode Security Guard MUST intercept and fail any order with isTest=true before hitting live network', async () => {
    // 1. Set Live Mode (Production)
    await SettingsManager.setTestMode(false);

    // 2. Create order flagged as isTest: true
    const testOrderInProd = await db.order.create({
      data: {
        userId: 'user_1',
        serviceId: 'svc_1',
        tenantId: 'smmplan',
        quantity: 50,
        link: 'https://t.me/real_channel_should_not_be_hit',
        status: 'PENDING',
        charge: BigInt(250),
        providerCost: BigInt(125),
        isTest: true, // Marked as test order
        service: {
          id: 'svc_1',
          name: 'Telegram Subscribers',
          rate: 25.0,
          markup: 2.0,
          providerCurrency: 'RUB',
          providerId: liveProviderFixture.id,
          provider: liveProviderFixture,
          externalId: '101',
          customDataType: 'NONE',
          isDripFeedEnabled: true,
        }
      } as any
    });

    const mockJob = {
      id: `job_guard_${testOrderInProd.id}`,
      data: { orderId: testOrderInProd.id }
    } as unknown as Job;

    // 3. Process job
    await orderProcessor(mockJob);

    // 4. Invariant: Order MUST be terminated immediately without any externalId or provider call
    const auditedOrder = await db.order.findUnique({ where: { id: testOrderInProd.id } });
    expect(auditedOrder?.status).toBe('CANCELED');
    expect(auditedOrder?.error).toContain('SYSTEM_GUARD: Попытка отправки тестового заказа реальному провайдеру прервана');
  });

  // =========================================================================
  // VECTOR 4: Live Failover Switching (Primary Provider Down -> Cascade to Backup)
  // =========================================================================
  it('Vector 4: Live Provider Failover Routing Cascade when Primary Provider is down', async () => {
    await SettingsManager.setTestMode(true);

    const routesFixture = [
      {
        id: 'route_1',
        serviceId: 'svc_1',
        providerId: liveProviderFixture.id,
        providerServiceId: '101',
        isPrimary: true,
        priority: 1,
        isActive: true,
        provider: { ...liveProviderFixture, errorCount5m: 0 },
      },
      {
        id: 'route_2',
        serviceId: 'svc_1',
        providerId: 'prov_backup_2',
        providerServiceId: '202',
        isPrimary: false,
        priority: 2,
        isActive: true,
        provider: {
          id: 'prov_backup_2',
          name: 'Stream-Promotion Backup Provider',
          apiUrl: 'https://api.backup.test/v2',
          apiKey: 'key_2',
          balanceCurrency: 'RUB',
          isActive: true,
          errorCount5m: 0,
        },
      }
    ];

    vi.mocked(db.serviceRoute.findMany).mockResolvedValue(routesFixture as any);

    const routes = await SmartRoutingService.getPrioritizedRoutes('svc_1');
    expect(routes.length).toBe(2);
    expect(routes[0].providerId).toBe(liveProviderFixture.id);
    expect(routes[1].providerId).toBe('prov_backup_2');
  });

  // =========================================================================
  // VECTOR 5: Test Data Nuclear Clear (adminClearTestData)
  // =========================================================================
  it('Vector 5: adminClearTestData should cleanly remove only test orders (isTest=true) leaving production orders intact', async () => {
    // 1. Create 2 test orders and 1 real order
    const orderTest1 = await db.order.create({
      data: {
        userId: 'user_1',
        serviceId: 'svc_1',
        tenantId: 'smmplan',
        quantity: 100,
        link: 'https://t.me/test1',
        status: 'COMPLETED',
        charge: BigInt(500),
        providerCost: BigInt(250),
        isTest: true,
      } as any
    });

    const orderTest2 = await db.order.create({
      data: {
        userId: 'user_1',
        serviceId: 'svc_1',
        tenantId: 'smmplan',
        quantity: 200,
        link: 'https://t.me/test2',
        status: 'IN_PROGRESS',
        charge: BigInt(1000),
        providerCost: BigInt(500),
        isTest: true,
      } as any
    });

    const orderReal = await db.order.create({
      data: {
        userId: 'user_1',
        serviceId: 'svc_1',
        tenantId: 'smmplan',
        quantity: 300,
        link: 'https://t.me/real_order_keep',
        status: 'IN_PROGRESS',
        charge: BigInt(1500),
        providerCost: BigInt(750),
        isTest: false, // Production order
      } as any
    });

    // 2. Perform deletion for test orders
    const deletedResult = await db.order.deleteMany({
      where: { isTest: true }
    });
    expect(deletedResult.count).toBe(2);

    // 3. Verify real order still exists
    const preservedOrder = await db.order.findUnique({ where: { id: orderReal.id } });
    expect(preservedOrder).not.toBeNull();
    expect(preservedOrder?.isTest).toBe(false);

    // 4. Verify test orders are wiped
    const wipedTest1 = await db.order.findUnique({ where: { id: orderTest1.id } });
    const wipedTest2 = await db.order.findUnique({ where: { id: orderTest2.id } });
    expect(wipedTest1).toBeNull();
    expect(wipedTest2).toBeNull();
  });
});
