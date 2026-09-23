import { describe, it, expect } from 'vitest';
import {
  calculateReferralTier,
  REFERRAL_TIERS,
} from '@/app/dashboard/referrals/referral-ui';

describe('Referral Tier Progress Calculations', () => {
  it('calculates Level 1 (Start 5%) for zero or few referrals', () => {
    const { currentTier, nextTier, refsNeeded } = calculateReferralTier(0, 0);
    expect(currentTier.level).toBe(1);
    expect(currentTier.percent).toBe(5);
    expect(nextTier?.level).toBe(2);
    expect(refsNeeded).toBe(3);
  });

  it('calculates Level 2 (Partner 7%) for 3 referrals', () => {
    const { currentTier, nextTier, refsNeeded } = calculateReferralTier(3, 0);
    expect(currentTier.level).toBe(2);
    expect(currentTier.percent).toBe(7);
    expect(nextTier?.level).toBe(3);
    expect(refsNeeded).toBe(7);
  });

  it('calculates Level 3 (Pro 10%) for 10 referrals or 30000 RUB LTV', () => {
    const fromRefs = calculateReferralTier(10, 0);
    expect(fromRefs.currentTier.level).toBe(3);
    expect(fromRefs.currentTier.percent).toBe(10);
    expect(fromRefs.nextTier?.level).toBe(4);
    expect(fromRefs.refsNeeded).toBe(15);

    const fromLtv = calculateReferralTier(1, 35000);
    expect(fromLtv.currentTier.level).toBe(3);
    expect(fromLtv.currentTier.percent).toBe(10);
  });

  it('calculates Level 4 (VIP Leader 15%) for 25+ referrals or 50000 RUB LTV', () => {
    const { currentTier, nextTier, refsNeeded, progressPercent } = calculateReferralTier(25, 0);
    expect(currentTier.level).toBe(4);
    expect(currentTier.percent).toBe(15);
    expect(nextTier).toBeNull();
    expect(refsNeeded).toBe(0);
    expect(progressPercent).toBe(100);
  });
});
