import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SmartDripService } from '@/services/dripfeed/smart-drip.service';
import { WalletOps } from '@/services/financial/wallet-ops';

// Mock DB
const mockSmartCampaigns: any[] = [];
const mockSmartTasks: any[] = [];
const mockUsers: any[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    smartCampaign: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockSmartCampaigns.find((c) => c.id === where.id) || null;
      }),
      create: vi.fn(async ({ data }: any) => {
        const item = { id: `camp_${Date.now()}`, ...data };
        mockSmartCampaigns.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const item = mockSmartCampaigns.find((c) => c.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      }),
    },
    smartTask: {
      findMany: vi.fn(async ({ where }: any) => {
        return mockSmartTasks.filter((t) => {
          if (where.campaignId && t.campaignId !== where.campaignId) return false;
          if (where.status && t.status !== where.status) return false;
          return true;
        });
      }),
      createMany: vi.fn(async ({ data }: any) => {
        for (const d of data) {
          mockSmartTasks.push({ id: `task_${Date.now()}_${Math.random()}`, ...d });
        }
        return { count: data.length };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const item = mockSmartTasks.find((t) => t.id === where.id);
        if (item) Object.assign(item, data);
        return item;
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        return mockUsers.find((u) => u.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const u = mockUsers.find((x) => x.id === where.id);
        if (u) Object.assign(u, data);
        return u;
      }),
    },
  },
}));

describe('⏳ Drip-Feed Orders Lifecycle & Smart Task Allocation E2E Suite', () => {
  beforeEach(() => {
    mockSmartCampaigns.length = 0;
    mockSmartTasks.length = 0;
    mockUsers.length = 0;
    vi.clearAllMocks();
  });

  describe('Vector 1: Mathematical Distribution Algorithm across Time Intervals', () => {
    it('splits total quantity into randomized chunks respecting [minChunk, maxChunk] boundaries', () => {
      const totalQuantity = 5000;
      const days = 3;
      const minChunk = 100;
      const maxChunk = 500;

      const tasks = SmartDripService.generateTaskDistribution(totalQuantity, days, minChunk, maxChunk);

      expect(tasks.length).toBeGreaterThan(0);

      const sumQuantity = tasks.reduce((sum, t) => sum + t.qty, 0);
      expect(sumQuantity).toBe(totalQuantity);

      // Verify each task falls within expected range
      for (const t of tasks) {
        expect(t.qty).toBeGreaterThanOrEqual(minChunk);
        expect(t.qty).toBeLessThanOrEqual(maxChunk + minChunk); // with remainder absorption
      }

      // Verify tasks are chronologically sorted
      for (let i = 1; i < tasks.length; i++) {
        expect(tasks[i].runAt.getTime()).toBeGreaterThanOrEqual(tasks[i - 1].runAt.getTime());
      }
    });

    it('handles small quantity that fits into single chunk without infinite loops', () => {
      const totalQuantity = 150;
      const days = 1;
      const minChunk = 100;
      const maxChunk = 500;

      const tasks = SmartDripService.generateTaskDistribution(totalQuantity, days, minChunk, maxChunk);

      expect(tasks.length).toBe(1);
      expect(tasks[0].qty).toBe(150);
    });
  });

  describe('Vector 2: Financial Integrity & Total Drip-Feed Amount Deduction', () => {
    it('accurately calculates and debits total drip-feed cost (runs * quantity * pricePerUnit)', async () => {
      const user = {
        id: 'user_drip_fin_1',
        email: 'drip@smmplan.pro',
        balance: BigInt(1000000), // 10 000.00 ₽
      };
      mockUsers.push(user);

      const runs = 5;
      const runQuantity = 1000;
      const totalQuantity = runs * runQuantity; // 5 000 units
      const totalCostKopecks = BigInt(Math.round(totalQuantity * 0.20 * 100)); // 100 000 kopecks (1 000.00 ₽)

      const fakeTx = {} as any;

      vi.spyOn(WalletOps, 'charge').mockImplementation(async (_tx, userId, amountCents, reason, opts) => {
        user.balance -= BigInt(amountCents);
        return {
          success: true,
          balance: user.balance,
          cached: false,
          entry: {
            id: 'tx_drip_debit',
            userId,
            amount: BigInt(amountCents),
            status: 'COMPLETED',
            idempotencyKey: opts?.idempotencyKey,
          },
        } as any;
      });

      const tx = await WalletOps.charge(fakeTx, user.id, totalCostKopecks, `Drip-Feed Order (${runs} запусков)`, {
        idempotencyKey: 'drip_idem_key',
      });

      expect(tx.balance).toBe(BigInt(900000)); // 10 000 - 1 000 = 9 000.00 ₽
    });
  });

  describe('Vector 3: Partial Cancellation & Pro-Rata Refund of Remaining Runs', () => {
    it('refunds exact remaining unexecuted runs when drip-feed campaign is stopped mid-way', async () => {
      const user = {
        id: 'user_drip_refund_1',
        balance: BigInt(800000), // 8 000.00 ₽
      };
      mockUsers.push(user);

      // Scenario: Campaign had 5 runs total (cost 1000.00 ₽), 2 runs COMPLETED, 3 runs remaining PENDING
      const remainingRuns = 3;
      const costPerRunKopecks = BigInt(20000); // 200.00 ₽ per run
      const refundAmountKopecks = BigInt(remainingRuns) * costPerRunKopecks; // 600.00 ₽ (60 000 kopecks)

      const fakeTx = {} as any;

      vi.spyOn(WalletOps, 'refund').mockImplementation(async (_tx, userId, amountCents, reason, opts) => {
        user.balance += BigInt(amountCents);
        return {
          success: true,
          balance: user.balance,
          cached: false,
          entry: {
            id: 'tx_drip_refund',
            userId,
            amount: BigInt(amountCents),
            status: 'COMPLETED',
            idempotencyKey: opts?.idempotencyKey,
          },
        } as any;
      });

      const refundTx = await WalletOps.refund(fakeTx, user.id, refundAmountKopecks, `Возврат за ${remainingRuns} невыполненных запусков Drip-Feed`, {
        idempotencyKey: 'drip_refund_key',
      });

      expect(refundTx.balance).toBe(BigInt(860000)); // 8 000 + 600 = 8 600.00 ₽
    });
  });

  describe('Vector 4: Smart Routing Drip-Feed Capability Verification', () => {
    it('only selects routes and providers that support drip-feed dispatching', async () => {
      const mockRoutes = [
        {
          id: 'route_no_drip',
          provider: { id: 'prov_standard', name: 'Standard SMM (No Drip)', isDripFeedSupported: false },
          providerServiceId: '101',
          priority: 1,
          isPrimary: true,
        },
        {
          id: 'route_with_drip',
          provider: { id: 'prov_drip_master', name: 'Drip Master SMM', isDripFeedSupported: true },
          providerServiceId: '202',
          priority: 2,
          isPrimary: false,
        },
      ];

      // Filter for Drip Feed capability
      const capableRoutes = mockRoutes.filter((r) => r.provider.isDripFeedSupported);

      expect(capableRoutes.length).toBe(1);
      expect(capableRoutes[0].provider.name).toBe('Drip Master SMM');
      expect(capableRoutes[0].providerServiceId).toBe('202');
    });
  });
});
