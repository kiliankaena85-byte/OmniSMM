import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { assertSafeOutboundUrl, safeFetch, isPublicIp } from '../ssrf-guard';
import { promises as dns } from 'node:dns';

describe('PREM-01: SSRF Guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isPublicIp', () => {
    it('returns false for loopback addresses', () => {
      expect(isPublicIp('127.0.0.1')).toBe(false);
      expect(isPublicIp('127.1.2.3')).toBe(false);
      expect(isPublicIp('::1')).toBe(false);
    });

    it('returns false for RFC1918 private IPv4 ranges', () => {
      expect(isPublicIp('10.0.0.1')).toBe(false);
      expect(isPublicIp('10.255.255.255')).toBe(false);
      expect(isPublicIp('172.16.0.1')).toBe(false);
      expect(isPublicIp('172.31.255.255')).toBe(false);
      expect(isPublicIp('192.168.1.1')).toBe(false);
    });

    it('returns false for link-local & cloud metadata IP 169.254.169.254', () => {
      expect(isPublicIp('169.254.169.254')).toBe(false);
      expect(isPublicIp('169.254.0.1')).toBe(false);
    });

    it('returns false for private IPv6 ranges', () => {
      expect(isPublicIp('fc00::1')).toBe(false);
      expect(isPublicIp('fd00::1')).toBe(false);
      expect(isPublicIp('fe80::1')).toBe(false);
    });

    it('returns true for legitimate public IPs', () => {
      expect(isPublicIp('8.8.8.8')).toBe(true);
      expect(isPublicIp('1.1.1.1')).toBe(true);
      expect(isPublicIp('93.184.216.34')).toBe(true);
      expect(isPublicIp('2606:4700:4700::1111')).toBe(true);
    });
  });

  describe('assertSafeOutboundUrl', () => {
    it('allows valid public URL with public IP resolution', async () => {
      vi.spyOn(dns, 'lookup').mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
      ] as any);

      const res = await assertSafeOutboundUrl('https://api.provider.com/v2/order');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe('93.184.216.34');
      }
    });

    it('blocks localhost directly', async () => {
      const res = await assertSafeOutboundUrl('http://localhost:5432/api');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toContain('blocked');
      }
    });

    it('blocks AWS metadata service IP 169.254.169.254', async () => {
      const res = await assertSafeOutboundUrl('http://169.254.169.254/latest/meta-data/');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toContain('blocked');
      }
    });

    it('blocks RFC1918 private IP URL', async () => {
      const res = await assertSafeOutboundUrl('http://10.0.0.1/internal/admin');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toContain('private');
      }
    });

    it('blocks forbidden protocols like ftp:// and file://', async () => {
      const ftpRes = await assertSafeOutboundUrl('ftp://ftp.example.com/file.txt');
      expect(ftpRes.ok).toBe(false);
      if (!ftpRes.ok) {
        expect(ftpRes.reason).toBe('scheme-ftp:-blocked');
      }

      const fileRes = await assertSafeOutboundUrl('file:///etc/passwd');
      expect(fileRes.ok).toBe(false);
      if (!fileRes.ok) {
        expect(fileRes.reason).toBe('scheme-file:-blocked');
      }
    });

    it('blocks DNS rebinding / hostnames resolving to private IPs', async () => {
      vi.spyOn(dns, 'lookup').mockResolvedValueOnce([
        { address: '127.0.0.1', family: 4 },
      ] as any);

      const res = await assertSafeOutboundUrl('https://evil-subdomain.attacker.com/steal');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe('ip-127.0.0.1-private');
      }
    });
  });

  describe('safeFetch', () => {
    it('throws error when URL is blocked by SSRF check', async () => {
      await expect(safeFetch('http://127.0.0.1:8080/secret')).rejects.toThrow('SSRF blocked');
    });

    it('executes native fetch when URL is safe', async () => {
      vi.spyOn(dns, 'lookup').mockResolvedValueOnce([
        { address: '93.184.216.34', family: 4 },
      ] as any);

      const mockResponse = new Response(JSON.stringify({ success: true }), { status: 200 });
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(mockResponse);

      const res = await safeFetch('https://api.provider.com/v2/services');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.provider.com/v2/services',
        expect.objectContaining({ signal: expect.any(Object) })
      );
      expect(res.status).toBe(200);
    });
  });
});
