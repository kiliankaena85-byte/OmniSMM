import { describe, it, expect, vi } from 'vitest';
import { checkFingerprintPoolLimit } from '@/lib/security/ddos-shield/token-bucket-pool';

describe('DDoS Shield Fingerprint Token Bucket Pool (SPEC-2026-09-11)', () => {
  it('allows requests within limit and throttles when pool limit is exceeded', async () => {
    let callCount = 0;
    const mockRedis = {
      zremrangebyscore: vi.fn(async () => 0),
      zcard: vi.fn(async () => callCount),
      zadd: vi.fn(async () => {
        callCount++;
        return 1;
      }),
      expire: vi.fn(async () => 1),
    };

    const fp = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const limit = 5;
    const windowSeconds = 60;

    // Requests 1..5 should pass
    for (let i = 0; i < limit; i++) {
      const result = await checkFingerprintPoolLimit(fp, 'smmplan', limit, windowSeconds, mockRedis as any);
      expect(result.isAllowed).toBe(true);
      expect(result.remaining).toBe(limit - (i + 1));
    }

    // 6th request should exceed limit
    const blockedResult = await checkFingerprintPoolLimit(fp, 'smmplan', limit, windowSeconds, mockRedis as any);
    expect(blockedResult.isAllowed).toBe(false);
    expect(blockedResult.remaining).toBe(0);
  });

  it('fails open safely if Redis throws an exception', async () => {
    const errorRedis = {
      zremrangebyscore: vi.fn(async () => {
        throw new Error('Redis connection timeout');
      }),
    };

    const result = await checkFingerprintPoolLimit('any-fp', 'smmplan', 10, 60, errorRedis as any);
    expect(result.isAllowed).toBe(true); // Fail-open invariant
  });
});
