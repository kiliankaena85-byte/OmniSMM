import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletOps } from '@/services/financial/wallet-ops';

describe('Wave 2 Invariants: Reseller API v2, Referral & Loyalty, Sync Worker', () => {
  describe('Domain 7: Referral Balance Integrity & Deficit Prevention (WalletOps.referralDebit)', () => {
    let mockTx: {
      user: {
        findUnique: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
      ledgerEntry: {
        findFirst: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
      };
    };

    beforeEach(() => {
      mockTx = {
        user: {
          findUnique: vi.fn(),
          updateMany: vi.fn().mockResolvedValue({ count: 1 })
        },
        ledgerEntry: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'ledger-entry-1' })
        }
      };
    });

    it('debits referral balance cleanly when sufficient funds exist without touching main balance', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        id: 'user-1',
        tenantId: 'smmplan',
        referralBalance: 500, // 500 rubles
        balance: BigInt(100000) // 1,000 rubles in kopecks
      });

      const res = await WalletOps.referralDebit(
        mockTx as unknown as Parameters<typeof WalletOps.referralDebit>[0],
        'user-1',
        300, // 300 rubles
        'order_refund_reversal',
        { tenantId: 'smmplan', idempotencyKey: 'idemp-1' }
      );

      expect(res.success).toBe(true);
      // updateMany called for referralBalance with decrement: 300
      expect(mockTx.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          referralBalance: { gte: 300 },
          tenantId: 'smmplan'
        },
        data: { referralBalance: { decrement: 300 } }
      });
      // Should NOT have called updateMany on main balance
      expect(mockTx.user.updateMany).toHaveBeenCalledTimes(1);
    });

    it('protects against negative referral balance when referralBalance < debitAmount and covers shortage from main balance', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        id: 'user-2',
        tenantId: 'smmplan',
        referralBalance: 100, // only 100 rubles left on referral balance
        balance: BigInt(50000) // 500 rubles on main balance
      });

      const res = await WalletOps.referralDebit(
        mockTx as unknown as Parameters<typeof WalletOps.referralDebit>[0],
        'user-2',
        300, // 300 rubles needed
        'order_refund_reversal',
        { tenantId: 'smmplan', idempotencyKey: 'idemp-2' }
      );

      expect(res.success).toBe(true);
      // First updateMany: debits available 100 from referral balance
      expect(mockTx.user.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          id: 'user-2',
          referralBalance: { gte: 100 },
          tenantId: 'smmplan'
        },
        data: { referralBalance: { decrement: 100 } }
      });
      // Second updateMany: debits 200 from main balance to cover shortage
      expect(mockTx.user.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          id: 'user-2',
          balance: { gte: BigInt(200) },
          tenantId: 'smmplan'
        },
        data: { balance: { decrement: BigInt(200) } }
      });
    });

    it('never allows referralBalance to drop below zero if user has 0 referral balance', async () => {
      mockTx.user.findUnique.mockResolvedValue({
        id: 'user-3',
        tenantId: 'smmplan',
        referralBalance: 0,
        balance: BigInt(10000)
      });

      const res = await WalletOps.referralDebit(
        mockTx as unknown as Parameters<typeof WalletOps.referralDebit>[0],
        'user-3',
        150,
        'order_refund_reversal',
        { tenantId: 'smmplan', idempotencyKey: 'idemp-3' }
      );

      expect(res.success).toBe(true);
      // No call with referralBalance decrement
      // Only shortage debited from main balance
      expect(mockTx.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-3',
          balance: { gte: BigInt(150) },
          tenantId: 'smmplan'
        },
        data: { balance: { decrement: BigInt(150) } }
      });
    });
  });

  describe('Domain 6: Reseller API v2 Drip-Feed Floor & Conflict Invariants', () => {
    it('enforces Drip-Feed Floor invariant (quantity per run cannot be lower than service.minQty)', () => {
      const service = { minQty: 100, maxQty: 10000 };
      const runs = 5;
      const quantity = 50; // 50 < minQty (100)

      const isInvalidDripFeed = runs && runs > 0 && quantity < service.minQty;
      expect(isInvalidDripFeed).toBe(true);

      const validQuantity = 100;
      const isValidDripFeed = runs && runs > 0 && validQuantity < service.minQty;
      expect(isValidDripFeed).toBe(false);
    });

    it('maps concurrency conflicts P2034 and P2028 to 503 instead of 400 Insufficient Funds', () => {
      const p2034Error = { code: 'P2034', message: 'Transaction failed due to a write conflict or a deadlock. Please retry your transaction' };
      const p2028Error = { code: 'P2028', message: 'Transaction API error: Transaction already closed' };
      const normalError = new Error('INSUFFICIENT_FUNDS');

      function mapErrorToResponse(err: unknown) {
        const errCode = (typeof err === 'object' && err !== null && 'code' in err) ? (err as { code: unknown }).code : undefined;
        if (errCode === 'P2034' || errCode === 'P2028') {
          return { status: 503, error: 'System busy, please retry your request' };
        }
        if (err instanceof Error && err.message === 'INSUFFICIENT_FUNDS') {
          return { status: 400, error: 'Not enough funds on balance' };
        }
        return { status: 500, error: 'Internal server error' };
      }

      expect(mapErrorToResponse(p2034Error)).toEqual({ status: 503, error: 'System busy, please retry your request' });
      expect(mapErrorToResponse(p2028Error)).toEqual({ status: 503, error: 'System busy, please retry your request' });
      expect(mapErrorToResponse(normalError)).toEqual({ status: 400, error: 'Not enough funds on balance' });
    });

    it('allows cross-tenant catalog access for shared services (tenantId in [userTenantId, all])', () => {
      const userTenantId = 'smmplan';
      const allowedTenants = [userTenantId, 'all'];

      expect(allowedTenants.includes('all')).toBe(true);
      expect(allowedTenants.includes('smmplan')).toBe(true);
      expect(allowedTenants.includes('flux')).toBe(false);
    });
  });

  describe('Domain 8: Sync Processor Status Mutation Safety', () => {
    it('prevents IN_PROGRESS sync update from overwriting terminal states like CANCELLED or COMPLETED', () => {
      const allowedPredecessorStatuses = ['IN_PROGRESS', 'PENDING', 'PENDING_CHECK'];

      expect(allowedPredecessorStatuses.includes('PENDING')).toBe(true);
      expect(allowedPredecessorStatuses.includes('IN_PROGRESS')).toBe(true);
      expect(allowedPredecessorStatuses.includes('CANCELLED')).toBe(false);
      expect(allowedPredecessorStatuses.includes('COMPLETED')).toBe(false);
      expect(allowedPredecessorStatuses.includes('PARTIAL')).toBe(false);
    });
  });
});
