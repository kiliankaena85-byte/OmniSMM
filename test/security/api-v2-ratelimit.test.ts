/**
 * QA-4: Security & Penetration Tester
 * Test Suite: API v2 Rate Limiting
 * Standards: OWASP ASVS §13.1.5 (Rate Limiting), OWASP A04
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/v2/route';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

vi.mock('@/lib/b2b-auth', () => ({
  verifyB2BKey: vi.fn().mockResolvedValue({ id: 'user-b2b-1', balance: 50000 })
}));

describe('B2B API v2 Rate Limiter (QA-4)', () => {
  let origEnv: string | undefined;

  beforeEach(async () => {
    origEnv = process.env.ENABLE_RATE_LIMIT_TEST;
    process.env.ENABLE_RATE_LIMIT_TEST = 'true';

    // W3-4: The key is hashed before being rate-limited in API v2
    const crypto = await import('crypto');
    const hashedKey = crypto.createHash('sha256').update('test-rate-key').digest('hex');

    // Reset redis keys for ratelimit
    if (redis.status === 'ready') {
      const keys = await redis.keys(`ratelimit:custom:${hashedKey}`);
      if (keys.length > 0) await redis.del(keys);
    }
    // Delete postgres records just in case it falls back
    await db.rateLimit.deleteMany({ where: { ip: 'CUSTOM_KEY', endpoint: hashedKey } });
  });

  afterEach(() => {
    if (origEnv !== undefined) {
      process.env.ENABLE_RATE_LIMIT_TEST = origEnv;
    } else {
      delete process.env.ENABLE_RATE_LIMIT_TEST;
    }
  });

  it('TC-SEC-018: Should block exactly after 50 requests', async () => {
    // Generate 60 concurrent requests
    const createReq = () => {
      const formData = new FormData();
      formData.append('key', 'test-rate-key');
      formData.append('action', 'services');

      return {
        formData: async () => formData,
      } as unknown as NextRequest;
    };

    const responses = [];
    for (let i = 0; i < 60; i++) {
      responses.push(await POST(createReq()));
    }

    // Count allowed vs blocked
    const allowed = responses.filter(r => r.status === 200 || r.status === 400); // 400 is fine if verifyB2B fails, but here we expect 200
    const blocked = responses.filter(r => r.status === 429);

    // We expect exactly 50 allowed, and 10 blocked
    expect(allowed.length).toBe(50);
    expect(blocked.length).toBe(10);
    
    // Check error message
    const errorJson = await blocked[0].json();
    expect(errorJson.error).toContain('Too many requests. Limit 50/minute.');
  });
});
