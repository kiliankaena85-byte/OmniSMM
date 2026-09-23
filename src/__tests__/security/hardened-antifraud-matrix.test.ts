import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HardenedAntiFraudService } from '@/services/security/hardened-antifraud.service';
import { redis } from '@/lib/redis';
import { SecurityAlertService } from '@/services/security/security-alert.service';

vi.mock('@/lib/redis', () => ({
  redis: {
    sadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    scard: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('@/services/security/security-alert.service', () => ({
  SecurityAlertService: {
    record: vi.fn().mockResolvedValue({ id: 'sec-alert-mock' }),
  },
}));

describe('OWASP ASVS V10 (2026) Anti-Automation & Anti-Fraud Security Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[OWASP ASVS 10.3.1] Hardware Entropy & Fingerprint Consistency: Identical hardware traits yield immutable SHA-256 hash', () => {
    const rawDevice = {
      screenRes: '2560x1440',
      timezone: 'Europe/Moscow',
      language: 'ru-RU',
      webglRenderer: 'Apple M3 Max GPU',
      canvasHash: 'canvas_render_hash_4f89a2',
      hardwareConcurrency: 16,
    };

    const hashA = HardenedAntiFraudService.generateDeviceHash(rawDevice);
    const hashB = HardenedAntiFraudService.generateDeviceHash(rawDevice);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/); // 256-bit hex hash
  });

  it('[OWASP ASVS 10.3.2] Human Interaction Velocity Discrimination: Sub-250ms robotic submissions are penalized with high risk score', async () => {
    const renderTime = 10000;
    const roboticSubmitTime = 10150; // 150ms fill time

    const result = await HardenedAntiFraudService.evaluate({
      ip: '91.240.118.42',
      formRenderTimeMs: renderTime,
      formSubmitTimeMs: roboticSubmitTime,
      userId: 'usr_automated_bot_99',
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.reasons).toContain('Superhuman form submission speed (150ms < 250ms)');
  });

  it('[OWASP ASVS 10.3.3] Device Multi-Accounting Barrier: Limits 1 physical device to <= 3 accounts per 24h window', async () => {
    // Simulate 4th account from same hardware
    vi.mocked(redis.scard).mockResolvedValueOnce(4);

    const result = await HardenedAntiFraudService.evaluate({
      ip: '178.62.204.18',
      formRenderTimeMs: 10000,
      formSubmitTimeMs: 13500, // 3.5s normal human speed
      userId: 'usr_account_4',
      fingerprint: { canvasHash: 'unique_gpu_canvas_sig' },
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(45);
    expect(result.reasons.some((r) => r.includes('linked to 4 accounts in 24h'))).toBe(true);
    expect(SecurityAlertService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'SUSPICIOUS_DEVICE_BEHAVIOR',
        severity: 'WARNING',
      })
    );
  });

  it('[OWASP ASVS 10.3.4] Proof-of-Work (PoW) Challenge Integrity: Nonce computation verifies against difficulty target', () => {
    const clientIp = '195.201.201.201';
    const { challenge, targetZeros } = HardenedAntiFraudService.generatePowChallenge(clientIp);

    expect(targetZeros).toBe(4);

    // Compute valid nonce
    let validNonce = '';
    for (let i = 0; i < 500000; i++) {
      if (HardenedAntiFraudService.verifyPowSolution(challenge, i.toString(), targetZeros)) {
        validNonce = i.toString();
        break;
      }
    }

    expect(validNonce).not.toBe('');
    expect(HardenedAntiFraudService.verifyPowSolution(challenge, validNonce, targetZeros)).toBe(true);
    expect(HardenedAntiFraudService.verifyPowSolution(challenge, 'tampered_nonce', targetZeros)).toBe(false);
  });
});
