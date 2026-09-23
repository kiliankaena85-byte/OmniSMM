import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HardenedAntiFraudService } from '../hardened-antifraud.service';
import { redis } from '@/lib/redis';
import { SecurityAlertService } from '../security-alert.service';

vi.mock('@/lib/redis', () => ({
  redis: {
    sadd: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    scard: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../security-alert.service', () => ({
  SecurityAlertService: {
    record: vi.fn().mockResolvedValue({ id: 'sec-event-1' }),
  },
}));

describe('HardenedAntiFraudService (100% Defense Standard)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate deterministic hardware SHA-256 hash from device attributes', () => {
    const fp1 = {
      screenRes: '1920x1080',
      timezone: 'Europe/Moscow',
      language: 'ru-RU',
      webglRenderer: 'NVIDIA GeForce RTX 4080',
      canvasHash: 'canvas_sig_abc123',
    };

    const hash1 = HardenedAntiFraudService.generateDeviceHash(fp1);
    const hash2 = HardenedAntiFraudService.generateDeviceHash(fp1);
    const hash3 = HardenedAntiFraudService.generateDeviceHash({ ...fp1, timezone: 'America/New_York' });

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash1).toHaveLength(64); // SHA-256 hex string
  });

  it('should detect superhuman bot submission speed (<250ms)', async () => {
    const result = await HardenedAntiFraudService.evaluate({
      ip: '194.26.29.11',
      formRenderTimeMs: 1000,
      formSubmitTimeMs: 1120, // 120ms fill time
      userId: 'usr_bot_01',
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.reasons.some((r) => r.includes('Superhuman form submission speed'))).toBe(true);
  });

  it('should block device attempting multi-accounting across >3 accounts in 24h', async () => {
    vi.mocked(redis.scard).mockResolvedValueOnce(5); // 5th account from same hardware

    const result = await HardenedAntiFraudService.evaluate({
      ip: '185.220.101.5',
      formRenderTimeMs: 1000,
      formSubmitTimeMs: 3500, // Organic 2.5s time
      userId: 'usr_fraud_ring_5',
      fingerprint: { canvasHash: 'hardware_sig_999' },
    });

    expect(result.riskScore).toBeGreaterThanOrEqual(45);
    expect(result.reasons.some((r) => r.includes('Device fingerprint linked to 5 accounts'))).toBe(true);
  });

  it('should generate and verify cryptographic Proof-of-Work challenge', () => {
    const { challenge, targetZeros } = HardenedAntiFraudService.generatePowChallenge('192.168.1.1');
    expect(challenge).toBeTypeOf('string');
    expect(targetZeros).toBe(4);

    // Solve PoW in test
    let nonce = 0;
    let solved = false;
    while (!solved && nonce < 100000) {
      nonce++;
      if (HardenedAntiFraudService.verifyPowSolution(challenge, nonce.toString(), targetZeros)) {
        solved = true;
        break;
      }
    }

    expect(solved).toBe(true);
    expect(HardenedAntiFraudService.verifyPowSolution(challenge, 'invalid_nonce', targetZeros)).toBe(false);
  });
});
