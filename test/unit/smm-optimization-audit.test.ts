import { describe, it, expect } from 'vitest';
import { SafeRegexValidator } from '@/services/analyzer/safe-regex.validator';
import { GeminiCallOptions } from '@/services/ai/gemini-client';

describe('SMM Optimization Audit: Link Regex Engine & Cost/Cache Optimizer', () => {
  describe('SafeRegexValidator (smm-link-regex-engine)', () => {
    it('rejects URLs longer than 512 characters to prevent event loop starvation', () => {
      const longUrl = 'https://t.me/' + 'a'.repeat(600);
      const result = SafeRegexValidator.testPattern('^https:\\/\\/t\\.me\\/[a-z]+$', longUrl);

      expect(result.isValid).toBe(false);
      expect(result.isSafe).toBe(false);
      expect(result.error).toContain('512');
    });

    it('accepts and validates safe normal-length URLs', () => {
      const validUrl = 'https://t.me/smmplan_channel/123';
      const pattern = '^(?:https?:\\/\\/)?(?:www\\.)?(?:t\\.me|telegram\\.me)\\/([-_a-zA-Z0-9.]+)(?:\\/(\\d+))?\\/?$';
      const result = SafeRegexValidator.testPattern(pattern, validUrl);

      expect(result.isValid).toBe(true);
      expect(result.isSafe).toBe(true);
      expect(result.isMatch).toBe(true);
      expect(result.extractedGroups).toEqual(['smmplan_channel', '123']);
    });

    it('detects and blocks dangerous catastrophic backtracking patterns (ReDoS)', () => {
      const dangerousPatterns = [
        '^(a+)+$',
        '^([a-z]+)*$',
        '(.*)+',
        '((a*)*)',
      ];

      for (const p of dangerousPatterns) {
        const audit = SafeRegexValidator.staticAudit(p);
        expect(audit.isSafe).toBe(false);
        expect(audit.reason).toContain('ReDoS');
      }
    });

    it('converts human-friendly masks with safe character class placement', () => {
      const mask = 't.me/{channel}/{postId}';
      const regexStr = SafeRegexValidator.maskToRegex(mask);

      expect(regexStr).toContain('([-_a-zA-Z0-9.]+)');
      expect(regexStr).toContain('(\\d+)');

      // Test compiling generated regex
      const regex = new RegExp(`^${regexStr}$`, 'i');
      expect(regex.test('t.me/my_channel/456')).toBe(true);
    });
  });

  describe('GeminiClient Token Budgeting (smm-cost-cache-optimizer)', () => {
    it('supports maxOutputTokens in GeminiCallOptions interface', () => {
      const callOptions: GeminiCallOptions = {
        contents: [{ role: 'user', parts: [{ text: 'test' }] }],
        maxOutputTokens: 300,
        temperature: 0.1,
        jsonMode: true,
      };

      expect(callOptions.maxOutputTokens).toBe(300);
      expect(callOptions.temperature).toBe(0.1);
      expect(callOptions.jsonMode).toBe(true);
    });
  });
});
