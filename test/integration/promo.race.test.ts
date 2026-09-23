import { describe, it, expect, vi } from 'vitest';
import { db } from '../../src/lib/db';
import { activatePromoCodeAction } from '../../src/actions/user/promo';

vi.mock('../../src/lib/session', () => ({
  verifySession: vi.fn()
}));

describe('Promo Code OCC and Idempotency Race', () => {
  it('should handle parallel activations of a voucher safely', async () => {
    const { verifySession } = await import('../../src/lib/session');
    
    const userId = 'test_race_user_' + Date.now();
    
    // Setup user and promo
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@example.com`,
        balance: 0,
        role: 'USER'
      }
    });

    const promoCodeStr = `RACE_VOUCHER_${Date.now()}`;
    const promo = await db.promoCode.create({
      data: {
        code: promoCodeStr,
        type: 'VOUCHER',
        amount: 1000, // 1000 cents
        maxUses: 1,
        uses: 0,
        isActive: true,
        discountPercent: 0
      }
    });

    // Mock session
    vi.mocked(verifySession).mockResolvedValue({ userId, role: 'USER' } as any);

    // Run 2 parallel requests
    const results = await Promise.allSettled([
      activatePromoCodeAction(promoCodeStr),
      activatePromoCodeAction(promoCodeStr)
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    // Only one should succeed
    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
    
    if (failures[0].status === 'rejected') {
      const msg = String(failures[0].reason?.message || failures[0].reason || '');
      expect(
        msg.includes('Вы уже активировали этот промокод') ||
        msg.includes('Транзакция в обработке') ||
        msg.includes('Лимит использований') ||
        msg.includes('deadlock') ||
        msg.includes('serialize') ||
        msg.includes('concurrent')
      ).toBe(true);
    }

    const finalUser = await db.user.findUnique({ where: { id: userId } });
    const entries = await db.ledgerEntry.findMany({ where: { userId, idempotencyKey: `promo-${promoCodeStr}-${userId}` } });

    // Balance should only be incremented ONCE
    expect(finalUser?.balance).toBe(1000n);
    // Ledger entry should only be created ONCE
    expect(entries.length).toBe(1);
    expect(entries[0].amount).toBe(1000n);

  });
});
