import { describe, it, expect } from 'vitest';
import { stripQueryParams, inferPlatformFromInput, normalizeUsername, MAX_SAFE_URL_LENGTH } from '@/utils/link-normalizer';
import { IntelligenceLinkAnalyzer } from '@/services/analyzer/link-analyzer';

describe('SEC-02: Server-Only & URL Length / ReDoS Boundary Defense', () => {
  it('should enforce MAX_SAFE_URL_LENGTH in link-normalizer utils', () => {
    const hugeTracking = 'https://instagram.com/p/C12345/?utm_source=' + 'A'.repeat(5000);
    const cleaned = stripQueryParams(hugeTracking);
    expect(cleaned.length).toBeLessThanOrEqual(MAX_SAFE_URL_LENGTH);
  });

  it('should handle ultra-long malicious inputs without ReDoS or memory panic in inferPlatformFromInput', () => {
    const hugeMalformed = 'https://instagram.com/' + 'a'.repeat(10000);
    const platform = inferPlatformFromInput(hugeMalformed);
    expect(platform).toBe('instagram');
  });

  it('should safely normalize handles and truncate excessive lengths in normalizeUsername', () => {
    const hugeHandle = '@' + 'validuser'.repeat(100);
    const result = normalizeUsername(hugeHandle, 'instagram');
    expect(result.length).toBeLessThanOrEqual(MAX_SAFE_URL_LENGTH);
  });

  it('should safely analyze ultra-long URL in IntelligenceLinkAnalyzer within milliseconds', async () => {
    const analyzer = new IntelligenceLinkAnalyzer();
    const maliciousPayload = 'https://t.me/durov?' + 'param='.repeat(1000) + 'test';
    
    const startTime = Date.now();
    const result = await analyzer.analyze(maliciousPayload);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(1000);
    expect(result.platform).toBe('TELEGRAM');
  });
});
