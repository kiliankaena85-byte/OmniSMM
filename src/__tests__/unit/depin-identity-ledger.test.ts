import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertCreditsToBalanceAction } from '@/actions/depin/ai-assistant';
import { DePinTaskDispatcher } from '@/services/depin/task-dispatcher';
import { db } from '@/lib/db';
import { WalletOps } from '@/services/financial/wallet-ops';

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    dePinNode: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock('@/lib/transactions', () => ({
  runSerializableTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb(db);
  }),
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    credit: vi.fn(),
  },
}));

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn().mockResolvedValue(null),
}));

describe('DePIN Identity & Financial Ledger Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    DePinTaskDispatcher.resetInstance();
  });

  it('successfully credits balance to an existing user resolved by telegramId', async () => {
    const mockDispatcher = DePinTaskDispatcher.getInstance();
    vi.spyOn(mockDispatcher, 'claimCredits').mockResolvedValue({
      success: true,
      claimedCredits: 100,
      remainingCredits: 50,
    });

    const existingUser = {
      id: 'cuid_user_12345',
      telegramId: '777000111',
      tenantId: 'smmplan',
      balance: BigInt(5000),
    };

    vi.mocked(db.user.findFirst).mockResolvedValue(existingUser as never);
    vi.mocked(WalletOps.credit).mockResolvedValue({
      success: true,
      balance: BigInt(5100),
      cached: false,
    } as never);

    const res = await convertCreditsToBalanceAction({
      nodeId: 'tg_777000111',
      credits: 100,
      userId: '777000111', // telegramId passed from TMA
    });

    expect(res.success).toBe(true);
    expect(res.rublesCredited).toBe(1);
    expect(res.remainingCredits).toBe(50);

    // Verify user was resolved by telegramId
    expect(db.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { id: '777000111' },
            { telegramId: '777000111' },
          ],
        },
      })
    );

    // Verify WalletOps was called with the actual CUID, NOT the raw telegramId
    expect(WalletOps.credit).toHaveBeenCalledWith(
      expect.anything(),
      'cuid_user_12345', // Must be CUID!
      100, // 100 kopecks (1.00 RUB)
      expect.stringContaining('100 OmniCredits'),
      expect.objectContaining({
        transactionType: 'COMPENSATION',
      })
    );
  });

  it('auto-provisions a new user when telegramId does not exist yet and credits balance', async () => {
    const mockDispatcher = DePinTaskDispatcher.getInstance();
    vi.spyOn(mockDispatcher, 'claimCredits').mockResolvedValue({
      success: true,
      claimedCredits: 200,
      remainingCredits: 0,
    });

    // No existing user found
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never);

    const newlyCreatedUser = {
      id: 'cuid_newly_created_999',
      telegramId: '888999000',
      tenantId: 'smmplan',
      email: 'tg_888999000@telegram.omnismm.internal',
      role: 'USER',
      balance: BigInt(0),
    };

    vi.mocked(db.user.create).mockResolvedValue(newlyCreatedUser as never);
    vi.mocked(WalletOps.credit).mockResolvedValue({
      success: true,
      balance: BigInt(200),
      cached: false,
    } as never);

    const res = await convertCreditsToBalanceAction({
      nodeId: 'tg_888999000',
      credits: 200,
      userId: '888999000',
    });

    expect(res.success).toBe(true);
    expect(res.rublesCredited).toBe(2);
    expect(res.remainingCredits).toBe(0);

    // Verify user auto-creation
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          telegramId: '888999000',
          tenantId: 'smmplan',
          role: 'USER',
        }),
      })
    );

    // Verify WalletOps credited to the new user CUID
    expect(WalletOps.credit).toHaveBeenCalledWith(
      expect.anything(),
      'cuid_newly_created_999',
      200,
      expect.stringContaining('200 OmniCredits'),
      expect.objectContaining({
        transactionType: 'COMPENSATION',
      })
    );
  });

  it('rejects conversion if credits are below minimum 100', async () => {
    const res = await convertCreditsToBalanceAction({
      nodeId: 'tg_111',
      credits: 99,
      userId: '111',
    });

    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
