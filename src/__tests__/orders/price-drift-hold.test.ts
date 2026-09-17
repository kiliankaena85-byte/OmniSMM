import { describe, it, expect, vi, beforeEach } from 'vitest';
import orderProcessor from '@/workers/processors/order.processor';
import { db } from '@/lib/db';
import { SettingsProvider, SettingsManager } from '@/lib/settings';
import { MarginGuard, SmartRoutingService } from '@/services/providers/smart-routing.service';
import { UnrecoverableError } from 'bullmq';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    serviceRoute: {
      findMany: vi.fn(),
    },
    shadowService: {
      findUnique: vi.fn(),
    },
    routingAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/settings', () => ({
  SettingsProvider: {
    getExchangeRateUSD: vi.fn().mockResolvedValue(100.0),
    getTenantId: vi.fn().mockResolvedValue('smmplan'),
  },
  SettingsManager: {
    isTestMode: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('@/lib/queue-manager', () => ({
  getRedisConnection: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
  }),
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    failOrderTerminalFast: vi.fn().mockResolvedValue(true),
  },
}));

describe('Price Drift Hold Protection Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('intercepts negative margin orders and transitions them into PENDING_CHECK (PRICE_DRIFT_HOLD) without terminal fail/loss', async () => {
    const mockOrder = {
      id: 'order-price-drift-1',
      numericId: 105,
      status: 'PENDING',
      isTest: false,
      isDripFeed: false,
      charge: BigInt(5000), // Client paid 50.00 RUB (5000 kopecks)
      quantity: 1000,
      link: 'https://t.me/test_channel',
      serviceId: 'svc-tg-members',
      externalId: null,
      service: {
        id: 'svc-tg-members',
        name: 'Telegram Подписчики Премиум',
        rate: 1.0, // 1.0 USD per 1000 -> 105 RUB with 5% buffer -> 10500 kopecks (COST > CHARGE!)
        providerCurrency: 'USD',
        providerId: 'prov-1',
        provider: {
          id: 'prov-1',
          name: 'VexBoost USD',
          apiUrl: 'https://api.vexboost.com',
          apiKey: 'secret_key_123',
          isActive: true,
          errorCount5m: 0,
        },
      },
    };

    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as unknown as import('@prisma/client').Order);
    vi.mocked(db.serviceRoute.findMany).mockResolvedValue([
      {
        id: 'route-1',
        serviceId: 'svc-tg-members',
        providerId: 'prov-1',
        providerServiceId: '101',
        isPrimary: true,
        isActive: true,
        priority: 0,
        failoverMode: 'manual',
        provider: mockOrder.service.provider,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as import('@prisma/client').ServiceRoute,
    ]);

    const fakeJob = {
      id: 'job-101',
      data: { orderId: 'order-price-drift-1' },
    } as unknown as import('bullmq').Job;

    // Execution should throw UnrecoverableError with Price Drift Hold
    await expect(orderProcessor(fakeJob)).rejects.toThrow(/Price Drift Hold/);

    // Verify order was transitioned to PENDING_CHECK with PRICE_DRIFT_HOLD marker
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-price-drift-1' },
      data: {
        status: 'PENDING_CHECK',
        error: expect.stringContaining('PRICE_DRIFT_HOLD'),
      },
    });

    // Verify terminal fail-fast with auto-refund was NOT called (preserving operator discretion)
    const { orderService } = await import('@/services/core/order.service');
    expect(orderService.failOrderTerminalFast).not.toHaveBeenCalled();
  });

  it('cascades to a secondary profitable route if primary route suffered price drift', async () => {
    const mockOrder = {
      id: 'order-price-drift-2',
      numericId: 106,
      status: 'PENDING',
      isTest: false,
      isDripFeed: false,
      charge: BigInt(8000), // Client paid 80.00 RUB
      quantity: 1000,
      link: 'https://t.me/test_channel',
      serviceId: 'svc-tg-members',
      externalId: null,
      service: {
        id: 'svc-tg-members',
        name: 'Telegram Подписчики',
        rate: 1.0, // 1.0 USD -> 105 RUB (Unprofitable)
        providerCurrency: 'USD',
        providerId: 'prov-expensive',
        provider: {
          id: 'prov-expensive',
          name: 'Expensive Provider',
          apiUrl: 'https://api.expensive.com',
          apiKey: 'key_1',
          isActive: true,
          errorCount5m: 0,
        },
      },
    };

    const profitableProvider = {
      id: 'prov-cheap',
      name: 'Cheap Provider',
      apiUrl: 'https://api.cheap.com',
      apiKey: 'key_2',
      isActive: true,
      balanceCurrency: 'RUB',
      errorCount5m: 0,
      createOrder: vi.fn().mockResolvedValue({ order: 998877 }),
    };

    vi.mocked(db.order.findUnique).mockResolvedValue(mockOrder as unknown as import('@prisma/client').Order);
    
    // Route 1: Expensive (USD 1.0 = 105 RUB) -> Rejected by MarginGuard
    // Route 2: Cheap (RUB 40 per 1000 = 40 RUB) -> Profitable!
    vi.mocked(db.serviceRoute.findMany).mockResolvedValue([
      {
        id: 'route-expensive',
        serviceId: 'svc-tg-members',
        providerId: 'prov-expensive',
        providerServiceId: '101',
        isPrimary: true,
        isActive: true,
        priority: 0,
        provider: mockOrder.service.provider,
      } as unknown as import('@prisma/client').ServiceRoute,
      {
        id: 'route-cheap',
        serviceId: 'svc-tg-members',
        providerId: 'prov-cheap',
        providerServiceId: '202',
        isPrimary: false,
        isActive: true,
        priority: 1,
        provider: profitableProvider,
      } as unknown as import('@prisma/client').ServiceRoute,
    ]);

    // Mock shadowService for cheap route
    vi.mocked(db.shadowService.findUnique).mockResolvedValue({
      rate: 40.0, // 40 RUB
      dripfeed: true,
      customDataType: 'NONE',
    } as unknown as import('@prisma/client').ShadowService);

    const { providerService } = await import('@/services/providers/provider.service');
    vi.spyOn(providerService, 'getWorkerProviderInstance').mockResolvedValue(profitableProvider as unknown as Awaited<ReturnType<typeof providerService.getWorkerProviderInstance>>);

    const fakeJob = {
      id: 'job-102',
      data: { orderId: 'order-price-drift-2' },
    } as unknown as import('bullmq').Job;

    await orderProcessor(fakeJob);

    // Verify order was dispatched to the cheap route and set to IN_PROGRESS
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-price-drift-2' },
      data: {
        externalId: '998877',
        providerId: 'prov-cheap',
        providerServiceId: '202',
        status: 'IN_PROGRESS',
      },
    });
  });
});
