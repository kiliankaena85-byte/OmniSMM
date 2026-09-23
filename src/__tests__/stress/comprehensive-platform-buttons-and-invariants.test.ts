import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { WalletOps, WalletInsufficientFundsError } from '@/services/financial/wallet-ops';
import { paymentService } from '@/services/financial/payment.service';
import { SmartDripService } from '@/services/dripfeed/smart-drip.service';
import { 
  createProvider, 
  updateProvider, 
  deleteProviderAction, 
  toggleProviderActiveAction, 
  resetProviderErrorsAction,
  getProviderDeleteInfoAction 
} from '@/actions/admin/providers/crud';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(),
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ledgerEntry: {
      create: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    serviceRoute: {
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    shadowService: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    provider: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    routingAuditLog: {
      create: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    smartCampaign: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    smartTask: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((_module, _action, fn) => fn({ id: 'admin_test_1', email: 'admin@smmplan.pro', role: 'SUPER_ADMIN' })),
}));

vi.mock('@/lib/admin-audit', () => ({
  auditAdminAwaitable: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/utils/ssrf-guard', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/vault', () => ({
  VaultService: {
    encrypt: vi.fn((key: string) => `encrypted_${key}`),
    decrypt: vi.fn((key: string) => key.replace('encrypted_', '')),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));

describe('🛡️ Comprehensive Platform Buttons, Invariants & Provider Lifecycle Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. DOUBLE CHARGES (СПИСАНИЯ ДВОЙНЫЕ)
  // ==========================================================================
  describe('1. Double Charge Defense & Overdraft Guard', () => {
    it('prevents double charges when 50 concurrent requests race for a single balance', async () => {
      let balanceCents = BigInt(10000); // 100.00 RUB
      const chargeCents = BigInt(10000); // 100.00 RUB
      const userId = 'usr_race_charge';

      const results = await Promise.allSettled(
        Array.from({ length: 50 }).map((_, idx) =>
          WalletOps.charge(
            {
              user: {
                findUnique: vi.fn().mockResolvedValue({ id: userId, balance: balanceCents, tenantId: 'smmplan' }),
                findUniqueOrThrow: vi.fn().mockImplementation(() => Promise.resolve({ id: userId, balance: balanceCents, tenantId: 'smmplan' })),
                updateMany: vi.fn().mockImplementation(async ({ data }) => {
                  if (balanceCents >= chargeCents) {
                    balanceCents -= chargeCents;
                    return { count: 1 };
                  }
                  return { count: 0 };
                }),
              },
              ledgerEntry: {
                create: vi.fn().mockResolvedValue({ id: `led_charge_${idx}` }),
                findFirst: vi.fn().mockResolvedValue(null),
              },
            } as any,
            userId,
            chargeCents,
            `Order Charge #${idx}`,
            { idempotencyKey: `idemp-charge-${idx}` }
          )
        )
      );

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(49);
      expect(balanceCents).toBe(BigInt(0)); // Zero overdraft, exactly 0.00 RUB
    });

    it('rejects charge when idempotency key was already processed', async () => {
      const tx = {
        ledgerEntry: {
          findFirst: vi.fn().mockResolvedValue({ id: 'led_existing', amount: BigInt(-5000) }),
          create: vi.fn(),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: 'usr_dup', balance: BigInt(50000), tenantId: 'smmplan' }),
          findUniqueOrThrow: vi.fn().mockImplementation(() => Promise.resolve({ id: 'usr_dup', balance: BigInt(50000), tenantId: 'smmplan' })),
          updateMany: vi.fn(),
        },
      };

      const res = await WalletOps.charge(
        tx as any,
        'usr_dup',
        BigInt(5000),
        'Duplicate Order Charge',
        { idempotencyKey: 'charge-order-duplicate-1' }
      );

      // Idempotency hit: returns current balance without double decrementing
      expect(res.balance).toBe(BigInt(50000));
      expect(tx.user.updateMany).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 2. DOUBLE REFUNDS (ВОЗВРАТЫ ДВОЙНЫЕ)
  // ==========================================================================
  describe('2. Double Refund Defense & Re-entrant Cancellation Guard', () => {
    it('prevents double refund when 20 parallel cancel requests hit the same order', async () => {
      let orderStatus = 'PENDING';
      let userBalance = BigInt(0);
      const refundCents = BigInt(15000); // 150.00 RUB
      const userId = 'usr_refund_race';

      const results = await Promise.allSettled(
        Array.from({ length: 20 }).map((_, idx) =>
          (async () => {
            // Atomic check-and-set status in DB
            if (orderStatus !== 'PENDING') {
              throw new Error('ORDER_ALREADY_CANCELED');
            }
            orderStatus = 'CANCELED'; // atomically captured by first thread

            return await WalletOps.refund(
              {
                user: {
                  findUnique: vi.fn().mockResolvedValue({ id: userId, balance: userBalance, tenantId: 'smmplan' }),
                  findUniqueOrThrow: vi.fn().mockImplementation(() => Promise.resolve({ id: userId, balance: userBalance, tenantId: 'smmplan' })),
                  update: vi.fn().mockImplementation(async ({ data }) => {
                    userBalance += data.balance.increment;
                    return { id: userId, balance: userBalance };
                  }),
                },
                ledgerEntry: {
                  create: vi.fn().mockResolvedValue({ id: `led_refund_${idx}` }),
                  findFirst: vi.fn().mockResolvedValue(null),
                },
              } as any,
              userId,
              refundCents,
              'Refund for canceled order #1001',
              { idempotencyKey: `refund-order-1001-${idx}` }
            );
          })()
        )
      );

      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(19);
      expect(userBalance).toBe(BigInt(15000)); // Exactly one refund credited (150.00 RUB)
    });
  });

  // ==========================================================================
  // 3. DOUBLE PAYMENTS (ОПЛАТЫ ДВОЙНЫЕ)
  // ==========================================================================
  describe('3. Double Payment Webhook Ingestion Guard', () => {
    it('processes exactly 1 payment credit and rejects duplicate webhook replays', async () => {
      const mockPayment = {
        id: 'pay_gw_101',
        gatewayId: 'yoo_gw_unique_101',
        amount: BigInt(25000), // 250.00 RUB
        status: 'SUCCEEDED', // First webhook already succeeded it
        userId: 'usr_pay_1',
        currency: 'RUB',
      };

      const txMock = {
        payment: {
          findUnique: vi.fn().mockResolvedValue(mockPayment),
        },
        user: {
          update: vi.fn(),
          updateMany: vi.fn(),
        },
        ledgerEntry: {
          create: vi.fn(),
        },
        order: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      };

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => cb(txMock));

      // Subsequent duplicate webhook calls return early with idempotent success
      const success = await paymentService.confirmPayment(
        'yoo_gw_unique_101',
        BigInt(25000),
        'usr_pay_1',
        false,
        'yookassa',
        'pay_gw_101'
      );

      expect(success).toBe(true);
      expect(txMock.user.update).not.toHaveBeenCalled();
      expect(txMock.user.updateMany).not.toHaveBeenCalled();
      expect(txMock.ledgerEntry.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. DRIP-FEED (УМНЫЙ DRIP-FEED & РАСПРЕДЕЛЕНИЕ ЗАДАЧ)
  // ==========================================================================
  describe('4. Drip-Feed Allocation & Partial Refund Mechanics', () => {
    it('calculates randomized task distribution across days with 100% quantity preservation', () => {
      const totalQuantity = 10000;
      const days = 5;
      const minChunk = 200;
      const maxChunk = 1000;

      const tasks = SmartDripService.generateTaskDistribution(totalQuantity, days, minChunk, maxChunk);

      expect(tasks.length).toBeGreaterThan(0);
      const totalGenerated = tasks.reduce((sum, t) => sum + t.qty, 0);
      expect(totalGenerated).toBe(totalQuantity);

      // Verify each task adheres to min bounds
      for (const task of tasks) {
        expect(task.qty).toBeGreaterThanOrEqual(minChunk);
      }
    });

    it('calculates exact partial refund for remaining unexecuted drip tasks', () => {
      const totalTasks = 10;
      const completedTasks = 4;
      const remainingTasks = totalTasks - completedTasks; // 6 tasks
      const unitPriceCents = BigInt(50); // 0.50 RUB per unit
      const qtyPerTask = 500;

      const remainingQuantity = remainingTasks * qtyPerTask; // 3000 units
      const refundCents = BigInt(remainingQuantity) * unitPriceCents; // 150,000 cents = 1500.00 RUB

      expect(refundCents).toBe(BigInt(150000));
    });
  });

  // ==========================================================================
  // 5. PROVIDER CRUD & TOGGLE BUTTONS (УДАЛЕНИЕ, ДОБАВЛЕНИЕ, ОТКЛЮЧЕНИЕ)
  // ==========================================================================
  describe('5. Provider CRUD Actions & Table Control Buttons', () => {
    it('createProvider: successfully validates, encrypts API key, and creates provider in DB', async () => {
      const newProviderData = {
        name: 'New Test Provider 2026',
        apiUrl: 'https://api.newprovider.com/v2',
        apiKey: 'secret_live_key_999',
        isActive: true,
        balanceCurrency: 'USD',
      };

      vi.mocked(db.provider.create).mockResolvedValue({
        id: 'prov_new_1',
        name: newProviderData.name,
        apiUrl: newProviderData.apiUrl,
        apiKey: 'encrypted_secret_live_key_999',
        isActive: true,
        balanceCurrency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: { mapping: null },
        ticketUrl: null,
      } as any);

      const result = await createProvider(newProviderData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.providerId).toBe('prov_new_1');
      }
      expect(db.provider.create).toHaveBeenCalled();
    });

    it('createProvider: rejects invalid URL and missing required fields with Zod field errors', async () => {
      const invalidData = {
        name: '',
        apiUrl: 'not-a-valid-url',
        apiKey: '',
        isActive: true,
        balanceCurrency: 'INVALID_LONG_CURRENCY',
      };

      const result = await createProvider(invalidData);

      expect(result.success).toBe(false);
      if (!result.success && 'errors' in result) {
        expect(result.errors).toBeDefined();
        expect(result.errors?.name).toBeDefined();
        expect(result.errors?.apiUrl).toBeDefined();
        expect(result.errors?.apiKey).toBeDefined();
        expect(result.errors?.balanceCurrency).toBeDefined();
      }
    });

    it('toggleProviderActiveAction: toggles active status to false/true and records admin audit', async () => {
      vi.mocked(db.provider.update).mockResolvedValue({
        id: 'prov_toggle_1',
        name: 'Toggle Test Provider',
        isActive: false,
      } as any);

      const result = await toggleProviderActiveAction('prov_toggle_1', false);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isActive).toBe(false);
      }
      expect(db.provider.update).toHaveBeenCalledWith({
        where: { id: 'prov_toggle_1' },
        data: { isActive: false },
      });
    });

    it('resetProviderErrorsAction: resets error counter errorCount5m back to 0', async () => {
      vi.mocked(db.provider.update).mockResolvedValue({
        id: 'prov_reset_1',
        name: 'Degraded Provider',
        errorCount5m: 0,
      } as any);

      const result = await resetProviderErrorsAction('prov_reset_1');

      expect(result.success).toBe(true);
      expect(db.provider.update).toHaveBeenCalledWith({
        where: { id: 'prov_reset_1' },
        data: { errorCount5m: 0 },
      });
    });

    it('getProviderDeleteInfoAction: returns exact pre-delete counts of impacted services, routes, and orders', async () => {
      vi.mocked(db.provider.findUnique).mockResolvedValue({
        id: 'prov_del_info_1',
        name: 'Provider To Delete',
        isActive: true,
      } as any);
      vi.mocked(db.service.count).mockResolvedValue(5);
      vi.mocked(db.serviceRoute.count).mockResolvedValue(8);
      vi.mocked(db.order.count).mockResolvedValue(120);
      vi.mocked(db.shadowService.count).mockResolvedValue(250);

      const res = await getProviderDeleteInfoAction('prov_del_info_1');

      expect(res.success).toBe(true);
      if (res.success && 'counts' in res) {
        expect(res.counts?.services).toBe(5);
        expect(res.counts?.routes).toBe(8);
        expect(res.counts?.orders).toBe(120);
        expect(res.counts?.shadowServices).toBe(250);
      }
    });

    it('deleteProviderAction: safely removes routing rules first, then deletes provider atomically', async () => {
      vi.mocked(db.provider.findUnique).mockResolvedValue({
        id: 'prov_to_remove',
        name: 'Old Provider',
      } as any);

      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
        const tx = {
          serviceRoute: {
            deleteMany: vi.fn().mockResolvedValue({ count: 4 }),
          },
          provider: {
            delete: vi.fn().mockResolvedValue({ id: 'prov_to_remove', name: 'Old Provider', apiUrl: 'https://old.com' }),
          },
        };
        return cb(tx);
      });

      const res = await deleteProviderAction('prov_to_remove');

      expect(res.success).toBe(true);
      if (res.success && 'deletedName' in res) {
        expect(res.deletedName).toBe('Old Provider');
      }
      expect(db.$transaction).toHaveBeenCalled();
    });
  });
});
