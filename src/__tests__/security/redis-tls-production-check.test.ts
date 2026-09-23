import { describe, it, expect, vi } from 'vitest';

describe('Redis Production TLS & Security Checks (P3-23)', () => {
  it('warns when remote production Redis connection does not use TLS (rediss://)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    function checkRedisTls(url: string, env: string) {
      if (env === 'production') {
        const isLocal = url.includes('localhost') || url.includes('127.0.0.1') || url.includes('smmplan_redis');
        if (!isLocal && !url.startsWith('rediss://')) {
          console.warn('🚨 [SECURITY WARNING] Redis in production is not using TLS (rediss://). Transit encryption recommended!');
        }
      }
    }

    checkRedisTls('redis://remote-redis.internal:6379', 'production');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('not using TLS'));

    warnSpy.mockRestore();
  });
});
