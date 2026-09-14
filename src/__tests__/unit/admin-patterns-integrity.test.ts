import { describe, it, expect } from 'vitest';
import { SafeRegexValidator } from '@/services/analyzer/safe-regex.validator';

describe('Admin Link Patterns & ReDoS Security Integrity (Step 6)', () => {
  it('should pass audit for safe URL matching patterns', () => {
    const validPatterns = [
      '^https?:\\/\\/t\\.me\\/([a-zA-Z0-9_]{5,32})$',
      '^https?:\\/\\/t\\.me\\/([a-zA-Z0-9_]{5,32})\\/(\\d+)$',
      '^https?:\\/\\/vk\\.com\\/wall(-?\\d+_\\d+)$',
      '^https?:\\/\\/www\\.youtube\\.com\\/watch\\?v=([a-zA-Z0-9_-]{11})$',
      '^https?:\\/\\/www\\.instagram\\.com\\/p\\/([a-zA-Z0-9_-]+)',
    ];

    for (const pattern of validPatterns) {
      const audit = SafeRegexValidator.staticAudit(pattern);
      expect(audit.isSafe).toBe(true);
      expect(audit.reason).toBeUndefined();
    }
  });

  it('should detect and reject dangerous ReDoS patterns with nested quantifiers', () => {
    const redosPatterns = [
      '(a+)+',
      '(.*)+',
      '([a-z]+)*',
      '(x+x+)+',
      '(a+){2,}',
      '(a*)*',
      '(.+)+',
    ];

    for (const pattern of redosPatterns) {
      const audit = SafeRegexValidator.staticAudit(pattern);
      expect(audit.isSafe).toBe(false);
      expect(audit.reason).toContain('ReDoS');
    }
  });

  it('should reject excessively long regex patterns over 300 characters', () => {
    const longPattern = '^https?:\\/\\/' + 'a'.repeat(301) + '$';
    const audit = SafeRegexValidator.staticAudit(longPattern);
    expect(audit.isSafe).toBe(false);
    expect(audit.reason).toContain('Слишком длинное');
  });

  it('should reject URLs exceeding 512 characters in testPattern', () => {
    const pattern = '^https?:\\/\\/t\\.me\\/([a-zA-Z0-9_]+)$';
    const longUrl = 'https://t.me/' + 'x'.repeat(600);

    const result = SafeRegexValidator.testPattern(pattern, longUrl);
    expect(result.isValid).toBe(false);
    expect(result.isSafe).toBe(false);
    expect(result.error).toContain('лимит безопасности');
  });

  it('should correctly match and extract capture groups on valid URLs', () => {
    const channelPattern = '^https?:\\/\\/t\\.me\\/([a-zA-Z0-9_]{5,32})$';
    const postPattern = '^https?:\\/\\/t\\.me\\/([a-zA-Z0-9_]{5,32})\\/(\\d+)$';

    // Channel match
    const resChannel = SafeRegexValidator.testPattern(channelPattern, 'https://t.me/durov');
    expect(resChannel.isValid).toBe(true);
    expect(resChannel.isSafe).toBe(true);
    expect(resChannel.isMatch).toBe(true);
    expect(resChannel.extractedGroups).toContain('durov');

    // Post match
    const resPost = SafeRegexValidator.testPattern(postPattern, 'https://t.me/durov/1234');
    expect(resPost.isValid).toBe(true);
    expect(resPost.isSafe).toBe(true);
    expect(resPost.isMatch).toBe(true);
    expect(resPost.extractedGroups).toEqual(['durov', '1234']);
  });
});
