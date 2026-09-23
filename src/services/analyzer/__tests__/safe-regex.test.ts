import { describe, it, expect } from 'vitest';
import { SafeRegexValidator } from '../safe-regex.validator';
import { UrlCleaner } from '../url-cleaner';

describe('UrlCleaner & Normalizer', () => {
  it('should strip tracking parameters (UTM, igsh, si, fbclid)', () => {
    const raw = 'https://www.instagram.com/p/C12345/?utm_source=telegram&igsh=abcdef&si=tracker99';
    const cleaned = UrlCleaner.clean(raw);
    expect(cleaned).toBe('instagram.com/p/C12345');
  });

  it('should normalize mobile subdomains and YouTube short links', () => {
    const rawYt = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef';
    const cleanedYt = UrlCleaner.clean(rawYt);
    expect(cleanedYt).toBe('youtube.com/watch?v=dQw4w9WgXcQ');

    const rawVk = 'https://m.vk.com/wall-123_456?ref=group';
    const cleanedVk = UrlCleaner.clean(rawVk);
    expect(cleanedVk).toBe('vk.com/wall-123_456');
  });

  it('should preserve Telegram handles starting with @', () => {
    const raw = '@durov_channel';
    const cleaned = UrlCleaner.clean(raw);
    expect(cleaned).toBe('@durov_channel');
  });
});

describe('SafeRegexValidator - ReDoS Audit & Benchmarks', () => {
  it('should detect and block hazardous ReDoS patterns with nested quantifiers', () => {
    const hazardous1 = '(a+)+$';
    const audit1 = SafeRegexValidator.staticAudit(hazardous1);
    expect(audit1.isSafe).toBe(false);

    const hazardous2 = '([a-z0-9]+)*';
    const audit2 = SafeRegexValidator.staticAudit(hazardous2);
    expect(audit2.isSafe).toBe(false);

    const hazardous3 = '(.*)+';
    const audit3 = SafeRegexValidator.staticAudit(hazardous3);
    expect(audit3.isSafe).toBe(false);
  });

  it('should approve safe standard patterns', () => {
    const safe1 = 't\\.me\\/[\\w-]+\\/(\\d+)';
    const audit1 = SafeRegexValidator.staticAudit(safe1);
    expect(audit1.isSafe).toBe(true);

    const safe2 = 'instagram\\.com\\/(?:p|reel)\\/([\\w-]+)';
    const audit2 = SafeRegexValidator.staticAudit(safe2);
    expect(audit2.isSafe).toBe(true);
  });

  it('should benchmark execution time and extract capture groups', () => {
    const pattern = 't\\.me\\/([\\w-]+)\\/(\\d+)';
    const url = 't.me/durov/42';
    const res = SafeRegexValidator.testPattern(pattern, url);

    expect(res.isValid).toBe(true);
    expect(res.isSafe).toBe(true);
    expect(res.isMatch).toBe(true);
    expect(res.extractedGroups).toEqual(['durov', '42']);
    expect(res.executionTimeMs).toBeLessThan(10);
  });

  it('should convert No-Code masks into safe regular expressions', () => {
    const mask = 't.me/{channel}/{postId}';
    const regex = SafeRegexValidator.maskToRegex(mask);

    expect(regex).toBe('t\\.me\\/([-_a-zA-Z0-9.]+)\\/(\\d+)');

    const testRes = SafeRegexValidator.testPattern(regex, 't.me/my_channel/105');
    expect(testRes.isMatch).toBe(true);
    expect(testRes.extractedGroups).toEqual(['my_channel', '105']);
  });
});
