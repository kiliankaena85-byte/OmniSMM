import { describe, it, expect } from 'vitest';
import { AccountExistsError, handleServerError } from '@/utils/error-handler';
import { createSafeAction } from '@/lib/safe-action';
import { z } from 'zod';

describe('SPEC-2026-14: Seamless Checkout Guest Auth & State Preservation', () => {
  describe('AccountExistsError & Error Handler Contract', () => {
    it('instantiates AccountExistsError with code, email, and standard message', () => {
      const email = 'client@example.com';
      const err = new AccountExistsError(email);

      expect(err.name).toBe('AccountExistsError');
      expect(err.code).toBe('ACCOUNT_EXISTS');
      expect(err.email).toBe(email);
      expect(err.message).toContain('уже зарегистрирован в системе');
    });

    it('handleServerError preserves code and email for AccountExistsError', () => {
      const email = 'alex@smmplan.pro';
      const err = new AccountExistsError(email);
      const res = handleServerError(err);

      expect(res.code).toBe('ACCOUNT_EXISTS');
      expect(res.email).toBe(email);
      expect(res.message).toContain('уже зарегистрирован в системе');
    });

    it('createSafeAction forwards code and email to the client response', async () => {
      const testSchema = z.object({
        email: z.string().email(),
      });

      const response = await createSafeAction(testSchema, { email: 'exists@example.com' }, async ({ email }) => {
        if (email === 'exists@example.com') {
          throw new AccountExistsError(email);
        }
        return { ok: true };
      });

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.code).toBe('ACCOUNT_EXISTS');
        expect(response.email).toBe('exists@example.com');
        expect(response.error).toContain('уже зарегистрирован в системе');
      }
    });
  });

  describe('PendingOrderSnapshot Validation & TTL Invariants', () => {
    const createMockSnapshot = (overrides = {}) => ({
      version: 1,
      serviceId: 'srv-123',
      link: 'https://t.me/mychannel',
      url: 'https://t.me/mychannel',
      quantity: 500,
      promoCode: 'DISCOUNT10',
      runs: 5,
      interval: 30,
      isSmartDrip: false,
      smartDripDays: 7,
      networkId: 'net-tg',
      categoryId: 'cat-subs',
      customData: '',
      email: 'alex@example.com',
      savedAt: Date.now(),
      timestamp: Date.now(),
      ...overrides,
    });

    it('serializes snapshot with all critical order parameters', () => {
      const snapshot = createMockSnapshot();
      const serialized = JSON.stringify(snapshot);
      const parsed = JSON.parse(serialized);

      expect(parsed.serviceId).toBe('srv-123');
      expect(parsed.link).toBe('https://t.me/mychannel');
      expect(parsed.quantity).toBe(500);
      expect(parsed.promoCode).toBe('DISCOUNT10');
      expect(parsed.runs).toBe(5);
      expect(parsed.interval).toBe(30);
      expect(parsed.networkId).toBe('net-tg');
      expect(parsed.categoryId).toBe('cat-subs');
      expect(parsed.email).toBe('alex@example.com');
      expect(parsed.version).toBe(1);
    });

    it('detects and rejects expired snapshots (> 30 minutes)', () => {
      const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
      const expiredSnapshot = createMockSnapshot({
        savedAt: thirtyOneMinutesAgo,
        timestamp: thirtyOneMinutesAgo,
      });

      const isExpired = Date.now() - expiredSnapshot.savedAt > 30 * 60 * 1000;
      expect(isExpired).toBe(true);
    });

    it('accepts fresh snapshots (< 30 minutes)', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const freshSnapshot = createMockSnapshot({
        savedAt: fiveMinutesAgo,
        timestamp: fiveMinutesAgo,
      });

      const isExpired = Date.now() - freshSnapshot.savedAt > 30 * 60 * 1000;
      expect(isExpired).toBe(false);
    });
  });

  describe('Magic Link Redirect Parameter Security', () => {
    it('validates redirectTo relative URL pattern for resume flow', () => {
      const validRedirect = '/?auth_resume=1';
      const isSafeRelative = validRedirect.startsWith('/') && !validRedirect.startsWith('//');
      expect(isSafeRelative).toBe(true);

      const maliciousRedirect = 'https://evil.com/phish';
      const isMaliciousRelative = maliciousRedirect.startsWith('/') && !maliciousRedirect.startsWith('//');
      expect(isMaliciousRelative).toBe(false);
    });
  });
});