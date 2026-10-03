import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncTapsAction } from '@/actions/depin/ai-assistant';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

vi.mock('@/lib/db', () => ({
  db: {
    dePinNode: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn(),
  },
}));

describe('DePIN Anti-Cheat & Batch Tap Sync Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully credits taps when within energy budget and updates PostgreSQL creditsBalance', async () => {
    const now = Date.now();
    // Simulate initial state: full energy 1000
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({ lastSyncTimestamp: now - 5000, currentEnergy: 1000 })
    );

    vi.mocked(db.dePinNode.update).mockResolvedValue({
      id: 'tg_12345',
      creditsBalance: 25,
    } as never);

    const res = await syncTapsAction({
      nodeId: 'tg_12345',
      tapCount: 15, // requires 15 * 20 = 300 energy
      clientTimestamp: now,
      durationMs: 3000,
    });

    expect(res.success).toBe(true);
    expect(res.creditsAwarded).toBe(15);
    expect(res.totalCredits).toBe(25);

    // Verify atomic increment in database
    expect(db.dePinNode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tg_12345' },
        data: expect.objectContaining({
          creditsBalance: { increment: 15 },
        }),
      })
    );

    // Verify energy updated in Redis
    expect(redis.setex).toHaveBeenCalledWith(
      'depin:energy:tg_12345',
      86400,
      expect.any(String)
    );
  });

  it('rejects taps when user has exhausted energy and tries to over-tap', async () => {
    const now = Date.now();
    // Simulate zero energy with only 1 second elapsed (+2 energy recovered)
    vi.mocked(redis.get).mockResolvedValue(
      JSON.stringify({ lastSyncTimestamp: now - 1000, currentEnergy: 0 })
    );

    const res = await syncTapsAction({
      nodeId: 'tg_cheater',
      tapCount: 50, // requires 1000 energy, but only 2 available
      clientTimestamp: now,
      durationMs: 1000,
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/ENERGY_EXHAUSTED|RATE_LIMIT/);
    expect(db.dePinNode.update).not.toHaveBeenCalled();
  });

  it('rejects invalid inputs (tapCount <= 0 or tapCount > 100)', async () => {
    const resNegative = await syncTapsAction({
      nodeId: 'tg_123',
      tapCount: 0,
      clientTimestamp: Date.now(),
    });
    expect(resNegative.success).toBe(false);

    const resOverlimit = await syncTapsAction({
      nodeId: 'tg_123',
      tapCount: 500,
      clientTimestamp: Date.now(),
    });
    expect(resOverlimit.success).toBe(false);
  });
});
