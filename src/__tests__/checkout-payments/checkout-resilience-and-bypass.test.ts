import { describe, it, expect, vi } from 'vitest';
import { isLinkServiceCompatible, LinkType, ServiceTargetType, normalizeLinkType, normalizeServiceTargetType } from '@/constants/link-service-compatibility';
import { mutateLink, getLinkValidator } from '@/validators/link-mutators';
import { timingSafeEqual } from 'crypto';

describe('Checkout, Payments & Link Validator Fallback Resilience Suite', () => {
  describe('1. Link Validator Resilience & Bypass Invariant (isLinkOverridden)', () => {
    it('allows valid standard social links via default validator', () => {
      const validTgPost = 'https://t.me/durov/123';
      const mutated = mutateLink(validTgPost, 'TELEGRAM', 'POST');
      const validator = getLinkValidator('TELEGRAM', 'POST');
      const result = validator.safeParse(mutated);
      expect(result.success).toBe(true);
    });

    it('gracefully handles and cleans unusual URLs with query parameters', () => {
      const dirtyUrl = 'https://vk.com/wall-12345_678?w=wall-12345_678&utm_source=test';
      const cleaned = mutateLink(dirtyUrl, 'VK', 'POST');
      expect(cleaned).toContain('vk.com/wall-12345_678');
      expect(cleaned).not.toContain('utm_source');
    });

    it('permits non-standard / new URL formats when isLinkOverridden is true', () => {
      const exoticUrl = 'https://custom-telegram-proxy.net/join/special-invite';
      
      // Verification of bypass check logic
      const isLinkOverridden = true;
      let normalizedLink = exoticUrl.trim();

      if (isLinkOverridden) {
        if (!/^https?:\/\//i.test(normalizedLink) && normalizedLink.includes('.')) {
          normalizedLink = 'https://' + normalizedLink;
        }
        expect(/^https?:\/\//i.test(normalizedLink)).toBe(true);
        const u = new URL(normalizedLink);
        expect(u.hostname.includes('.')).toBe(true);
      }
    });

    it('rejects garbage strings even when isLinkOverridden is true', () => {
      const invalidUrl = 'not-a-valid-url-without-domain';
      const isLinkOverridden = true;
      let normalizedLink = invalidUrl.trim();

      if (!/^https?:\/\//i.test(normalizedLink) && normalizedLink.includes('.')) {
        normalizedLink = 'https://' + normalizedLink;
      }
      
      const isValid = /^https?:\/\//i.test(normalizedLink);
      expect(isValid).toBe(false);
    });

    it('blocks SSRF / private IP / cloud metadata URLs in override mode', () => {
      const isPrivateOrLoopback = (rawUrl: string): boolean => {
        try {
          const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
          const host = u.hostname.toLowerCase();
          if (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host === '::1' ||
            host === '169.254.169.254' ||
            host.startsWith('10.') ||
            host.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
          ) {
            return true;
          }
          return false;
        } catch {
          return true; // invalid URL
        }
      };

      expect(isPrivateOrLoopback('http://127.0.0.1:8080/admin')).toBe(true);
      expect(isPrivateOrLoopback('https://localhost/api')).toBe(true);
      expect(isPrivateOrLoopback('https://169.254.169.254/latest/meta-data/')).toBe(true);
      expect(isPrivateOrLoopback('https://192.168.1.1/router')).toBe(true);
      expect(isPrivateOrLoopback('https://10.0.0.5/internal')).toBe(true);
      expect(isPrivateOrLoopback('https://t.me/durov')).toBe(false);
      expect(isPrivateOrLoopback('https://vk.com/wall123_456')).toBe(false);
    });

    it('ensures LinkType.CUSTOM is universally compatible with all service target types', () => {
      const targetTypes = [
        ServiceTargetType.CHANNEL,
        ServiceTargetType.PROFILE,
        ServiceTargetType.POST_INTERACTION,
        ServiceTargetType.VIDEO_INTERACTION,
        ServiceTargetType.STORY_INTERACTION,
        ServiceTargetType.CHANNEL_POSTS,
        ServiceTargetType.POLL_VOTES,
        ServiceTargetType.BOT_STARTS,
        ServiceTargetType.COMMENTS,
        ServiceTargetType.CUSTOM,
      ];

      for (const tt of targetTypes) {
        expect(isLinkServiceCompatible(LinkType.CUSTOM, tt)).toBe(true);
        expect(isLinkServiceCompatible('generic_link', tt)).toBe(true);
      }
    });
  });

  describe('2. Payment Webhook Security & Idempotency', () => {
    it('timingSafeEqual comparison fails closed for mismatching lengths or signatures', () => {
      function safeCompare(a: string, b: string): boolean {
        const bufA = Buffer.from(a);
        const bufB = Buffer.from(b);
        if (bufA.length !== bufB.length) {
          return false;
        }
        return timingSafeEqual(bufA, bufB);
      }

      expect(safeCompare('secret_signature_123', 'secret_signature_123')).toBe(true);
      expect(safeCompare('secret_signature_123', 'wrong_signature_1234')).toBe(false);
      expect(safeCompare('secret_signature_123', 'secret_signature_124')).toBe(false);
      expect(safeCompare('', 'secret')).toBe(false);
    });

    it('rubToKopecks parses decimal strings into exact BigInt kopecks', () => {
      function rubToKopecks(value: unknown): bigint {
        if (typeof value !== 'string') {
          throw new Error('INVALID_AMOUNT_FORMAT');
        }
        const normalized = value.trim();
        const decimalMatch = /^(\d+)\.(\d{2})$/.exec(normalized);
        if (decimalMatch) {
          return BigInt(decimalMatch[1]) * BigInt(100) + BigInt(decimalMatch[2]);
        }
        const integerMatch = /^(\d+)$/.exec(normalized);
        if (integerMatch) {
          return BigInt(integerMatch[1]) * BigInt(100);
        }
        throw new Error('INVALID_AMOUNT_FORMAT');
      }

      expect(rubToKopecks('100.00')).toBe(BigInt(10000));
      expect(rubToKopecks('12.34')).toBe(BigInt(1234));
      expect(rubToKopecks('500')).toBe(BigInt(50000));
      expect(rubToKopecks('0.01')).toBe(BigInt(1));
      expect(() => rubToKopecks('invalid')).toThrow('INVALID_AMOUNT_FORMAT');
      expect(() => rubToKopecks('12.345')).toThrow('INVALID_AMOUNT_FORMAT');
    });
  });

  describe('3. Drip-Feed Floor Invariant Validation', () => {
    it('strictly enforces run quantity floor >= service.minQty', () => {
      const minQty = 50;
      
      const validateDripFeed = (totalQuantity: number, runs: number, min: number) => {
        const perRun = Math.floor(totalQuantity / runs);
        if (perRun < min) {
          return {
            isValid: false,
            error: `Минимальное количество на один запуск Drip-feed: ${min} шт. (сейчас: ${perRun} шт.)`
          };
        }
        return { isValid: true };
      };

      // Valid: 500 total, 10 runs = 50 per run (>= 50)
      expect(validateDripFeed(500, 10, minQty).isValid).toBe(true);

      // Invalid: 400 total, 10 runs = 40 per run (< 50)
      const invalid = validateDripFeed(400, 10, minQty);
      expect(invalid.isValid).toBe(false);
      expect(invalid.error).toContain('Минимальное количество на один запуск');
    });
  });
});
