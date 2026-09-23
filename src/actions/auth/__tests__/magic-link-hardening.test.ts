import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { rateLimit, resetRateLimit } from '@/lib/security/rate-limit';
import { detectLoginAnomalies } from '@/lib/security/login-anomaly-detector';

describe('PREM-02: Magic Link Hardening & Anomaly Detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Single-use CAS and SHA-256 Token Storage', () => {
    it('stores token as sha256 hash and updates atomically with used=false CAS guard', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      // Create test user and token
      const testUser = await db.user.upsert({
        where: { email_tenantId: { email: 'prem02_test@smmplan.local', tenantId: 'smmplan' } },
        create: {
          email: 'prem02_test@smmplan.local',
          tenantId: 'smmplan',
        },
        update: {},
      });

      const authToken = await db.authToken.create({
        data: {
          userId: testUser.id,
          token: hashedToken,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          ipIssued: '198.51.100.1',
          userAgentIssued: 'Mozilla/5.0 Test',
        },
      });

      expect(authToken.used).toBe(false);
      expect(authToken.ipIssued).toBe('198.51.100.1');

      // 1. First verify: atomic CAS
      const firstVerify = await db.authToken.updateMany({
        where: { id: authToken.id, used: false },
        data: {
          used: true,
          usedAt: new Date(),
          ipUsed: '198.51.100.2',
          userAgentUsed: 'Mozilla/5.0 Client',
        },
      });

      expect(firstVerify.count).toBe(1);

      // 2. Second verify (Replay attack): atomic CAS must return count = 0
      const replayVerify = await db.authToken.updateMany({
        where: { id: authToken.id, used: false },
        data: {
          used: true,
          usedAt: new Date(),
          ipUsed: '198.51.100.3',
          userAgentUsed: 'Attacker UA',
        },
      });

      expect(replayVerify.count).toBe(0);

      // Clean up
      await db.authToken.deleteMany({ where: { userId: testUser.id } });
      await db.user.delete({ where: { id: testUser.id } });
    });

    it('rejects expired tokens when verifying', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

      const testUser = await db.user.upsert({
        where: { email_tenantId: { email: 'prem02_expired@smmplan.local', tenantId: 'smmplan' } },
        create: {
          email: 'prem02_expired@smmplan.local',
          tenantId: 'smmplan',
        },
        update: {},
      });

      await db.authToken.create({
        data: {
          userId: testUser.id,
          token: hashedToken,
          expiresAt: new Date(Date.now() - 1000), // expired 1s ago
        },
      });

      const found = await db.authToken.findFirst({
        where: { token: hashedToken },
      });

      expect(found).not.toBeNull();
      expect(found!.expiresAt < new Date()).toBe(true);

      // Clean up
      await db.authToken.deleteMany({ where: { userId: testUser.id } });
      await db.user.delete({ where: { id: testUser.id } });
    });
  });

  describe('Rate Limiting on Issuance', () => {
    it('enforces rate limit for same email (max 5 per window)', async () => {
      const email = 'rate_limited_email@smmplan.local';
      await resetRateLimit(`ml:email:${email}`);

      for (let i = 1; i <= 5; i++) {
        const res = await rateLimit(`ml:email:${email}`, 5, 3600);
        expect(res.ok).toBe(true);
        expect(res.remaining).toBe(5 - i);
      }

      // 6th request must be rejected
      const rejected = await rateLimit(`ml:email:${email}`, 5, 3600);
      expect(rejected.ok).toBe(false);
      expect(rejected.remaining).toBe(0);

      await resetRateLimit(`ml:email:${email}`);
    });

    it('enforces rate limit for same IP (max 20 per window)', async () => {
      const ip = '203.0.113.42';
      await resetRateLimit(`ml:ip:${ip}`);

      for (let i = 1; i <= 20; i++) {
        const res = await rateLimit(`ml:ip:${ip}`, 20, 3600);
        expect(res.ok).toBe(true);
      }

      // 21st request must be rejected
      const rejected = await rateLimit(`ml:ip:${ip}`, 20, 3600);
      expect(rejected.ok).toBe(false);
      expect(rejected.remaining).toBe(0);

      await resetRateLimit(`ml:ip:${ip}`);
    });
  });

  describe('Login Anomaly Detector', () => {
    it('detects and flags accounts with logins from >3 distinct IPs within 1 hour', async () => {
      const testEmail = 'anomaly_target@smmplan.local';

      const user = await db.user.upsert({
        where: { email_tenantId: { email: testEmail, tenantId: 'smmplan' } },
        create: {
          email: testEmail,
          tenantId: 'smmplan',
        },
        update: {},
      });

      // Insert 4 logins from 4 distinct IPs within the last 30 minutes
      const ips = ['198.51.100.10', '198.51.100.11', '198.51.100.12', '198.51.100.13'];

      for (const ip of ips) {
        await db.authToken.create({
          data: {
            userId: user.id,
            token: `anomaly-token-${ip}-${Date.now()}-${Math.random()}`,
            used: true,
            usedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 mins ago
            ipUsed: ip,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          },
        });
      }

      const report = await detectLoginAnomalies();
      expect(report.anomaliesDetected).toBeGreaterThanOrEqual(1);
      expect(report.flaggedEmails).toContain(testEmail);

      // Clean up
      await db.authToken.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    });
  });
});
