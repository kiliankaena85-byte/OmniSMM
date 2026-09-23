import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkCheckoutVelocity } from '../velocity-check';
import { resetRateLimit } from '@/lib/security/rate-limit';
import crypto from 'crypto';

describe('PREM-04: Anti-Fraud Velocity Engine', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows normal checkout rate under velocity thresholds', async () => {
    const res = await checkCheckoutVelocity({
      ip: '198.51.100.55',
      email: 'honest_client@smmplan.local',
      amountRub: 500,
    });

    expect(res.allowed).toBe(true);
    expect(res.riskScore).toBeLessThan(50);
  });

  it('blocks rapid IP checkout attempts when exceeding 10 per window', async () => {
    const testIp = '203.0.113.199';
    const ipHash = crypto.createHash('sha256').update(testIp).digest('hex').slice(0, 16);
    await resetRateLimit(`fraud:vel:ip:${ipHash}`);

    for (let i = 0; i < 10; i++) {
      await checkCheckoutVelocity({
        ip: testIp,
        email: `client_${i}@smmplan.local`,
        amountRub: 100,
      });
    }

    // 11th attempt must be blocked
    const blockedRes = await checkCheckoutVelocity({
      ip: testIp,
      email: 'client_blocked@smmplan.local',
      amountRub: 100,
    });

    expect(blockedRes.allowed).toBe(false);
    expect(blockedRes.requires3DS).toBe(true);
    expect(blockedRes.riskScore).toBeGreaterThanOrEqual(70);

    await resetRateLimit(`fraud:vel:ip:${ipHash}`);
  });

  it('enforces 3DS for high-value transactions (> 15,000 RUB)', async () => {
    const res = await checkCheckoutVelocity({
      ip: '198.51.100.77',
      email: 'whale@smmplan.local',
      amountRub: 25000,
    });

    expect(res.requires3DS).toBe(true);
    expect(res.riskScore).toBeGreaterThan(0);
  });
});
