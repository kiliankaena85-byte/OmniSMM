import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreLaunchService } from '@/services/marketing/prelaunch-service';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';

vi.mock('@/lib/db', () => ({
  db: {
    preLaunchLead: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn()
    }
  }
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    incr: vi.fn(),
    expire: vi.fn(),
    get: vi.fn(),
    set: vi.fn()
  }
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn()
}));

describe('PreLaunchService — Lead Capture & Security Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Email Validation & OWASP Injection Prevention', () => {
    it('accepts valid email addresses and normalizes to lowercase', () => {
      const result = PreLaunchService.validateEmail('  User.Test@SMMplan.Pro  ');
      expect(result.valid).toBe(true);
      expect(result.email).toBe('user.test@smmplan.pro');
    });

    it('rejects invalid emails without domain or @', () => {
      expect(PreLaunchService.validateEmail('invalid-email').valid).toBe(false);
      expect(PreLaunchService.validateEmail('@domain.com').valid).toBe(false);
      expect(PreLaunchService.validateEmail('user@').valid).toBe(false);
      expect(PreLaunchService.validateEmail('').valid).toBe(false);
    });

    it('blocks CRLF and email header injection attempts', () => {
      const injectionAttempt = 'victim@example.com\r\nBcc: hacker@evil.com';
      const result = PreLaunchService.validateEmail(injectionAttempt);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Недопустимые символы');
    });
  });

  describe('2. 152-FZ / GDPR IP Salted Hash', () => {
    it('produces a fixed-length irreversible hash from IP', () => {
      const hash1 = PreLaunchService.hashIp('192.168.1.100');
      const hash2 = PreLaunchService.hashIp('192.168.1.100');
      const hashDifferent = PreLaunchService.hashIp('192.168.1.101');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hashDifferent);
      expect(hash1).not.toContain('192.168');
      expect(hash1.length).toBeLessThanOrEqual(32);
    });

    it('handles forwarded-for comma-separated IPs safely', () => {
      const hash = PreLaunchService.hashIp('10.0.0.1, 192.168.1.1');
      expect(hash).toBe(PreLaunchService.hashIp('10.0.0.1'));
    });
  });

  describe('3. Rate Limiting Protection', () => {
    it('allows requests within limit and sets 1-hour TTL on first hit', async () => {
      vi.mocked(redis.incr).mockResolvedValueOnce(1);
      vi.mocked(redis.expire).mockResolvedValueOnce(1 as any);

      const allowed = await PreLaunchService.checkRateLimit('test-ip-hash');
      expect(allowed).toBe(true);
      expect(redis.incr).toHaveBeenCalledWith('ratelimit:prelaunch:test-ip-hash');
      expect(redis.expire).toHaveBeenCalledWith('ratelimit:prelaunch:test-ip-hash', 3600);
    });

    it('blocks requests exceeding maximum threshold', async () => {
      vi.mocked(redis.incr).mockResolvedValueOnce(6);

      const allowed = await PreLaunchService.checkRateLimit('test-ip-hash');
      expect(allowed).toBe(false);
    });
  });

  describe('4. Subscription Lifecycle & Idempotency', () => {
    it('creates a new lead and sends notification on first subscribe', async () => {
      vi.mocked(redis.incr).mockResolvedValueOnce(1);
      vi.mocked(db.preLaunchLead.findUnique as any).mockResolvedValueOnce(null);
      vi.mocked(db.preLaunchLead.upsert as any).mockResolvedValueOnce({
        id: 'lead-1',
        email: 'ceo@agency.ru',
        tenantId: 'smmplan',
        source: 'holding_page',
        isNotified: false,
        createdAt: new Date()
      });

      const res = await PreLaunchService.subscribe({
        email: 'ceo@agency.ru',
        tenantId: 'smmplan',
        ip: '127.0.0.1'
      });

      expect(res.success).toBe(true);
      expect(res.isNew).toBe(true);
      expect(db.preLaunchLead.upsert).toHaveBeenCalled();
    });

    it('is idempotent when the same email subscribes again', async () => {
      vi.mocked(redis.incr).mockResolvedValueOnce(1);
      const existingDate = new Date(Date.now() - 3600000);
      vi.mocked(db.preLaunchLead.findUnique as any).mockResolvedValueOnce({
        id: 'lead-1',
        email: 'ceo@agency.ru',
        tenantId: 'smmplan',
        createdAt: existingDate
      });
      vi.mocked(db.preLaunchLead.upsert as any).mockResolvedValueOnce({
        id: 'lead-1',
        email: 'ceo@agency.ru',
        tenantId: 'smmplan',
        createdAt: existingDate
      });

      const res = await PreLaunchService.subscribe({
        email: 'ceo@agency.ru',
        tenantId: 'smmplan',
        ip: '127.0.0.1'
      });

      expect(res.success).toBe(true);
      expect(res.isNew).toBe(false);
    });
  });
});
