import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WalletService } from './wallet.service';
import { db } from '../../lib/db';

vi.mock('../../lib/db', () => ({
  db: {
    $transaction: vi.fn(),
  }
}));

describe('WalletService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('charge', () => {
    it('returns error if amount <= 0', async () => {
      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => cb(db));
      await expect(WalletService.charge('user1', 0, 'test')).resolves.toEqual(
        expect.objectContaining({ success: false, error: expect.stringContaining('positive finite number') })
      );
      await expect(WalletService.charge('user1', -50, 'test')).resolves.toEqual(
        expect.objectContaining({ success: false, error: expect.stringContaining('positive finite number') })
      );
    });

    it('returns error if db transaction fails', async () => {
      vi.mocked(db.$transaction).mockRejectedValueOnce(new Error('DB Error'));
      const result = await WalletService.charge('user1', 100, 'test');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('DB Error');
    });

    it('simulates actual transaction processing', async () => {
      // Mock the callback passed to $transaction
      vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
        const tx = {
          ledgerEntry: {
            findUnique: vi.fn().mockResolvedValueOnce(null),
            findFirst: vi.fn().mockResolvedValueOnce(null),
            create: vi.fn().mockResolvedValueOnce({ id: 'entry1' })
          },
          user: {
            updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValueOnce({ balance: 400 })
          }
        };
        return cb(tx);
      });

      const res = await WalletService.charge('user1', 100, 'test', 'idemp_key1');
      expect(res.success).toBe(true);
      expect(res.balance).toBe(400);
      expect(res.cached).toBe(false);
    });

    it('returns cached entry on idempotency hit', async () => {
      vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
        const tx = {
          ledgerEntry: {
            findUnique: vi.fn().mockResolvedValueOnce({ id: 'entry1', idempotencyKey: 'idemp_key1' }),
            findFirst: vi.fn().mockResolvedValueOnce({ id: 'entry1', idempotencyKey: 'idemp_key1' }),
          }
        };
        return cb(tx);
      });

      const res = await WalletService.charge('user1', 100, 'test', 'idemp_key1');
      expect(res.success).toBe(true);
      expect(res.cached).toBe(true);
      expect((res as any).entry!.id).toBe('entry1');
    });

    it('throws inside transaction if user not found', async () => {
      vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
        const tx = {
          ledgerEntry: { findUnique: vi.fn().mockResolvedValueOnce(null), findFirst: vi.fn().mockResolvedValueOnce(null) },
          user: {
            updateMany: vi.fn().mockResolvedValueOnce({ count: 0 }),
            findUnique: vi.fn().mockResolvedValueOnce(null)
          }
        };
        return cb(tx);
      });

      const res = await WalletService.charge('userunknown', 100, 'test');
      expect(res.success).toBe(false);
      expect((res as any).error).toBe('User userunknown not found.');
    });

    it('throws inside transaction if insufficient funds', async () => {
      vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
        const tx = {
          ledgerEntry: { findUnique: vi.fn().mockResolvedValueOnce(null), findFirst: vi.fn().mockResolvedValueOnce(null) },
          user: {
            updateMany: vi.fn().mockResolvedValueOnce({ count: 0 }),
            findUnique: vi.fn().mockResolvedValueOnce({ id: 'user1', balance: 50 })
          }
        };
        return cb(tx);
      });

      const res = await WalletService.charge('user1', 100, 'test');
      expect(res.success).toBe(false);
      expect((res as any).error).toBe('Insufficient funds: needed 100, got 50');
    });
  });

  describe('credit', () => {
    it('returns error if amount <= 0', async () => {
      vi.mocked(db.$transaction).mockImplementation(async (cb: any) => cb(db));
      await expect(WalletService.credit('user1', 0, 'test')).resolves.toEqual(
        expect.objectContaining({ success: false, error: expect.stringContaining('positive finite number') })
      );
    });

    it('returns error if db transaction fails', async () => {
      vi.mocked(db.$transaction).mockRejectedValueOnce(new Error('Credit DB Error'));
      const result = await WalletService.credit('user1', 100, 'test');
      expect(result.success).toBe(false);
      expect((result as any).error).toBe('Credit DB Error');
    });

    it('simulates actual credit processing', async () => {
      vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
        const tx = {
          ledgerEntry: {
            findUnique: vi.fn().mockResolvedValueOnce(null),
            findFirst: vi.fn().mockResolvedValueOnce(null),
            create: vi.fn().mockResolvedValueOnce({ id: 'entry2' })
          },
          user: {
            update: vi.fn().mockResolvedValueOnce({ balance: 600 })
          }
        };
        return cb(tx);
      });

      const res = await WalletService.credit('user1', 100, 'test', 'idemp_key2', 'admin1');
      expect(res.success).toBe(true);
      expect(res.balance).toBe(600);
      expect(res.cached).toBe(false);
    });

    it('returns cached entry on idempotency hit for credit', async () => {
      vi.mocked(db.$transaction).mockImplementationOnce(async (cb: any) => {
        const tx = {
          ledgerEntry: {
            findUnique: vi.fn().mockResolvedValueOnce({ id: 'entry1', idempotencyKey: 'idemp_key2' }),
            findFirst: vi.fn().mockResolvedValueOnce({ id: 'entry1', idempotencyKey: 'idemp_key2' }),
          }
        };
        return cb(tx);
      });

      const res = await WalletService.credit('user1', 100, 'test', 'idemp_key2');
      expect(res.success).toBe(true);
      expect(res.cached).toBe(true);
    });
  });
});
