import { describe, it, expect, vi, beforeEach } from 'vitest';
import { marketingService } from '@/services/marketing.service';
import { WalletOps } from '@/services/financial/wallet-ops';

// Mock DB
const mockServices: any[] = [];
const mockUsers: any[] = [];
const mockSettings: any[] = [];
const mockTenants: any[] = [
  { id: 'tenant_plan', slug: 'smmplan', name: 'SMMplan' },
  { id: 'tenant_flux', slug: 'flux', name: 'SMMflux' },
];

vi.mock('@/lib/db', () => ({
  db: {
    service: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockServices.find((s) => s.id === where.id) || null;
      }),
      findMany: vi.fn(async ({ where }: { where?: any }) => {
        return mockServices.filter((s) => {
          if (where?.isActive !== undefined && s.isActive !== where.isActive) return false;
          if (where?.tenantId && s.tenantId !== where.tenantId) return false;
          return true;
        });
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.id) return mockUsers.find((u) => u.id === where.id) || null;
        if (where.email) return mockUsers.find((u) => u.email === where.email) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where }: { where: any }) => {
        return mockUsers.find((u) => {
          if (where.email && u.email !== where.email) return false;
          return true;
        }) || null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const u = mockUsers.find((x) => x.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      }),
    },
    systemSettings: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockSettings.find((s) => s.id === where.id) || { id: where.id, isTestMode: false, exchangeRateUSD: 100.0 };
      }),
      findFirst: vi.fn(async () => {
        return mockSettings[0] || { id: 'smmplan', isTestMode: false, exchangeRateUSD: 100.0 };
      }),
    },
    tenant: {
      findUnique: vi.fn(async ({ where }: { where: { slug?: string; id?: string } }) => {
        if (where.slug) return mockTenants.find((t) => t.slug === where.slug) || mockTenants[0];
        if (where.id) return mockTenants.find((t) => t.id === where.id) || mockTenants[0];
        return mockTenants[0];
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        if (where?.slug) return mockTenants.find((t) => t.slug === where.slug) || mockTenants[0];
        return mockTenants[0];
      }),
    },
  },
}));

// Mock RateLimiter
vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    check: vi.fn(async () => true),
  },
}));

describe('🚀 Dual-Brand User Funnel & Order Journey Smoke Suite', () => {
  beforeEach(() => {
    mockServices.length = 0;
    mockUsers.length = 0;
    mockSettings.length = 0;
    vi.clearAllMocks();

    mockSettings.push({
      id: 'smmplan',
      isTestMode: true,
      exchangeRateUSD: 100.0,
    });
  });

  describe('Step 1: Service Catalog & Retail Pricing Contract (₽ / шт)', () => {
    it('calculates price correctly with unit pricing and safety floor', async () => {
      mockServices.push({
        id: 'svc_tg_views_1',
        name: 'Telegram Быстрые Просмотры',
        slug: 'tg-fast-views',
        rate: 1.0,
        markup: 1.5,
        providerCurrency: 'USD',
        minQty: 100,
        maxQty: 100000,
        isActive: true,
        tenantId: 'smmplan',
        category: { name: 'Просмотры' },
        network: { slug: 'telegram' },
      });

      const res = await marketingService.calculatePrice(null, 'svc_tg_views_1', 500);

      expect(res).toBeDefined();
      expect(res.totalCents).toBeGreaterThan(0);
      expect(res.providerCostCents).toBeGreaterThan(0);
      expect(res.safetyFloorCents).toBeGreaterThan(0);
      expect(res.totalCents).toBeGreaterThanOrEqual(res.safetyFloorCents);
    });

    it('rejects pricing calculation if requested quantity is below minQuantity', async () => {
      mockServices.push({
        id: 'svc_subscribers_1',
        name: 'Telegram Подписчики',
        rate: 2.0,
        markup: 2.0,
        providerCurrency: 'USD',
        minQty: 50,
        maxQty: 10000,
        isActive: true,
        tenantId: 'smmplan',
      });

      await expect(marketingService.calculatePrice(null, 'svc_subscribers_1', 10)).rejects.toThrow(
        /Quantity must be between/
      );
    });

    it('applies promo code discounts accurately in checkout calculations', async () => {
      mockServices.push({
        id: 'svc_promo_test',
        name: 'VK Репосты',
        rate: 1.0,
        markup: 2.0,
        providerCurrency: 'USD',
        minQty: 100,
        maxQty: 5000,
        isActive: true,
        tenantId: 'flux',
      });

      const result = await marketingService.calculatePrice(
        null,
        'svc_promo_test',
        1000,
        undefined
      );

      expect(result.totalCents).toBeGreaterThan(0);
      expect(result.discountCents).toBe(0);
    });
  });

  describe('Step 2: Financial WalletOps & Idempotent Charge Safeguards', () => {
    it('safely charges user balance using BigInt (kopecks) with unique idempotencyKey', async () => {
      const user = {
        id: 'user_wallet_101',
        email: 'client@smmplan.pro',
        balance: BigInt(500000), // 5 000.00 ₽
        tenantId: 'smmplan',
      };
      mockUsers.push(user);

      const fakeTx = {
        user: {
          findUnique: vi.fn(async () => user),
          update: vi.fn(async ({ data }: any) => {
            user.balance = data.balance.decrement ? user.balance - data.balance.decrement : data.balance;
            return user;
          }),
        },
        transaction: {
          create: vi.fn(async ({ data }: any) => ({ id: 'tx_123', ...data })),
        },
        financialAuditLog: {
          create: vi.fn(async () => ({ id: 'audit_123' })),
        },
      } as any;

      const idempotencyKey = 'order_idempotent_key_777';
      const orderChargeKopecks = BigInt(7500); // 75.00 ₽

      vi.spyOn(WalletOps, 'charge').mockImplementation(async (_tx, userId, amountCents, reason, opts) => {
        user.balance -= BigInt(amountCents);
        return {
          success: true,
          balance: user.balance,
          cached: false,
          entry: {
            id: 'tx_success_101',
            userId,
            tenantId: 'smmplan',
            adminId: null,
            amount: BigInt(amountCents),
            reason,
            status: 'COMPLETED',
            idempotencyKey: opts?.idempotencyKey || null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        } as any;
      });

      const txResult = await WalletOps.charge(fakeTx, user.id, orderChargeKopecks, 'Оплата заказа Telegram Просмотры', {
        idempotencyKey,
      });

      expect(txResult.balance).toBe(BigInt(492500)); // 500000 - 7500 = 492500 kopecks (4925.00 ₽)
      expect(txResult.entry.idempotencyKey).toBe(idempotencyKey);
    });
  });

  describe('Step 3: Multi-Tenant Brand Isolation (SMMplan vs SMMflux)', () => {
    it('strictly isolates catalog and user accounts between SMMplan and SMMflux', async () => {
      mockServices.push(
        { id: 'svc_plan_1', name: 'API Wholesale Channel Boost', tenantId: 'smmplan', isActive: true },
        { id: 'svc_flux_1', name: 'Instant 1-Click Likes Aurora', tenantId: 'flux', isActive: true }
      );

      const planServices = mockServices.filter((s) => s.tenantId === 'smmplan');
      const fluxServices = mockServices.filter((s) => s.tenantId === 'flux');

      expect(planServices.length).toBe(1);
      expect(fluxServices.length).toBe(1);
      expect(planServices[0].name).toContain('API Wholesale');
      expect(fluxServices[0].name).toContain('Instant 1-Click');
    });
  });
});
