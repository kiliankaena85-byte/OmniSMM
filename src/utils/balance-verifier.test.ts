import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/db';
import { BalanceVerifier } from './balance-verifier';
import { sendAdminAlert } from '@/lib/notifications';

const mockUsers = new Map<string, any>();
const mockLedgerEntries = new Map<string, any>();
const mockAuditLogs: any[] = [];
const mockSystemSettings = new Map<string, any>();

vi.mock('@/lib/db', () => {
  const dbMock = {
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $transaction: vi.fn().mockImplementation(async (cb: any) => cb(dbMock)),
    systemSettings: {
      upsert: vi.fn().mockImplementation(async ({ where, update, create }: any) => {
        const id = where.id;
        const existing = mockSystemSettings.get(id);
        const data = existing ? { ...existing, ...update } : { id, ...create };
        mockSystemSettings.set(id, data);
        return data;
      }),
    },
    user: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `user_${Math.random().toString(36).substring(2, 9)}`;
        const record = { id, adminNote: null, ...data };
        mockUsers.set(id, record);
        return record;
      }),
      findMany: vi.fn().mockImplementation(async ({ where }: any) => {
        let list = Array.from(mockUsers.values());
        if (where?.isActive !== undefined) list = list.filter((u) => u.isActive === where.isActive);
        if (where?.isDeleted !== undefined) list = list.filter((u) => u.isDeleted === where.isDeleted);
        return list;
      }),
      findUnique: vi.fn().mockImplementation(async ({ where }: any) => mockUsers.get(where.id) || null),
      findUniqueOrThrow: vi.fn().mockImplementation(async ({ where }: any) => {
        const u = mockUsers.get(where.id);
        if (!u) throw new Error('User not found');
        return u;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }: any) => {
        const u = mockUsers.get(where.id);
        if (u) {
          Object.assign(u, data);
        }
        return u;
      }),
    },
    ledgerEntry: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const id = data.id || `ledger_${Math.random().toString(36).substring(2, 9)}`;
        const record = { id, status: 'APPROVED', ...data };
        mockLedgerEntries.set(id, record);
        return record;
      }),
      createMany: vi.fn().mockImplementation(async ({ data }: any) => {
        for (const item of data) {
          const id = item.id || `ledger_${Math.random().toString(36).substring(2, 9)}`;
          mockLedgerEntries.set(id, { id, status: 'APPROVED', ...item });
        }
        return { count: data.length };
      }),
      aggregate: vi.fn().mockImplementation(async ({ where }: any) => {
        let sum = BigInt(0);
        for (const entry of mockLedgerEntries.values()) {
          if (entry.userId === where.userId && entry.status === where.status) {
            sum += BigInt(entry.amount);
          }
        }
        return { _sum: { amount: sum } };
      }),
    },
    adminAuditLog: {
      create: vi.fn().mockImplementation(async ({ data }: any) => {
        const record = { id: `audit_${Math.random().toString(36).substring(2, 9)}`, createdAt: new Date(), ...data };
        mockAuditLogs.push(record);
        return record;
      }),
      findMany: vi.fn().mockImplementation(async () => mockAuditLogs),
      deleteMany: vi.fn().mockImplementation(async () => {
        mockAuditLogs.length = 0;
        return { count: 0 };
      }),
    },
  };
  return { db: dbMock };
});

// Mock the notification service to assert that alerts are correctly sent.
vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn(),
}));

describe('BalanceVerifier Service Tests', () => {
  beforeEach(async () => {
    mockUsers.clear();
    mockLedgerEntries.clear();
    mockAuditLogs.length = 0;
    mockSystemSettings.clear();

    await db.$executeRawUnsafe('TRUNCATE TABLE "LedgerEntry", "AdminAuditLog", "User" CASCADE;');

    await db.systemSettings.upsert({
      where: { id: 'global' },
      update: { isTestMode: true },
      create: { id: 'global', isTestMode: true },
    });

    vi.clearAllMocks();
  });

  it('should successfully reconcile a user with a perfectly matching balance and ledger entries', async () => {
    const user = await db.user.create({
      data: {
        email: 'clean_user@example.com',
        balance: BigInt(1000),
        isActive: true,
        isDeleted: false,
      },
    });

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

    expect(results.length).toBe(1);
    expect(results[0].email).toBe(user.email);
    expect(results[0].isDiscrepancy).toBe(false);
    expect(results[0].lockedSuccessfully).toBe(false);

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser).toBeDefined();
    expect(dbUser!.isActive).toBe(true);
    expect(dbUser!.adminNote).toBeNull();

    expect(sendAdminAlert).not.toHaveBeenCalled();
    const auditLogs = await db.adminAuditLog.findMany();
    expect(auditLogs.length).toBe(0);
  });

  it('should identify a user discrepancy, lock the user, log to AdminAuditLog, and send an alert (balance > ledger)', async () => {
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

    expect(results.length).toBe(1);
    expect(results[0].isDiscrepancy).toBe(true);
    expect(results[0].discrepancy).toBe(BigInt(500));
    expect(results[0].lockedSuccessfully).toBe(true);

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser).toBeDefined();
    expect(dbUser!.isActive).toBe(false);
    expect(dbUser!.adminNote).toBe(
      '[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (1500) не сходится с реестром (1000). Разница: 500 центов.'
    );

    expect(sendAdminAlert).toHaveBeenCalledWith(
      expect.stringContaining('🚨 [CRITICAL BALANCE DISCREPANCY]'),
      'CRITICAL'
    );

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

    expect(results.length).toBe(1);
    expect(results[0].isDiscrepancy).toBe(true);
    expect(results[0].discrepancy).toBe(BigInt(-500));
    expect(results[0].lockedSuccessfully).toBe(true);

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.isActive).toBe(false);
    expect(dbUser!.adminNote).toBe(
      '[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (500) не сходится с реестром (1000). Разница: -500 центов.'
    );

    expect(sendAdminAlert).toHaveBeenCalledWith(expect.any(String), 'CRITICAL');
    const auditLogs = await db.adminAuditLog.findMany();
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].newValue).toBe(
      '[CRITICAL DISCREPANCY] Автоматическая блокировка: баланс (500) не сходится с реестром (1000). Разница: -500 центов.'
    );
  });

  it('should completely ignore inactive or deleted users', async () => {
    await db.user.create({
      data: {
        email: 'already_inactive@example.com',
        balance: BigInt(1000),
        isActive: false,
        isDeleted: false,
      },
    });

    await db.user.create({
      data: {
        email: 'already_deleted@example.com',
        balance: BigInt(1000),
        isActive: true,
        isDeleted: true,
      },
    });

    const results = await BalanceVerifier.verifyAllBalances();

    expect(results.length).toBe(0);
    expect(sendAdminAlert).not.toHaveBeenCalled();
    const auditLogs = await db.adminAuditLog.findMany();
    expect(auditLogs.length).toBe(0);
  });

  it('should ignore non-approved (REJECTED/QUARANTINE) ledger entries during summation', async () => {
    const user = await db.user.create({
      data: {
        email: 'clean_with_various_ledgers@example.com',
        balance: BigInt(1000),
        isActive: true,
        isDeleted: false,
      },
    });

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

    expect(results.length).toBe(1);
    expect(results[0].isDiscrepancy).toBe(false);

    const dbUser = await db.user.findUnique({ where: { id: user.id } });
    expect(dbUser!.isActive).toBe(true);
    expect(sendAdminAlert).not.toHaveBeenCalled();
  });
});
