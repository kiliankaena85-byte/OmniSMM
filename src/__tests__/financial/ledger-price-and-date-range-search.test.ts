import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn(async (sec: string, act: string, fn: (admin: any) => Promise<any>) => {
    return fn({ id: 'test-admin-id', email: 'admin@smmplan.pro', role: 'ADMIN', tenantId: 'smmplan' });
  }),
}));

import { getLedgerAction } from '@/actions/admin/finance/ledger';
import { getPaymentsAction } from '@/actions/admin/finance/payments';

describe('Ledger & Payments Price and Date Range Search Suite', () => {
  let testUserId: string;
  let testUserEmail: string;

  beforeEach(async () => {
    testUserEmail = `range-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@smmplan.pro`;
    const user = await db.user.create({
      data: {
        email: testUserEmail,
        role: 'USER',
        balance: BigInt(500000),
        tenantId: 'smmplan',
      }
    });
    testUserId = user.id;

    // Create 3 ledger entries with distinct amounts
    // 1. Entry of 500 RUB (50000 cents)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(50000),
        reason: 'Пополнение через СБП 500 руб',
        transactionType: 'TOPUP',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `topup-500-${Date.now()}`,
      }
    });

    // 2. Entry of 2500 RUB (250000 cents)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(250000),
        reason: 'Пополнение через ЮKassa 2500 руб',
        transactionType: 'TOPUP',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `topup-2500-${Date.now()}`,
      }
    });

    // 3. Entry of 10000 RUB (1000000 cents)
    await db.ledgerEntry.create({
      data: {
        userId: testUserId,
        amount: BigInt(1000000),
        reason: 'Крупное пополнение 10000 руб',
        transactionType: 'TOPUP',
        status: 'APPROVED',
        tenantId: 'smmplan',
        idempotencyKey: `topup-10000-${Date.now()}`,
      }
    });

    // 4. Payment record of 500 RUB
    await db.payment.create({
      data: {
        userId: testUserId,
        amount: BigInt(50000),
        currency: 'RUB',
        status: 'SUCCEEDED',
        gateway: 'sbp',
        gatewayId: `gw-sbp-${Date.now()}`,
        tenantId: 'smmplan',
      }
    });
  });

  it('filters ledger entries by minAmount and maxAmount (exact range)', async () => {
    // Search between 400 and 600 RUB (should only match 500 RUB)
    const result = await getLedgerAction({
      search: testUserEmail,
      minAmount: 400,
      maxAmount: 600,
      period: 'all',
    });

    expect('items' in result).toBe(true);
    if ('items' in result) {
      expect(result.items.length).toBe(1);
      expect(result.items[0].amount).toBe(50000);
    }
  });

  it('filters ledger entries by minAmount only', async () => {
    // Search >= 2000 RUB (should match 2500 and 10000)
    const result = await getLedgerAction({
      search: testUserEmail,
      minAmount: 2000,
      period: 'all',
    });

    expect('items' in result).toBe(true);
    if ('items' in result) {
      expect(result.items.length).toBe(2);
      const amounts = result.items.map(i => i.amount);
      expect(amounts).toContain(250000);
      expect(amounts).toContain(1000000);
    }
  });

  it('filters payments by price range and gateway', async () => {
    const result = await getPaymentsAction({
      search: testUserEmail,
      minAmount: 450,
      maxAmount: 550,
      gateway: 'sbp',
      period: 'all',
    });

    expect('items' in result).toBe(true);
    if ('items' in result) {
      expect(result.items.length).toBe(1);
      expect(result.items[0].amount).toBe(50000);
      expect(result.items[0].gateway).toBe('sbp');
    }
  });

  it('handles custom dateFrom and dateTo boundaries', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const result = await getLedgerAction({
      search: testUserEmail,
      dateFrom: today,
      dateTo: today,
      period: 'all',
    });

    expect('items' in result).toBe(true);
    if ('items' in result) {
      expect(result.items.length).toBe(3);
    }
  });
});
