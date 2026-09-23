import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '../../src/lib/db';
import { WalletService } from '../../src/services/financial/wallet.service';

describe('WalletService Race Condition & Idempotency Tests', () => {
  let testUserId: string;

  async function createTestUser(balance: number) {
    const user = await db.user.create({
      data: {
        email: `test_race_${Date.now()}_${Math.random()}@example.com`,
        balance,
        role: 'USER'
      }
    });
    return user.id;
  }

  it('should process exact charge successfully', async () => {
    testUserId = await createTestUser(1000);
    const res = await WalletService.charge(testUserId, 200, 'Test charge 1') as any;
    if (!res.success) throw new Error(res.error || 'Unknown WalletService Error');
    expect(res.success).toBe(true);
    expect(res.balance).toBe(800n);
  });

  it('should reject insufficient funds cleanly', async () => {
    testUserId = await createTestUser(800);
    const res = await WalletService.charge(testUserId, 900, 'Overdraft charge') as any;
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/Insufficient funds/);
  });

  it('should prevent double spending using Idempotency Key', async () => {
    testUserId = await createTestUser(800);
    const idempotencyKey = `idem_key_${Date.now()}`;
    
    const res1 = await WalletService.charge(testUserId, 100, 'Unique sub charge', idempotencyKey) as any;
    expect(res1.success).toBe(true);
    expect(res1.cached).toBe(false);

    const res2 = await WalletService.charge(testUserId, 100, 'Unique sub charge', idempotencyKey) as any;
    expect(res2.success).toBe(true);
    expect(res2.cached).toBe(true); 

    const finalUser = await db.user.findUnique({ where: { id: testUserId } });
    expect(finalUser?.balance).toBe(700n);
  });

  it('should safely handle 50 concurrent charge attempts without going negative', async () => {
    testUserId = await createTestUser(700);
    
    const attempts = Array.from({ length: 50 }).map(() => 
      WalletService.charge(testUserId, 50, 'Concurrent chaos testing')
    );

    const results = await Promise.all(attempts);
    
    // RDBMS concurrency might abort some transactions (e.g., P2034 deadlock). 
    // This is safe and expected behavior. As long as it didn't go negative or over-charge.
    const successes = results.filter(r => r.success);
    const failures = results.filter(r => !r.success);
    
    expect(successes.length).toBeLessThanOrEqual(14);
    
    const finalUser = await db.user.findUnique({ where: { id: testUserId } });
    expect(finalUser?.balance).toBe(BigInt(700 - (successes.length * 50)));
    expect(finalUser?.balance).toBeGreaterThanOrEqual(0);
  });
});

