import { describe, it, expect } from 'vitest';
import { parsePolicyReasonCodes } from '@/services/admin/balance-policy.service';
import { BALANCE_ADJUSTMENT_REASONS } from '@/constants/balance-adjustments';
import { BalanceAdjustmentPolicy } from '@prisma/client';

describe('Balance Policy Utilities', () => {
  it('correctly parses JSON string policy reason codes and roles', () => {
    const mockPolicy: BalanceAdjustmentPolicy = {
      id: 'p1',
      scopeType: 'GLOBAL',
      staffRoleId: null,
      userId: null,
      isActive: true,
      enabled: true,
      canRequestCredit: true,
      canRequestDebit: true,
      canApprove: true,
      canReject: true,
      canViewAll: true,
      canViewStats: true,
      maxCreditPerRequest: BigInt(500000),
      maxDebitPerRequest: BigInt(500000),
      maxCreditPerDay: BigInt(2000000),
      maxDebitPerDay: BigInt(2000000),
      maxTotalPerDay: BigInt(4000000),
      maxApprovalPerRequest: BigInt(5000000),
      allowedCreditReasonCodes: JSON.stringify(['REFUND', 'BONUS']),
      allowedDebitReasonCodes: JSON.stringify(['FRAUD_REVERSAL']),
      allowedTargetRoles: JSON.stringify(['USER']),
      requireTicket: true,
      requireOrderForDebit: false,
      blockBannedTargets: true,
      blockDeletedTargets: true,
      autoExecuteBelow: BigInt(0),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const parsed = parsePolicyReasonCodes(mockPolicy);
    expect(parsed.allowedCreditReasonCodes).toEqual(['REFUND', 'BONUS']);
    expect(parsed.allowedDebitReasonCodes).toEqual(['FRAUD_REVERSAL']);
    expect(parsed.allowedTargetRoles).toEqual(['USER']);
  });

  it('falls back gracefully to defaults on corrupt policy JSON data', () => {
    const corruptPolicy = {
      allowedCreditReasonCodes: 'invalid-json',
      allowedDebitReasonCodes: 'invalid-json',
      allowedTargetRoles: 'invalid-json'
    } as unknown as BalanceAdjustmentPolicy;

    const parsed = parsePolicyReasonCodes(corruptPolicy);
    expect(parsed.allowedCreditReasonCodes).toEqual([...BALANCE_ADJUSTMENT_REASONS.CREDIT]);
    expect(parsed.allowedDebitReasonCodes).toEqual([...BALANCE_ADJUSTMENT_REASONS.DEBIT]);
    expect(parsed.allowedTargetRoles).toEqual(['USER', 'SUPPORT']);
  });
});
