import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

describe('Banking-Grade Database Hardening & Invariants (TDD)', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create an isolated test user with balance
    const user = await db.user.create({
      data: {
        email: `banking-test-${Date.now()}@smmplan.local`,
        balance: BigInt(10000), // 100.00 RUB
        tenantId: 'smmplan',
        role: 'USER',
      },
    });
    testUserId = user.id;
  });

  it('INVARIANT 1: PostgreSQL CHECK constraint must physically prevent negative user balance', async () => {
    // Create fresh user in the test scope
    const user = await db.user.create({
      data: {
        email: `banking-neg-${Date.now()}@smmplan.local`,
        balance: BigInt(10000), // 100.00 RUB
        tenantId: 'smmplan',
        role: 'USER',
      },
    });

    // Attempt to set a negative balance via raw SQL or Prisma
    let thrownError: any = null;
    try {
      await db.$executeRawUnsafe(
        `UPDATE "User" SET balance = -500 WHERE id = '${user.id}'`
      );
    } catch (error) {
      thrownError = error;
    }

    expect(thrownError).not.toBeNull();
    // Verify Postgres error code 23514 (check_violation)
    const errorString = String(thrownError);
    expect(
      errorString.includes('chk_user_balance_non_negative') ||
      errorString.includes('23514') ||
      errorString.includes('check constraint')
    ).toBe(true);

    // Verify user balance was NOT corrupted
    const freshUser = await db.user.findUnique({
      where: { id: user.id },
      select: { balance: true },
    });
    expect(freshUser?.balance).toBe(BigInt(10000));
  });

  it('INVARIANT 2: Immutable Ledger Trigger must prohibit UPDATE and DELETE on LedgerEntry', async () => {
    const user = await db.user.create({
      data: {
        email: `banking-ledger-${Date.now()}@smmplan.local`,
        balance: BigInt(10000),
        tenantId: 'smmplan',
        role: 'USER',
      },
    });

    // 1. Create a legitimate ledger entry
    const entry = await db.ledgerEntry.create({
      data: {
        userId: user.id,
        amount: BigInt(5000),
        reason: 'TOPUP',
        status: 'APPROVED',
        idempotencyKey: `bank-test-${Date.now()}`,
      },
    });

    // 2. Attempt to UPDATE the ledger entry
    let updateError: any = null;
    try {
      await db.$executeRawUnsafe(
        `UPDATE "LedgerEntry" SET amount = 999999 WHERE id = '${entry.id}'`
      );
    } catch (err) {
      updateError = err;
    }

    expect(updateError).not.toBeNull();
    const updateErrStr = String(updateError);
    expect(
      updateErrStr.includes('trg_ledger_immutable') ||
      updateErrStr.includes('LedgerEntry is immutable') ||
      updateErrStr.includes('prohibited')
    ).toBe(true);

    // 3. Attempt to DELETE the ledger entry
    let deleteError: any = null;
    try {
      await db.$executeRawUnsafe(
        `DELETE FROM "LedgerEntry" WHERE id = '${entry.id}'`
      );
    } catch (err) {
      deleteError = err;
    }

    expect(deleteError).not.toBeNull();
    const deleteErrStr = String(deleteError);
    expect(
      deleteErrStr.includes('trg_ledger_immutable') ||
      deleteErrStr.includes('LedgerEntry is immutable') ||
      deleteErrStr.includes('prohibited')
    ).toBe(true);
  });

  it('INVARIANT 3: pg_trgm extension and GIN indexes must be active for sub-5ms substring searches', async () => {
    // Verify extension
    const extRows: any[] = await db.$queryRawUnsafe(
      `SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`
    );
    expect(extRows.length).toBeGreaterThan(0);
    expect(extRows[0].extname).toBe('pg_trgm');

    // Verify GIN indexes exist on Order and Service
    const indexRows: any[] = await db.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'Order' AND indexname = 'idx_order_link_trgm'`
    );
    expect(indexRows.length).toBeGreaterThan(0);

    const serviceIndexRows: any[] = await db.$queryRawUnsafe(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'Service' AND indexname = 'idx_service_name_trgm'`
    );
    expect(serviceIndexRows.length).toBeGreaterThan(0);
  });

  it('INVARIANT 4: Order table must have fillfactor = 85 configured for MVCC HOT-updates', async () => {
    const tableOptions: any[] = await db.$queryRawUnsafe(`
      SELECT c.reloptions
      FROM pg_class c
      WHERE c.relname = 'Order'
    `);

    expect(tableOptions.length).toBeGreaterThan(0);
    const options = tableOptions[0].reloptions || [];
    const hasFillfactor85 = options.some((opt: string) => opt.includes('fillfactor=85'));
    expect(hasFillfactor85).toBe(true);
  });
});
