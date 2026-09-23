import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatBalance } from '@/lib/utils';
import { activatePromoCodeAction } from '@/actions/user/promo';
import { getGlobalProviderLiquidityAction } from '@/actions/admin/providers/balance';
import { toggleAiObserverKillswitchAction, triggerAiObserverManualAction } from '@/actions/admin/observer';
import * as sessionModule from '@/lib/session';
import { db } from '@/lib/db';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/lib/session', () => ({
  verifySession: vi.fn(),
}));

vi.mock('@/services/core/rate-limit.service', () => ({
  RateLimitService: {
    checkCustomKey: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('@/services/admin/provider-balance.service', () => ({
  providerBalanceService: {
    getGlobalLiquiditySummary: vi.fn().mockResolvedValue({
      totalRub: 50000,
      totalUsd: 500,
      healthyCount: 5,
      warningCount: 0,
      criticalCount: 0,
      activeCount: 5,
      burnRate24hRub: 1000,
      runwayDays: 50,
      providers: [],
    }),
  },
}));

describe('🛡️ QA Deep Adversarial & OWASP Top 10 (2025/2026) Audit Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ════════════════════════════════════════════════════════════════════════
  // 1. OWASP A01: Broken Access Control & RBAC Permission Boundaries
  // ════════════════════════════════════════════════════════════════════════
  describe('1. OWASP A01: Broken Access Control (RBAC & Support Role Boundaries)', () => {
    it('blocks Support role from executing Kill-Switch toggle action', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'staff_support_001',
        email: 'support@smmplan.pro',
        role: 'SUPPORT',
        tenantId: 'smmplan',
      } as any);

      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'staff_support_001',
        email: 'support@smmplan.pro',
        role: 'SUPPORT',
        tenantId: 'smmplan',
        staffRole: {
          id: 'sr_support',
          name: 'Support Staff',
          permissions: [
            { id: 'p1', section: 'TICKETS', canView: true, canEdit: true, roleId: 'sr_support' },
            { id: 'p2', section: 'SUPPORT', canView: true, canEdit: true, roleId: 'sr_support' },
            { id: 'p3', section: 'ORDERS', canView: true, canEdit: false, roleId: 'sr_support' },
          ],
        },
      } as any);

      const result = await toggleAiObserverKillswitchAction(false);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Forbidden');
    });

    it('blocks Support role from triggering Manual AI Observer pipeline (analytics:edit)', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'staff_support_001',
        email: 'support@smmplan.pro',
        role: 'SUPPORT',
        tenantId: 'smmplan',
      } as any);

      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'staff_support_001',
        email: 'support@smmplan.pro',
        role: 'SUPPORT',
        tenantId: 'smmplan',
        staffRole: {
          id: 'sr_support',
          name: 'Support Staff',
          permissions: [
            { id: 'p1', section: 'TICKETS', canView: true, canEdit: true, roleId: 'sr_support' },
          ],
        },
      } as any);

      const result = await triggerAiObserverManualAction({ sendTelegram: false });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Forbidden');
    });

    it('blocks Support role from fetching Global Provider Liquidity (providers:view)', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'staff_support_001',
        email: 'support@smmplan.pro',
        role: 'SUPPORT',
        tenantId: 'smmplan',
      } as any);

      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'staff_support_001',
        email: 'support@smmplan.pro',
        role: 'SUPPORT',
        tenantId: 'smmplan',
        staffRole: {
          id: 'sr_support',
          name: 'Support Staff',
          permissions: [
            { id: 'p1', section: 'TICKETS', canView: true, canEdit: true, roleId: 'sr_support' },
          ],
        },
      } as any);

      const result = await getGlobalProviderLiquidityAction();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('Forbidden');
      }
    });

    it('allows OWNER and ADMIN to bypass granular permission checks', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'owner_user_001',
        email: 'owner@smmplan.pro',
        role: 'OWNER',
        tenantId: 'smmplan',
      } as any);

      vi.spyOn(db.user, 'findUnique').mockResolvedValue({
        id: 'owner_user_001',
        email: 'owner@smmplan.pro',
        role: 'OWNER',
        tenantId: 'smmplan',
        staffRole: null,
      } as any);

      const liquidityResult = await getGlobalProviderLiquidityAction();
      expect(liquidityResult.success).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 2. OWASP A04: Promo Code & Voucher Engine Adversarial Stress Testing
  // ════════════════════════════════════════════════════════════════════════
  describe('2. Promo Code & Voucher Engine Invariants (Typed Responses & Anti-Crash)', () => {
    it('returns typed error when user is unauthenticated (never throws)', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue(null);

      const result = await activatePromoCodeAction('BONUS-100');
      expect(result).toEqual({ success: false, error: 'Требуется авторизация' });
    });

    it('returns typed error when promo code input is empty or whitespace', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'usr_test_1',
        email: 'test@example.com',
      } as any);

      const result = await activatePromoCodeAction('    ');
      expect(result).toEqual({ success: false, error: 'Введите промокод' });
    });

    it('returns typed error when rate limit is exceeded', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'usr_test_1',
        email: 'test@example.com',
      } as any);
      vi.spyOn(RateLimitService, 'checkCustomKey').mockResolvedValue(false);

      const result = await activatePromoCodeAction('PROMO2026');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Слишком много попыток');
    });

    it('normalizes promo code casing and whitespace before DB lookup', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'usr_test_1',
        email: 'test@example.com',
      } as any);
      vi.spyOn(RateLimitService, 'checkCustomKey').mockResolvedValue(true);

      const findUniqueSpy = vi.fn().mockResolvedValue(null);
      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          promoCode: { findUnique: findUniqueSpy, updateMany: vi.fn() },
          ledgerEntry: { findFirst: vi.fn() },
        });
      });

      await activatePromoCodeAction('  bonus_gift_2026  ');
      expect(findUniqueSpy).toHaveBeenCalledWith({
        where: { code: 'BONUS_GIFT_2026' },
      });
    });

    it('rejects DISCOUNT type promo codes with clear guidance to use in checkout', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'usr_test_1',
        email: 'test@example.com',
      } as any);
      vi.spyOn(RateLimitService, 'checkCustomKey').mockResolvedValue(true);

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          promoCode: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p_disc',
              code: 'DISCOUNT10',
              isActive: true,
              type: 'DISCOUNT',
              amount: 1000,
            }),
          },
        });
      });

      const result = await activatePromoCodeAction('DISCOUNT10');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Примените его при оформлении заказа');
    });

    it('rejects expired vouchers safely', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'usr_test_1',
        email: 'test@example.com',
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          promoCode: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p_exp',
              code: 'EXPIRED100',
              isActive: true,
              type: 'VOUCHER',
              amount: 10000,
              expiresAt: new Date(Date.now() - 100000),
            }),
          },
        });
      });

      const result = await activatePromoCodeAction('EXPIRED100');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Срок действия промокода истёк');
    });

    it('rejects duplicate activation attempts via idempotency check', async () => {
      vi.spyOn(sessionModule, 'verifySession').mockResolvedValue({
        userId: 'usr_test_1',
        email: 'test@example.com',
      } as any);

      vi.spyOn(db, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          promoCode: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'p_used',
              code: 'GIFT500',
              isActive: true,
              type: 'VOUCHER',
              amount: 50000,
              expiresAt: null,
            }),
          },
          ledgerEntry: {
            findFirst: vi.fn().mockResolvedValue({ id: 'led_existing' }),
          },
        });
      });

      const result = await activatePromoCodeAction('GIFT500');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Вы уже активировали этот промокод');
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 3. User Balance Integrity & Currency Formatters
  // ════════════════════════════════════════════════════════════════════════
  describe('3. User Balance Formatting & Exact Financial Invariants', () => {
    it('formats 0 kopecks correctly as "0.00 ₽"', () => {
      expect(formatBalance(0)).toBe('0.00 ₽');
      expect(formatBalance(BigInt(0))).toBe('0.00 ₽');
      expect(formatBalance(undefined)).toBe('0.00 ₽');
      expect(formatBalance(null)).toBe('0.00 ₽');
    });

    it('formats exact kopecks with thousand separators and 2-digit padding', () => {
      expect(formatBalance(100)).toBe('1.00 ₽');
      expect(formatBalance(150)).toBe('1.50 ₽');
      expect(formatBalance(105)).toBe('1.05 ₽');
      expect(formatBalance(125050).replace(/\u00A0/g, ' ')).toBe('1 250.50 ₽');
      expect(formatBalance(BigInt(100000000)).replace(/\u00A0/g, ' ')).toBe('1 000 000.00 ₽');
    });

    it('handles negative values safely by flooring to 0.00 ₽ without leaking negative artifacts', () => {
      expect(formatBalance(-500)).toBe('0.00 ₽');
      expect(formatBalance(BigInt(-1))).toBe('0.00 ₽');
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 4. Linguistic & Dynamic Catalog Pluralization Invariants
  // ════════════════════════════════════════════════════════════════════════
  describe('4. Russian Pluralization & Dynamic Catalog Rules', () => {
    const getSocialNetworkPlural = (n: number): string => {
      if (n % 10 === 1 && n % 100 !== 11) return `${n} соцсеть`;
      if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return `${n} соцсети`;
      return `${n} соцсетей`;
    };

    it('correctly pluralizes for 1, 21, 31, 101 ("соцсеть")', () => {
      expect(getSocialNetworkPlural(1)).toBe('1 соцсеть');
      expect(getSocialNetworkPlural(21)).toBe('21 соцсеть');
      expect(getSocialNetworkPlural(31)).toBe('31 соцсеть');
      expect(getSocialNetworkPlural(101)).toBe('101 соцсеть');
    });

    it('correctly pluralizes for 2, 3, 4, 22, 24 ("соцсети")', () => {
      expect(getSocialNetworkPlural(2)).toBe('2 соцсети');
      expect(getSocialNetworkPlural(3)).toBe('3 соцсети');
      expect(getSocialNetworkPlural(4)).toBe('4 соцсети');
      expect(getSocialNetworkPlural(22)).toBe('22 соцсети');
      expect(getSocialNetworkPlural(34)).toBe('34 соцсети');
    });

    it('correctly pluralizes for 0, 5-20, 25-30 ("соцсетей")', () => {
      expect(getSocialNetworkPlural(0)).toBe('0 соцсетей');
      expect(getSocialNetworkPlural(5)).toBe('5 соцсетей');
      expect(getSocialNetworkPlural(6)).toBe('6 соцсетей');
      expect(getSocialNetworkPlural(11)).toBe('11 соцсетей');
      expect(getSocialNetworkPlural(12)).toBe('12 соцсетей');
      expect(getSocialNetworkPlural(20)).toBe('20 соцсетей');
      expect(getSocialNetworkPlural(25)).toBe('25 соцсетей');
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // 5. Loss Prevention & Cancel Button Rendering Invariants
  // ════════════════════════════════════════════════════════════════════════
  describe('5. Loss Prevention & Cancel Button Visibility Rules', () => {
    const isCancelButtonVisible = (
      userRole: string,
      orderStatus: string,
      isCancelEnabled: boolean
    ): boolean => {
      const isPendingState = ['PENDING', 'PENDING_CHECK', 'AWAITING_PAYMENT'].includes(orderStatus);
      const isCancelAllowed = userRole !== 'SUPPORT' || isPendingState || isCancelEnabled === true;
      const isStatusCancelable = ['PENDING', 'PENDING_CHECK', 'AWAITING_PAYMENT', 'IN_PROGRESS', 'ERROR'].includes(orderStatus);
      return isCancelAllowed && isStatusCancelable && !['COMPLETED', 'CANCELED'].includes(orderStatus);
    };

    it('SUPPRESSES cancel button for SUPPORT when order is IN_PROGRESS and provider has isCancelEnabled: false', () => {
      const visible = isCancelButtonVisible('SUPPORT', 'IN_PROGRESS', false);
      expect(visible).toBe(false);
    });

    it('RENDERS cancel button for SUPPORT when order is in PENDING state even if isCancelEnabled: false', () => {
      const visible = isCancelButtonVisible('SUPPORT', 'PENDING', false);
      expect(visible).toBe(true);
    });

    it('RENDERS cancel button for SUPPORT when order is IN_PROGRESS and provider supports cancellation (isCancelEnabled: true)', () => {
      const visible = isCancelButtonVisible('SUPPORT', 'IN_PROGRESS', true);
      expect(visible).toBe(true);
    });

    it('RENDERS cancel button for OWNER even when isCancelEnabled: false (Forced Override Privilege)', () => {
      const visible = isCancelButtonVisible('OWNER', 'IN_PROGRESS', false);
      expect(visible).toBe(true);
    });

    it('SUPPRESSES cancel button for all roles once order is COMPLETED or CANCELED', () => {
      expect(isCancelButtonVisible('OWNER', 'COMPLETED', true)).toBe(false);
      expect(isCancelButtonVisible('SUPPORT', 'CANCELED', true)).toBe(false);
    });
  });
});
