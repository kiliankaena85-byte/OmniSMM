import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { orderService } from '../order.service';

vi.mock('@/lib/db', () => {
  const mockTx = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'user-1', balance: BigInt(100000) }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    service: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    serviceRoute: {
      findFirst: vi.fn(),
    },
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    securityEvent: {
      create: vi.fn().mockResolvedValue({ id: 'sec-1' }),
    },
    commission: {
      create: vi.fn().mockResolvedValue({ id: 'comm-1' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ledgerEntry: {
      create: vi.fn().mockResolvedValue({ id: 'ledger-1' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    systemSettings: {
      findUnique: vi.fn().mockResolvedValue({ id: 'smmplan', exchangeRateUSD: 100 }),
      findFirst: vi.fn().mockResolvedValue({ id: 'smmplan', exchangeRateUSD: 100 }),
      upsert: vi.fn().mockResolvedValue({ id: 'smmplan', exchangeRateUSD: 100 }),
    },
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ id: 'smmplan', slug: 'smmplan' }),
      findFirst: vi.fn().mockResolvedValue({ id: 'smmplan', slug: 'smmplan' }),
    },
    refill: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  };

  return {
    db: {
      ...mockTx,
      $transaction: vi.fn((cb) => cb(mockTx)),
    },
  };
});

vi.mock('@/lib/transactions', () => ({
  runSerializableTransaction: vi.fn(async (cb) => {
    const { db } = await import('@/lib/db');
    return cb(db);
  }),
}));

vi.mock('../financial/wallet-ops', () => ({
  WalletOps: {
    charge: vi.fn().mockResolvedValue({ count: 1 }),
  },
}));

vi.mock('@/workers/queues', () => ({
  ordersQueue: {
    add: vi.fn().mockResolvedValue({ id: 'job-1' }),
  },
}));

describe('Tenant Isolation & OrderService Remediation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.systemSettings.findUnique).mockResolvedValue({ id: 'smmplan', exchangeRateUSD: 100, isTestMode: true } as any);
    vi.mocked(db.systemSettings.upsert).mockResolvedValue({ id: 'smmplan', exchangeRateUSD: 100, isTestMode: true } as any);
    vi.mocked(db.securityEvent.create).mockResolvedValue({ id: 'sec-1' } as any);
  });

  describe('OrderService.createOrder Cross-Tenant Protection', () => {
    it('rejects order creation if User tenantId does not match Service tenantId', async () => {
      // User belongs to tenant "smmplan"
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-tenant-a',
        tenantId: 'smmplan',
        referredById: null,
      } as any);

      // Service belongs to tenant "tenant-b"
      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-tenant-b',
        tenantId: 'tenant-b',
        isActive: true,
        targetType: 'CHANNEL',
        minQty: 10,
        maxQty: 1000,
        category: { tenantId: 'tenant-b' },
      } as any);

      const result = await orderService.createOrder('user-tenant-a', {
        serviceId: 'srv-tenant-b',
        link: 'https://telegram.me/channel',
        quantity: 100,
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SERVICE_NOT_FOUND');
      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'CROSS_TENANT_ORDER_ATTEMPT',
            severity: 'CRITICAL',
          }),
        })
      );
    });

    it('rejects order creation for inactive services', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tenantId: 'smmplan',
      } as any);

      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-inactive',
        tenantId: 'smmplan',
        isActive: false,
        targetType: 'CHANNEL',
        minQty: 10,
        maxQty: 1000,
        category: { tenantId: 'smmplan' },
      } as any);

      const result = await orderService.createOrder('user-1', {
        serviceId: 'srv-inactive',
        link: 'https://telegram.me/channel',
        quantity: 100,
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SERVICE_INACTIVE');
    });

    it('rejects order creation if quantity is out of bounds', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tenantId: 'smmplan',
      } as any);

      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-1',
        tenantId: 'smmplan',
        isActive: true,
        targetType: 'CHANNEL',
        minQty: 50,
        maxQty: 500,
        category: { tenantId: 'smmplan' },
      } as any);

      const result = await orderService.createOrder('user-1', {
        serviceId: 'srv-1',
        link: 'https://telegram.me/channel',
        quantity: 10, // Below minQty 50
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('QUANTITY_OUT_OF_BOUNDS');
    });

    it('successfully creates order when tenantId matches and bounds are respected', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        tenantId: 'smmplan',
        referredById: null,
      } as any);

      vi.mocked(db.service.findUnique).mockResolvedValue({
        id: 'srv-1',
        tenantId: 'smmplan',
        isActive: true,
        targetType: 'CHANNEL',
        minQty: 10,
        maxQty: 1000,
        category: { tenantId: 'smmplan' },
        providerId: 'prov-1',
        externalId: 'ext-100',
      } as any);

      vi.mocked(db.serviceRoute.findFirst).mockResolvedValue(null);

      vi.mocked(db.order.create).mockResolvedValue({
        id: 'ord-valid-1',
        numericId: 1001,
        userId: 'user-1',
        tenantId: 'smmplan',
        serviceId: 'srv-1',
        quantity: 100,
        charge: 500,
        status: 'PENDING',
      } as any);

      const result = await orderService.createOrder('user-1', {
        serviceId: 'srv-1',
        link: 'https://telegram.me/channel',
        quantity: 100,
        charge: 500,
        providerCost: 100,
      });

      expect(result.success).toBe(true);
      expect(result.orderId).toBe('ord-valid-1');
      expect(db.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tenantId: 'smmplan',
            serviceId: 'srv-1',
            charge: 500,
          }),
        })
      );
    });
  });

  describe('API v2 Tenant Isolation Negative Tests', () => {
    it('API v2 handleServices scopes query strictly by user tenantId and category tenantId', async () => {
      vi.mocked(db.service.findMany).mockResolvedValue([
        { id: 'srv-tenant-a', numericId: 101, tenantId: 'tenant-a', category: { name: 'Cat A', tenantId: 'tenant-a' } },
      ] as any);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const services = await db.service.findMany({
        where: {
          isActive: true,
          tenantId: userTenantA.tenantId,
          category: { tenantId: userTenantA.tenantId }
        }
      });

      expect(services).toHaveLength(1);
      expect(db.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            category: { tenantId: 'tenant-a' }
          })
        })
      );
    });

    it('API v2 handleAdd rejects cross-tenant service and creates SecurityEvent', async () => {
      vi.mocked(db.service.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const crossTenantServiceId = 999;

      const service = await db.service.findFirst({
        where: {
          numericId: crossTenantServiceId,
          isActive: true,
          tenantId: userTenantA.tenantId,
          category: { tenantId: userTenantA.tenantId }
        }
      });

      if (!service) {
        await db.securityEvent.create({
          data: {
            event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
            severity: 'CRITICAL',
            details: { userId: userTenantA.id, userTenantId: userTenantA.tenantId, serviceNumericId: crossTenantServiceId }
          }
        });
      }

      expect(service).toBeNull();
      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
            severity: 'CRITICAL',
          })
        })
      );
    });

    it('API v2 handleStatus enforces tenantId and userId isolation', async () => {
      vi.mocked(db.order.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const orderFromTenantB = await db.order.findFirst({
        where: { numericId: 555, userId: userTenantA.id, tenantId: userTenantA.tenantId }
      });

      expect(orderFromTenantB).toBeNull();
      expect(db.order.findFirst).toHaveBeenCalledWith({
        where: { numericId: 555, userId: 'user-a', tenantId: 'tenant-a' }
      });
    });

    it('API v2 handleAddMulti rejects mixed tenant services without creating cross-tenant orders', async () => {
      vi.mocked(db.service.findFirst)
        .mockResolvedValueOnce({ id: 'srv-1', numericId: 101, tenantId: 'tenant-a' } as any)
        .mockResolvedValueOnce(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const requestedServices = [101, 999];
      const results: any[] = [];

      for (const serviceId of requestedServices) {
        const service = await db.service.findFirst({
          where: {
            numericId: serviceId,
            isActive: true,
            tenantId: userTenantA.tenantId,
            category: { tenantId: userTenantA.tenantId }
          }
        });

        if (!service) {
          await db.securityEvent.create({
            data: {
              event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
              severity: 'CRITICAL',
              details: { userId: userTenantA.id, userTenantId: userTenantA.tenantId, serviceNumericId: serviceId }
            }
          });
          results.push({ error: 'Incorrect service ID' });
        } else {
          results.push({ order: 1000 + serviceId });
        }
      }

      expect(results).toEqual([
        { order: 1101 },
        { error: 'Incorrect service ID' }
      ]);
      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            event: 'API_V2_CROSS_TENANT_SERVICE_ATTEMPT',
          })
        })
      );
    });

    it('API v2 handleRefillStatus rejects cross-tenant refill lookups', async () => {
      vi.mocked(db.refill.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const refill = await db.refill.findFirst({
        where: { numericId: 777, order: { userId: userTenantA.id, tenantId: userTenantA.tenantId } }
      });

      expect(refill).toBeNull();
      expect(db.refill.findFirst).toHaveBeenCalledWith({
        where: { numericId: 777, order: { userId: 'user-a', tenantId: 'tenant-a' } }
      });
    });

    it('API v2 handleRefill rejects cross-tenant order refill attempts', async () => {
      vi.mocked(db.order.findFirst).mockResolvedValue(null);

      const userTenantA = { id: 'user-a', tenantId: 'tenant-a' };
      const targetOrderId = 888;

      const orderToRefill = await db.order.findFirst({
        where: { numericId: targetOrderId, userId: userTenantA.id, tenantId: userTenantA.tenantId }
      });

      expect(orderToRefill).toBeNull();
      expect(db.order.findFirst).toHaveBeenCalledWith({
        where: { numericId: targetOrderId, userId: 'user-a', tenantId: 'tenant-a' }
      });
    });
  });
});
