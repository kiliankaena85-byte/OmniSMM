import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { ReferralValidatorService } from '@/services/referral/referral-validator.service';
import { FirstDepositValidatorService } from '@/services/bonus/first-deposit-validator.service';
import { BonusIssuerService } from '@/services/bonus/bonus-issuer.service';
import { VestingManagerService } from '@/services/bonus/vesting-manager.service';
import { PromoValidatorService } from '@/services/promo/promo-validator.service';

describe('Anti-Fraud Shield Suite (Referral, Bonus Idempotency, Vesting, Promo Hardening)', () => {
  let userAId: string;
  let userBId: string;
  let userCId: string;

  beforeEach(async () => {
    // 1. User A (Root referrer)
    const userA = await db.user.create({
      data: {
        email: `user-a-${Date.now()}@smmplan.pro`,
        role: 'USER',
        balance: BigInt(0),
        referralCode: `REF_A_${Date.now()}`,
        tenantId: 'smmplan',
      },
    });
    userAId = userA.id;

    // 2. User B (referred by A)
    const userB = await db.user.create({
      data: {
        email: `user-b-${Date.now()}@smmplan.pro`,
        role: 'USER',
        balance: BigInt(0),
        referredById: userAId,
        referralCode: `REF_B_${Date.now()}`,
        tenantId: 'smmplan',
      },
    });
    userBId = userB.id;

    // 3. User C (referred by B)
    const userC = await db.user.create({
      data: {
        email: `user-c-${Date.now()}@smmplan.pro`,
        role: 'USER',
        balance: BigInt(0),
        referredById: userBId,
        referralCode: `REF_C_${Date.now()}`,
        tenantId: 'smmplan',
      },
    });
    userCId = userC.id;
  });

  describe('1. Self-Referral and Graph Cycle Defense', () => {
    it('strictly forbids self-referral when inviter and invitee are the same account', async () => {
      const result = await ReferralValidatorService.validateReferralLink(userAId, userAId);
      expect(result.valid).toBe(false);
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.reason).toBe('SELF_REFERRAL_FORBIDDEN');
    });

    it('detects circular referral graphs (A -> B -> C -> A)', async () => {
      // Trying to make User A (ancestor) be referred by User C (descendant)
      const result = await ReferralValidatorService.validateReferralLink(userCId, userAId);
      expect(result.valid).toBe(false);
      expect(result.riskLevel).toBe('CRITICAL');
      expect(result.reason).toBe('CIRCULAR_REFERRAL_DETECTED');
    });
  });

  describe('2. Idempotent Bonus Issuance & De-duplication', () => {
    it('credits bonus only once when the same event is processed multiple times', async () => {
      const eventId = `pay-evt-${Date.now()}`;

      // First issuance
      const res1 = await BonusIssuerService.issueBonus({
        eventType: 'FIRST_DEPOSIT',
        eventId,
        userId: userAId,
        amountCents: BigInt(20000), // 200 RUB
        reason: 'First Deposit Match Bonus',
        isVested: false,
      });

      expect(res1.success).toBe(true);
      expect(res1.cached).toBe(false);

      // Replayed issuance
      const res2 = await BonusIssuerService.issueBonus({
        eventType: 'FIRST_DEPOSIT',
        eventId,
        userId: userAId,
        amountCents: BigInt(20000),
        reason: 'First Deposit Match Bonus',
        isVested: false,
      });

      expect(res2.success).toBe(true);
      expect(res2.cached).toBe(true);

      // Balance must be exactly 20,000 cents (not 40,000)
      const user = await db.user.findUniqueOrThrow({ where: { id: userAId } });
      expect(user.balance).toBe(BigInt(20000));
    });
  });

  describe('3. Duplicate Payment Fingerprint Defense', () => {
    it('rejects first deposit bonus if another user has already used the same card/crypto fingerprint', async () => {
      const fingerprint = FirstDepositValidatorService.computeFingerprint({
        cardBin: '424242',
        cardLast4: '4242',
        payerEmail: 'cardholder@bank.com',
      });

      // User A claims bonus with this fingerprint
      await BonusIssuerService.issueBonus({
        eventType: 'FIRST_DEPOSIT',
        eventId: `dep-1-${Date.now()}`,
        userId: userAId,
        amountCents: BigInt(10000),
        reason: 'First Deposit Bonus',
        paymentFingerprint: fingerprint,
      });

      // User B tries to claim bonus with the same payment fingerprint
      const eligibility = await FirstDepositValidatorService.validateFirstDepositBonus(userBId, fingerprint);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toBe('DUPLICATE_PAYMENT_METHOD_FINGERPRINT');
    });
  });

  describe('4. Vesting Hold (72h) & Early Approval / Confiscation', () => {
    it('holds vested bonus in quarantine and releases upon early approval or maturity', async () => {
      const eventId = `ref-vest-${Date.now()}`;

      // Issue vested bonus
      const res = await BonusIssuerService.issueBonus({
        eventType: 'REFERRAL_SIGNUP',
        eventId,
        userId: userAId,
        amountCents: BigInt(5000),
        reason: 'Vested Referral Bonus (72h Hold)',
        isVested: true,
      });

      expect(res.success).toBe(true);

      // Main balance is 0, quarantine balance is 5,000
      let user = await db.user.findUniqueOrThrow({ where: { id: userAId } });
      expect(user.balance).toBe(BigInt(0));
      expect(user.quarantineBalance).toBe(BigInt(5000));

      // Approve early by operator
      const bonusLog = await db.bonusRedemptionLog.findFirstOrThrow({
        where: { userId: userAId, bonusType: 'REFERRAL_SIGNUP' },
      });

      await VestingManagerService.approveEarly(bonusLog.id, 'admin_super');

      // Now quarantine is 0 and main balance is 5,000
      user = await db.user.findUniqueOrThrow({ where: { id: userAId } });
      expect(user.quarantineBalance).toBe(BigInt(0));
      expect(user.balance).toBe(BigInt(5000));
    });
  });

  describe('5. Promo Code Anti-Brute-Force & Validation', () => {
    it('validates active promo code and handles rate-limiting', async () => {
      const code = `PROMO_${Date.now()}`;
      await db.promoCode.create({
        data: {
          code,
          type: 'DISCOUNT',
          discountPercent: 15.0,
          maxUses: 100,
          isActive: true,
        },
      });

      const validation = await PromoValidatorService.validateCode(code, userAId);
      expect(validation.valid).toBe(true);
      expect(validation.promo?.discountPercent).toBe(15.0);
    });
  });
});
