import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeRedirectUrl } from '@/lib/security/redirect-guard';
import { ProviderSyncMutex } from '@/services/providers/provider-sync-mutex';
import { redis } from '@/lib/redis';

vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn(),
    eval: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Resilience & Hardening Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RedirectGuard (Open-Redirect Prevention)', () => {
    it('allows clean relative internal paths', () => {
      expect(sanitizeRedirectUrl('/dashboard')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/admin/orders?page=2')).toBe('/admin/orders?page=2');
    });

    it('blocks protocol-relative URLs (//evil.com)', () => {
      expect(sanitizeRedirectUrl('//evil.com/phish')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('///evil.com')).toBe('/dashboard');
    });

    it('blocks backslash escape variations', () => {
      expect(sanitizeRedirectUrl('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('\\evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('/%5Cevil.com')).toBe('/dashboard');
    });

    it('blocks external malicious absolute URLs', () => {
      expect(sanitizeRedirectUrl('https://evil-phishing.com/login')).toBe('/dashboard');
      expect(sanitizeRedirectUrl('javascript:alert(1)')).toBe('/dashboard');
    });

    it('allows whitelisted domains and returns internal path', () => {
      expect(sanitizeRedirectUrl('https://smmplan.pro/profile')).toBe('/profile');
      expect(sanitizeRedirectUrl('https://test.smmplan.pro/admin')).toBe('/admin');
    });
  });

  describe('ProviderSyncMutex (Thundering Herd Defense)', () => {
    it('acquires lock when key is free', async () => {
      vi.mocked(redis.set).mockResolvedValue('OK' as any);
      const release = await ProviderSyncMutex.acquire('provider-alpha');
      expect(release).toBeTypeOf('function');
      expect(redis.set).toHaveBeenCalledWith(
        'lock:provider:sync:provider-alpha',
        expect.any(String),
        'EX',
        180,
        'NX'
      );
    });

    it('returns null when sync is already running', async () => {
      vi.mocked(redis.set).mockResolvedValue(null as any);
      const release = await ProviderSyncMutex.acquire('provider-alpha');
      expect(release).toBeNull();
    });

    it('releases lock cleanly via Lua script token match', async () => {
      vi.mocked(redis.set).mockResolvedValue('OK' as any);
      vi.mocked(redis.eval).mockResolvedValue(1 as any);

      const release = await ProviderSyncMutex.acquire('provider-alpha');
      expect(release).not.toBeNull();
      await release!();

      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('redis.call("get", KEYS[1]) == ARGV[1]'),
        1,
        'lock:provider:sync:provider-alpha',
        expect.any(String)
      );
    });
  });
});
