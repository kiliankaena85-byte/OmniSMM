import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';
import { WalletService } from './wallet.service';
import { db } from '../../lib/db';
import { MutexManager } from '../../lib/redis-lock';
import { redis } from '../../lib/redis';

// Note: This test actually uses the REAL Redis instance if available,
// but we mock the database to simulate slow transactions and TOCTOU conditions.
vi.mock('../../lib/db', () => ({
  db: {
    $transaction: vi.fn(),
  }
}));

describe.skip('WalletOps Parallel Refunds (Integration with Redis)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Clear any locks just in case
    await redis.del('lock:wallet_ops:parallel_user');
  });

  it('prevents TOCTOU when executing parallel refunds using Redlock', async () => {
    // We simulate a race condition where multiple refunds for the same user
    // are executed concurrently. Without Redlock, they would all read the 
    // initial state and write concurrently. With Redlock, they queue up.
    
    let dbUpdateCalls = 0;
    
    // We mock the transaction to simulate a 50ms database delay
    vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        ledgerEntry: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'entry_mock' })
        },
        user: {
          update: vi.fn().mockImplementation(async () => {
            dbUpdateCalls++;
            // Simulate slow DB response that would normally cause TOCTOU
            await new Promise(r => setTimeout(r, 50));
            return { balance: 1000 };
          })
        }
      };
      return cb(tx);
    });

    // Run 10 parallel refunds with the same idempotency key
    const idempotencyKey = 'refund_12345';
    
    const results = await Promise.all(
      Array.from({ length: 10 }).map(() => 
        WalletService.refund('parallel_user', 500, 'Test Refund', idempotencyKey, 'admin1')
      )
    );

    // Because of the Redis lock, only ONE of these should actually perform the DB update
    // BEFORE the others are allowed to proceed. When the others proceed, they should
    // see the idempotency key! Wait, the idempotency key check is inside the DB mock.
    // Our DB mock always returns `null` for findUnique. So all 10 will update the DB
    // unless we mock it to remember.
    
    // Let's create a stateful mock for LedgerEntry
    const ledger = new Set<string>();
    
    dbUpdateCalls = 0; // reset
    vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
      const tx = {
        ledgerEntry: {
          findUnique: vi.fn().mockImplementation(async ({ where }) => {
            if (ledger.has(where.idempotencyKey)) {
              return { id: 'existing_entry', idempotencyKey: where.idempotencyKey };
            }
            return null;
          }),
          create: vi.fn().mockImplementation(async ({ data }) => {
            ledger.add(data.idempotencyKey);
            return { id: 'new_entry', ...data };
          })
        },
        user: {
          update: vi.fn().mockImplementation(async () => {
            dbUpdateCalls++;
            await new Promise(r => setTimeout(r, 50));
            return { balance: 1000 };
          })
        }
      };
      return cb(tx);
    });

    const results2 = await Promise.all(
      Array.from({ length: 10 }).map(() => 
        WalletService.refund('parallel_user', 500, 'Test Refund', 'idemp_key_race', 'admin1')
      )
    );

    // Assertions
    const successes = results2.filter(r => r.success && !r.cached);
    const cached = results2.filter(r => r.success && r.cached);

    expect(successes.length).toBe(1); // Only 1 real DB update
    expect(cached.length).toBe(9); // The other 9 hit the idempotency cache safely
    expect(dbUpdateCalls).toBe(1); // The user.update was strictly called 1 time!
  }, 10000);

  it('fuzzes concurrent financial operations using fast-check', async () => {
    // fast-check property based test for concurrent refunds
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }), // random number of parallel requests
        async (numRequests) => {
          await redis.del('lock:wallet_ops:fuzz_user');
          const ledger = new Set<string>();
          let updateCalls = 0;
          
          vi.mocked(db.$transaction).mockImplementation(async (cb: any) => {
            const tx = {
              ledgerEntry: {
                findUnique: async ({ where }: any) => ledger.has(where.idempotencyKey) ? { id: 'hit' } : null,
                create: async ({ data }: any) => {
                  ledger.add(data.idempotencyKey);
                  return { id: 'new' };
                }
              },
              user: {
                update: async () => {
                  updateCalls++;
                  await new Promise(r => setTimeout(r, 10)); // Artificial latency
                  return { balance: 1000 };
                }
              }
            };
            return cb(tx);
          });

          const results = await Promise.all(
            Array.from({ length: numRequests }).map(() => 
              WalletService.refund('fuzz_user', 100, 'Fuzzing', 'fuzz_idemp', 'admin')
            )
          );

          return results.filter(r => !r.cached).length === 1 && updateCalls === 1;
        }
      ),
      { numRuns: 10 } // run 10 times with different numbers of concurrent requests
    );
  }, 20000);
});
