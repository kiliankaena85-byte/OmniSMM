import { describe, it, expect } from 'vitest';
import {
  sanitizeAndNormalizeOrderLink,
  clampOrderQuantity,
  generateStableIdempotencyKey,
  validateDripFeedFloor,
} from '@/hooks/useBaseOrderValidation';
import { parseActionableError } from '@/lib/errors/actionable-error';

describe('Order Wizard & Checkout Foolproof & CRO Unit Tests', () => {
  describe('sanitizeAndNormalizeOrderLink', () => {
    it('rejects empty or too short link', () => {
      const res = sanitizeAndNormalizeOrderLink('');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Введите корректную ссылку');

      const res2 = sanitizeAndNormalizeOrderLink('hi');
      expect(res2.isValid).toBe(false);
    });

    it('rejects dangerous protocols (javascript:, file:, data:, vbscript:)', () => {
      const resJs = sanitizeAndNormalizeOrderLink('javascript:alert(1)');
      expect(resJs.isValid).toBe(false);
      expect(resJs.error).toContain('Недопустимый протокол');

      const resFile = sanitizeAndNormalizeOrderLink('file:///etc/passwd');
      expect(resFile.isValid).toBe(false);

      const resData = sanitizeAndNormalizeOrderLink('data:text/html,<script>alert(1)</script>');
      expect(resData.isValid).toBe(false);
    });

    it('cleans tracking parameters (utm, igsh, fbclid) while preserving functional parameters', () => {
      // YouTube watch URL: must keep ?v=
      const yt = sanitizeAndNormalizeOrderLink('https://www.youtube.com/watch?v=dQw4w9WgXcQ&utm_source=telegram&utm_medium=cpc');
      expect(yt.isValid).toBe(true);
      expect(yt.cleanUrl).toContain('v=dQw4w9WgXcQ');
      expect(yt.cleanUrl).not.toContain('utm_source');

      // Telegram Bot URL: must keep ?start=
      const tgBot = sanitizeAndNormalizeOrderLink('https://t.me/MyAwesomeBot?start=ref12345&igsh=abcde');
      expect(tgBot.isValid).toBe(true);
      expect(tgBot.cleanUrl).toContain('start=ref12345');
      expect(tgBot.cleanUrl).not.toContain('igsh');
    });

    it('auto-prepends https:// to domain-style URLs without protocol', () => {
      const res = sanitizeAndNormalizeOrderLink('t.me/channel_name');
      expect(res.isValid).toBe(true);
      expect(res.cleanUrl).toBe('https://t.me/channel_name');
    });

    it('validates against targetType and platformSlug when provided', () => {
      // Telegram channel link for Channel/Profile service
      const valid = sanitizeAndNormalizeOrderLink('https://t.me/public_channel', 'TELEGRAM', 'CHANNEL');
      expect(valid.isValid).toBe(true);

      // Telegram channel link for Post service (targetType: POST requires post ID like /123)
      const invalid = sanitizeAndNormalizeOrderLink('https://t.me/public_channel', 'TELEGRAM', 'POST');
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toBeDefined();
    });
  });

  describe('clampOrderQuantity', () => {
    it('clamps zero or negative values to effective min', () => {
      expect(clampOrderQuantity(0, 100, 10000)).toBe(100);
      expect(clampOrderQuantity(-50, 100, 10000)).toBe(100);
      expect(clampOrderQuantity(NaN, 100, 10000)).toBe(100);
    });

    it('clamps values below minQty to minQty', () => {
      expect(clampOrderQuantity(45, 100, 10000)).toBe(100);
    });

    it('clamps values above maxQty to maxQty', () => {
      expect(clampOrderQuantity(15000, 100, 10000)).toBe(10000);
    });

    it('respects Drip-Feed floor when runs > 1', () => {
      // 5 runs with minQty 50 -> effective min is 250
      expect(clampOrderQuantity(100, 50, 10000, 5)).toBe(250);
      expect(clampOrderQuantity(300, 50, 10000, 5)).toBe(300);
    });

    it('floors fractional numbers', () => {
      expect(clampOrderQuantity(150.7, 100, 10000)).toBe(150);
    });
  });

  describe('generateStableIdempotencyKey', () => {
    it('returns existing key if valid and long enough', () => {
      const existing = 'ord_1789585404312_abcdef';
      expect(generateStableIdempotencyKey(existing)).toBe(existing);
    });

    it('generates a fresh key starting with ord_ if undefined or empty', () => {
      const key = generateStableIdempotencyKey();
      expect(key.startsWith('ord_')).toBe(true);
      expect(key.length).toBeGreaterThanOrEqual(16);
    });
  });

  describe('parseActionableError CRO integration', () => {
    it('classifies balance error with switch gateway action', () => {
      const err = parseActionableError('Недостаточно средств на балансе');
      expect(err.code).toBe('ERR_BALANCE_INSUFFICIENT');
      expect(err.action?.type).toBe('SWITCH_GATEWAY');
      expect(err.action?.targetGateway).toBe('yookassa');
    });

    it('classifies private link error with recommendation to change service or open channel', () => {
      const err = parseActionableError('Ссылка на закрытый канал не поддерживается');
      expect(err.code).toBe('ERR_PRIVATE_TARGET_INVITE_LINK');
      expect(err.action?.type).toBe('CHOOSE_ANALOG');
    });
  });
});
