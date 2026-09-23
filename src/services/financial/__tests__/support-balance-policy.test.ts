import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMSKDayKey, getMSKHourKey, SupportBalancePolicyService } from '../support-balance-policy.service';

describe('SupportBalancePolicyService Unit Tests', () => {
  it('1. getMSKDayKey returns correct YYYY-MM-DD string in Europe/Moscow timezone', () => {
    // 2026-07-28 00:30 UTC = 2026-07-28 03:30 MSK
    const dateUtcEarly = new Date('2026-07-27T22:30:00Z');
    const dayKeyMsk = getMSKDayKey(dateUtcEarly);
    expect(dayKeyMsk).toBe('2026-07-28');
  });

  it('2. getMSKHourKey returns correct YYYY-MM-DDTHH string in MSK timezone', () => {
    const dateUtc = new Date('2026-07-27T22:15:00Z'); // 01:15 MSK July 28
    const hourKey = getMSKHourKey(dateUtc);
    expect(hourKey).toBe('2026-07-28T01');
  });

  it('3. validateAndReserveSupportOperation rejects self-targeting (staffUserId === targetUserId)', async () => {
    const mockTx: any = {};
    const result = await SupportBalancePolicyService.validateAndReserveSupportOperation(mockTx, {
      staffUserId: 'user-staff-1',
      targetUserId: 'user-staff-1',
      direction: 'CREDIT',
      amountCents: BigInt(1000),
      reasonCode: 'COMPENSATION_BALANCE',
      reasonNote: 'Тестовая компенсация пользователю',
      source: 'SUPPORT_COMPENSATION',
      idempotencyKey: 'test-key-1'
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('SELF_ADJUSTMENT_FORBIDDEN');
    }
  });

  it('4. validateAndReserveSupportOperation rejects zero or negative amount', async () => {
    const mockTx: any = {};
    const result = await SupportBalancePolicyService.validateAndReserveSupportOperation(mockTx, {
      staffUserId: 'user-staff-1',
      targetUserId: 'user-client-1',
      direction: 'CREDIT',
      amountCents: BigInt(0),
      reasonCode: 'COMPENSATION_BALANCE',
      reasonNote: 'Тестовая компенсация пользователю',
      source: 'SUPPORT_COMPENSATION',
      idempotencyKey: 'test-key-2'
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('INVALID_AMOUNT');
    }
  });

  it('5. validateAndReserveSupportOperation rejects short reason notes (< 10 chars)', async () => {
    const mockTx: any = {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-staff-1') return Promise.resolve({ id: 'user-staff-1', role: 'SUPPORT', isActive: true, isDeleted: false, supportLimitCents: 100000 });
          if (where.id === 'user-client-1') return Promise.resolve({ id: 'user-client-1', role: 'USER', isActive: true, isDeleted: false });
          return Promise.resolve(null);
        })
      },
      employeeResponsibilityConsent: {
        findFirst: vi.fn().mockResolvedValue({ id: 'consent-1' })
      },
      balanceAdjustmentPolicy: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'policy-1',
          scopeType: 'GLOBAL',
          isActive: true,
          enabled: true,
          canRequestCredit: true,
          canRequestDebit: true,
          maxCreditPerRequest: BigInt(1000000),
          maxDebitPerRequest: BigInt(1000000),
          maxTotalPerDay: BigInt(5000000),
          allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE']),
          allowedDebitReasonCodes: JSON.stringify([]),
          allowedTargetRoles: JSON.stringify(['USER']),
          requireTicket: false,
          requireOrderForDebit: false
        })
      }
    };

    const result = await SupportBalancePolicyService.validateAndReserveSupportOperation(mockTx, {
      staffUserId: 'user-staff-1',
      targetUserId: 'user-client-1',
      direction: 'CREDIT',
      amountCents: BigInt(1000),
      reasonCode: 'COMPENSATION_BALANCE',
      reasonNote: 'Коротко', // < 10 chars
      source: 'SUPPORT_COMPENSATION',
      idempotencyKey: 'test-key-3'
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('REASON_NOTE_TOO_SHORT');
    }
  });

  it('6. validateAndReserveSupportOperation blocks non-OWNER staff from modifying staff targets', async () => {
    const mockTx: any = {
      user: {
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'user-staff-1') return Promise.resolve({ id: 'user-staff-1', role: 'SUPPORT', isActive: true, isDeleted: false, supportLimitCents: 100000 });
          if (where.id === 'user-admin-1') return Promise.resolve({ id: 'user-admin-1', role: 'ADMIN', isActive: true, isDeleted: false });
          return Promise.resolve(null);
        })
      },
      employeeResponsibilityConsent: {
        findFirst: vi.fn().mockResolvedValue({ id: 'consent-1' })
      }
    };

    const result = await SupportBalancePolicyService.validateAndReserveSupportOperation(mockTx, {
      staffUserId: 'user-staff-1',
      targetUserId: 'user-admin-1',
      direction: 'CREDIT',
      amountCents: BigInt(1000),
      reasonCode: 'COMPENSATION_BALANCE',
      reasonNote: 'Тестовая компенсация пользователю',
      source: 'SUPPORT_COMPENSATION',
      idempotencyKey: 'test-key-4'
    });

    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.code).toBe('STAFF_TARGET_FORBIDDEN');
    }
  });
});
