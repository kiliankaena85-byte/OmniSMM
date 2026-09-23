import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getEffectiveBalancePolicy, parsePolicyReasonCodes } from '../balance-policy.service';
import { SupportBalancePolicyService } from '@/services/financial/support-balance-policy.service';

describe('Balance Policy & Engine Unit Tests', () => {
  let staffUser: any;
  let targetUser: any;

  beforeEach(async () => {
    // Clear and create base users
    staffUser = await db.user.create({
      data: {
        email: 'staff@example.com',
        role: 'SUPPORT',
        preferredDashboard: 'CLASSIC',
      },
    });

    targetUser = await db.user.create({
      data: {
        email: 'client@example.com',
        role: 'USER',
        preferredDashboard: 'CLASSIC',
      },
    });
  });

  it('getEffectiveBalancePolicy returns GLOBAL if no USER/ROLE policy exists', async () => {
    // Create GLOBAL policy
    const globalPolicy = await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION']),
        allowedDebitReasonCodes: JSON.stringify(['DEBIT_ADJUST']),
        allowedTargetRoles: JSON.stringify(['USER']),
      },
    });

    const policy = await getEffectiveBalancePolicy(staffUser.id);
    expect(policy).toBeDefined();
    expect(policy?.id).toBe(globalPolicy.id);
  });

  it('USER policy overrides GLOBAL policy', async () => {
    // Create GLOBAL policy
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION']),
        allowedDebitReasonCodes: JSON.stringify(['DEBIT_ADJUST']),
        allowedTargetRoles: JSON.stringify(['USER']),
      },
    });

    // Create USER policy
    const userPolicy = await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'USER',
        userId: staffUser.id,
        isActive: true,
        enabled: true,
        allowedCreditReasonCodes: JSON.stringify(['USER_SPECIFIC']),
        allowedDebitReasonCodes: JSON.stringify(['DEBIT_ADJUST']),
        allowedTargetRoles: JSON.stringify(['USER']),
      },
    });

    const policy = await getEffectiveBalancePolicy(staffUser.id);
    expect(policy?.id).toBe(userPolicy.id);
  });

  it('maxCreditPerRequest blocks exceeding amount requests', async () => {
    // Set policy with credit limit of 50.00 RUB (5000 cents)
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        canRequestCredit: true,
        maxCreditPerRequest: BigInt(5000),
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE']),
        allowedDebitReasonCodes: JSON.stringify([]),
        allowedTargetRoles: JSON.stringify(['USER']),
        requireTicket: false,
      },
    });

    // Accept legal consent
    await db.employeeResponsibilityConsent.create({
      data: {
        userId: staffUser.id,
        status: 'ACTIVE',
        acceptedIp: '127.0.0.1',
        acceptedUserAgent: 'test',
        documentHash: 'test-hash',
      },
    });

    const res = await db.$transaction(async (tx) => {
      return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
        staffUserId: staffUser.id,
        targetUserId: targetUser.id,
        direction: 'CREDIT',
        amountCents: BigInt(6000), // Exceeds 5000
        reasonCode: 'COMPENSATION_BALANCE',
        reasonNote: 'Test compensation exceeding limit',
        source: 'DIRECT_ADJUSTMENT',
        idempotencyKey: 'request-limit-test',
      });
    });

    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.code).toBe('PER_REQUEST_LIMIT_EXCEEDED');
    }
  });

  it('maxTotalPerDay blocks exceeding daily limit (MSK timezone)', async () => {
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        canRequestCredit: true,
        maxTotalPerDay: BigInt(10000), // 100 RUB daily limit
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE']),
        allowedDebitReasonCodes: JSON.stringify([]),
        allowedTargetRoles: JSON.stringify(['USER']),
        requireTicket: false,
      },
    });

    await db.employeeResponsibilityConsent.create({
      data: {
        userId: staffUser.id,
        status: 'ACTIVE',
        acceptedIp: '127.0.0.1',
        acceptedUserAgent: 'test',
        documentHash: 'test-hash',
      },
    });

    // Make first operation of 80 RUB (8000 cents)
    const firstRes = await db.$transaction(async (tx) => {
      return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
        staffUserId: staffUser.id,
        targetUserId: targetUser.id,
        direction: 'CREDIT',
        amountCents: BigInt(8000),
        reasonCode: 'COMPENSATION_BALANCE',
        reasonNote: 'Test compensation 1',
        source: 'DIRECT_ADJUSTMENT',
        idempotencyKey: 'daily-limit-test-1',
      });
    });
    expect(firstRes.allowed).toBe(true);

    // Make second operation of 30 RUB (3000 cents), total 110 RUB (exceeds 100 RUB daily)
    const secondRes = await db.$transaction(async (tx) => {
      return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
        staffUserId: staffUser.id,
        targetUserId: targetUser.id,
        direction: 'CREDIT',
        amountCents: BigInt(3000),
        reasonCode: 'COMPENSATION_BALANCE',
        reasonNote: 'Test compensation 2',
        source: 'DIRECT_ADJUSTMENT',
        idempotencyKey: 'daily-limit-test-2',
      });
    });
    expect(secondRes.allowed).toBe(false);
    if (!secondRes.allowed) {
      expect(secondRes.code).toBe('DAILY_LIMIT_EXCEEDED');
    }
  });

  it('blockStaffTargets prevents modifying staff target balances', async () => {
    const anotherStaff = await db.user.create({
      data: {
        email: 'another_staff@example.com',
        role: 'ADMIN',
        preferredDashboard: 'CLASSIC',
      },
    });

    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        canRequestCredit: true,
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE']),
        allowedDebitReasonCodes: JSON.stringify([]),
        allowedTargetRoles: JSON.stringify(['USER']),
        requireTicket: false,
      },
    });

    await db.employeeResponsibilityConsent.create({
      data: {
        userId: staffUser.id,
        status: 'ACTIVE',
        acceptedIp: '127.0.0.1',
        acceptedUserAgent: 'test',
        documentHash: 'test-hash',
      },
    });

    const res = await db.$transaction(async (tx) => {
      return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
        staffUserId: staffUser.id,
        targetUserId: anotherStaff.id, // Targeting ADMIN staff member
        direction: 'CREDIT',
        amountCents: BigInt(1000),
        reasonCode: 'COMPENSATION_BALANCE',
        reasonNote: 'Test compensation to staff',
        source: 'DIRECT_ADJUSTMENT',
        idempotencyKey: 'staff-target-test',
      });
    });

    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.code).toBe('STAFF_TARGET_FORBIDDEN');
    }
  });

  it('requireConsent blocks request if staff user has no active EmployeeResponsibilityConsent', async () => {
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        canRequestCredit: true,
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE']),
        allowedDebitReasonCodes: JSON.stringify([]),
        allowedTargetRoles: JSON.stringify(['USER']),
        requireTicket: false,
      },
    });

    // NOT creating consent here to verify failure

    const res = await db.$transaction(async (tx) => {
      return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
        staffUserId: staffUser.id,
        targetUserId: targetUser.id,
        direction: 'CREDIT',
        amountCents: BigInt(1000),
        reasonCode: 'COMPENSATION_BALANCE',
        reasonNote: 'Test compensation without consent',
        source: 'DIRECT_ADJUSTMENT',
        idempotencyKey: 'consent-test',
      });
    });

    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.code).toBe('CONSENT_MISSING');
    }
  });

  it('requireTicket blocks request without ticketId if set to true', async () => {
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        canRequestCredit: true,
        requireTicket: true, // Required
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE']),
        allowedDebitReasonCodes: JSON.stringify([]),
        allowedTargetRoles: JSON.stringify(['USER']),
      },
    });

    await db.employeeResponsibilityConsent.create({
      data: {
        userId: staffUser.id,
        status: 'ACTIVE',
        acceptedIp: '127.0.0.1',
        acceptedUserAgent: 'test',
        documentHash: 'test-hash',
      },
    });

    const res = await db.$transaction(async (tx) => {
      return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
        staffUserId: staffUser.id,
        targetUserId: targetUser.id,
        direction: 'CREDIT',
        amountCents: BigInt(1000),
        reasonCode: 'COMPENSATION_BALANCE',
        reasonNote: 'Test compensation without ticket id',
        source: 'DIRECT_ADJUSTMENT',
        idempotencyKey: 'ticket-required-test',
      });
    });

    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.code).toBe('TICKET_REQUIRED');
    }
  });

  it('allowedCreditReasonCodes filters reason codes', async () => {
    await db.balanceAdjustmentPolicy.create({
      data: {
        scopeType: 'GLOBAL',
        isActive: true,
        enabled: true,
        canRequestCredit: true,
        allowedCreditReasonCodes: JSON.stringify(['COMPENSATION_BALANCE']), // Only this code allowed
        allowedDebitReasonCodes: JSON.stringify([]),
        allowedTargetRoles: JSON.stringify(['USER']),
        requireTicket: false,
      },
    });

    await db.employeeResponsibilityConsent.create({
      data: {
        userId: staffUser.id,
        status: 'ACTIVE',
        acceptedIp: '127.0.0.1',
        acceptedUserAgent: 'test',
        documentHash: 'test-hash',
      },
    });

    const res = await db.$transaction(async (tx) => {
      return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
        staffUserId: staffUser.id,
        targetUserId: targetUser.id,
        direction: 'CREDIT',
        amountCents: BigInt(1000),
        reasonCode: 'INVALID_CODE', // Not allowed
        reasonNote: 'Test compensation with invalid code',
        source: 'DIRECT_ADJUSTMENT',
        idempotencyKey: 'reason-code-test',
      });
    });

    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.code).toBe('REASON_CODE_INVALID');
    }
  });

  it('fail-closed: falls back to safe behavior when JSON structure is invalid', () => {
    const policy = {
      allowedCreditReasonCodes: 'invalid-json-{',
      allowedDebitReasonCodes: 'invalid-json-[',
      allowedTargetRoles: 'invalid-json-}',
    } as any;

    const parsed = parsePolicyReasonCodes(policy);
    expect(parsed.allowedCreditReasonCodes).toEqual(expect.any(Array));
    expect(parsed.allowedDebitReasonCodes).toEqual(expect.any(Array));
  });
});
