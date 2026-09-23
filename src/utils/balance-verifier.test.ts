import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { BalanceVerifier } from './balance-verifier';
import { sendAdminAlert } from '@/lib/notifications';

// Mock the notification service to assert that alerts are correctly sent.
vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
}));

describe('BalanceVerifier Service Tests', () => {
  beforeEach(async () => {
    // 1. Clear tables to have a pristine test environment using raw SQL truncation with CASCADE
    await db.$executeRawUnsafe('TRUNCATE TABLE "LedgerEntry", "AdminAuditLog", "User" CASCADE;');

    // 2. Enable test mode
    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true },
      create: { id: 'global', isTestMode: true },
    });

    // 3. Reset mock state
    vi.clearAllMocks();
  });

  it('should successfully reconcile a user with a perfectly matching balance and ledger entries', async () => {
    // Create clean user with 10.00 RUB (1000 cents) balance
    const user = await db.user.create({
      data: {
        email: 'clean_user@example.com',
        balance: BigInt(1000),
        isActive: true,
        isDeleted: false,
      },
    });

    // Create approved ledger entries summing to exactly 1000 cents
    await db.ledgerEntry.createMany({
      data: [
        {
          userId: user.id,
          amount: BigInt(800),
          reason: 'Initial Credit',
          status: 'APPROVED',
        },
        {
          userId: user.id,
          amount: BigInt(200),
          reason: 'Bonus Refill',
          status: 'APPROVED',
        },
      ],
    });

    const results = await BalanceVerifier.verifyAllBalances();

    // Verification result assertions
    expect(results.length).toBe(1);
    expect(results[0].email).toBe(user.email);
    expect(results[0].isDiscrepancy).toBe(false);
    expect(results[0].lockedSuccessfully).toBe(false);

    // Verify DB user remains active and clean
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser).toBeDefined();
    expect(dbUser!.isActive).toBe(true);
    expect(dbUser!.adminNote).toBeNull();

    // Verify no alerts and no audit logs
    expect(sendAdminAlert).not.toHaveBeenCalled();
    const auditLogs = await db.adminAuditLog.findMany();
    expect(auditLogs.length).toBe(0);
  });

  it('should identify a user discrepancy, lock the user, log to AdminAuditLog, and send an alert (balance > ledger)', async () => {
    // Create user with 1500 cents but ledger approved entries sum only to 1000 cents
    const user = await db.user.create({
      data: {
        email: 'discrepant_high@example.com',
        balance: BigInt(1500),
        isActive: true,
        isDeleted: false,
      },
    });

    await db.ledgerEntry.create({
      data: {
        userId: user.id,
        amount: BigInt(1000),
        reason: 'Valid Transaction',
        status: 'APPROVED',
      },
    });

    const results = await BalanceVerifier.verifyAllBalances();

    // Check result
    expect(results.length).toBe(1);
    expect(results[0].isDiscrepancy).toBe(true);
    expect(results[0].discrepancy).toBe(BigInt(500));
    expect(results[0].lockedSuccessfully).toBe(true);

    // Check that user is locked and has appropriate adminNote
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser).toBeDefined();
    expect(dbUser!.isActive).toBe(false);
    expect(dbUser!.adminNote).toBe(
      '[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (1500) не сходится с реестром (1000). Разница: 500 центов.'
    );

    // Check that alert was sent
    expect(sendAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('🚨 [CRITICAL BALANCE DISCREPANCY]'),
      'CRITICAL'
    );

    // Check that AdminAuditLog entry was successfully written
    const auditLogs = await db.adminAuditLog.findMany();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe('USER_BALANCE_DISCREPANCY');
    expect(auditLogs[0].target).toBe(user.id);
    expect(auditLogs[0].targetType).toBe('USER');
    expect(auditLogs[0].newValue).toBe(
      '[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (1500) не сходится с реестром (1000). Разница: 500 центов.'
    );
  });

  it('should identify a user discrepancy, lock the user, log to AdminAuditLog, and send an alert (balance < ledger)', async () => {
    // Create user with 500 cents but approved ledger entries sum to 1000 cents
    const user = await db.user.create({
      data: {
        email: 'discrepant_low@example.com',
        balance: BigInt(500),
        isActive: true,
        isDeleted: false,
      },
    });

    await db.ledgerEntry.create({
      data: {
        userId: user.id,
        amount: BigInt(1000),
        reason: 'Payment Credit',
        status: 'APPROVED',
      },
    });

    const results = await BalanceVerifier.verifyAllBalances();

    // Verification result assertions
    expect(results.length).toBe(1);
    expect(results[0].isDiscrepancy).toBe(true);
    expect(results[0].discrepancy).toBe(BigInt(-500));
    expect(results[0].lockedSuccessfully).toBe(true);

    // Verify DB user is locked with correct note
    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.isActive).toBe(false);
    expect(dbUser!.adminNote).toBe(
      '[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (500) не сходится с реестром (1000). Разница: -500 центов.'
    );

    // Verify alert and audit log were created
    expect(sendAdminAlert).toHaveBeenCalledWith(expect.any(String), 'CRITICAL');
    const auditLogs = await db.adminAuditLog.findMany();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].newValue).toBe(
      '[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (500) не сходится с реестром (1000). Разница: -500 центов.'
    );
  });

  it('should completely ignore inactive or deleted users', async () => {
    // 1. Create inactive user with mismatched ledger
    await db.user.create({
      data: {
        email: 'already_inactive@example.com',
        balance: BigInt(1000),
        isActive: false,
        isDeleted: false,
      },
    });

    // 2. Create deleted user with mismatched ledger
    await db.user.create({
      data: {
        email: 'already_deleted@example.com',
        balance: BigInt(1000),
        isActive: true,
        isDeleted: true,
      },
    });

    const results = await BalanceVerifier.verifyAllBalances();

    // Should return empty list because neither user is active and non-deleted
    expect(results.length).toBe(0);
    expect(sendAdminAlert).not.toHaveBeenCalled();
    const auditLogs = await db.adminAuditLog.findMany();
    expect(auditLogs.length).toBe(0);
  });

  it('should ignore non-approved (REJECTED/QUARANTINE) ledger entries during summation', async () => {
    // Create user with 1000 cents
    const user = await db.user.create({
      data: {
        email: 'clean_with_various_ledgers@example.com',
        balance: BigInt(1000),
        isActive: true,
        isDeleted: false,
      },
    });

    // Create approved entries that sum to 1000, and non-approved entries
    await db.ledgerEntry.createMany({
      data: [
        {
          userId: user.id,
          amount: BigInt(1000),
          reason: 'Approved Credit',
          status: 'APPROVED',
        },
        {
          userId: user.id,
          amount: BigInt(500),
          reason: 'Rejected Refund',
          status: 'REJECTED',
        },
        {
          userId: user.id,
          amount: BigInt(300),
          reason: 'Quarantined funds',
          status: 'QUARANTINE',
        },
      ],
    });

    const results = await BalanceVerifier.verifyAllBalances();

    // Verify user is reconciled because non-approved entries are ignored, summing strictly to 1000
    expect(results.length).toBe(1);
    expect(results[0].isDiscrepancy).toBe(false);

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.isActive).toBe(true);
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });
});
