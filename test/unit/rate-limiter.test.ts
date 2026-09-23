import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { redis } from '@/lib/redis';
import { db } from '@/lib/db';

describe('Security: Rate Limiter Fail-Closed / Fail-Open Boundaries', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalEnv = process.env.ENABLE_RATE_LIMIT_TEST;
    process.env.ENABLE_RATE_LIMIT_TEST = 'true';
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ENABLE_RATE_LIMIT_TEST;
    } else {
      process.env.ENABLE_RATE_LIMIT_TEST = originalEnv;
    }
  });

  it('Blocks traffic (429 / false) when both Redis and Postgres fail, if failClosed = true (Auth Endpoints)', async () => {
    // 1. Mock Redis to fail
    vi.spyOn(redis, 'eval').mockRejectedValue(new Error('Redis connection lost'));
    
    // 2. Mock Postgres to fail
    vi.spyOn(db.rateLimit, 'findUnique').mockRejectedValue(new Error('Postgres connection lost'));
    vi.spyOn(db.rateLimit, 'deleteMany').mockRejectedValue(new Error('Postgres connection lost'));

    // 3. Mock IP
    vi.mock('@/utils/ip', () => ({
      getClientIp: vi.fn().mockResolvedValue('127.0.0.1')
    }));

    // Action: Auth endpoint with failClosed = true
    const isAllowed = await RateLimitService.check('auth-login', 5, 60, true);

    // Assert: Must be strictly blocked to prevent brute-force when DBs are down
    expect(isAllowed).toBe(false);
  });

  it('Allows traffic (200 / true) when both Redis and Postgres fail, if failClosed = false (Public Endpoints)', async () => {
    // 1. Mock Redis to fail
    vi.spyOn(redis, 'eval').mockRejectedValue(new Error('Redis connection lost'));
    
    // 2. Mock Postgres to fail
    vi.spyOn(db.rateLimit, 'findUnique').mockRejectedValue(new Error('Postgres connection lost'));
    vi.spyOn(db.rateLimit, 'deleteMany').mockRejectedValue(new Error('Postgres connection lost'));

    // 3. Mock IP
    vi.mock('@/utils/ip', () => ({
      getClientIp: vi.fn().mockResolvedValue('127.0.0.1')
    }));

    // Action: Public catalog endpoint with failClosed = false
    const isAllowed = await RateLimitService.check('public-catalog', 5, 60, false);

    // Assert: Must fail-open so users can still read the site even if RateLimiter is degraded
    expect(isAllowed).toBe(true);
  });
});
