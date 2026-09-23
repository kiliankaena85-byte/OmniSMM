import { describe, it, expect, vi } from 'vitest';
import { 
  recordHoneypotViolation, 
  isBlacklistedDdosTarget 
} from '@/lib/security/ddos-shield/honeypot-service';

describe('Honeypot Trap & Blacklist Defense (SPEC-2026-09-11)', () => {
  it('identifies and blacklists bot when honeypot is accessed', async () => {
    const memoryStore = new Map<string, string>();
    const mockRedis = {
      set: vi.fn(async (key: string, val: string) => {
        memoryStore.set(key, val);
        return 'OK';
      }),
      get: vi.fn(async (key: string) => memoryStore.get(key) || null),
    };

    const attackerIp = '203.0.113.42';
    const attackerFp = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    await recordHoneypotViolation(attackerIp, attackerFp, mockRedis as any);

    expect(mockRedis.set).toHaveBeenCalledWith(`blacklist:ddos:ip:${attackerIp}`, '1', 'EX', 86400);
    expect(mockRedis.set).toHaveBeenCalledWith(`blacklist:ddos:fp:${attackerFp}`, '1', 'EX', 86400);

    const isBlockedIp = await isBlacklistedDdosTarget(attackerIp, 'some-other-fp', mockRedis as any);
    expect(isBlockedIp).toBe(true);

    const isBlockedFp = await isBlacklistedDdosTarget('99.99.99.99', attackerFp, mockRedis as any);
    expect(isBlockedFp).toBe(true);

    const isClean = await isBlacklistedDdosTarget('12.34.56.78', 'clean-fp', mockRedis as any);
    expect(isClean).toBe(false);
  });
});
