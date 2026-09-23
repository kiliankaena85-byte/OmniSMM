import { describe, it, expect, beforeEach } from 'vitest';
import { getClientIp } from '@/utils/ip';

describe('SEC-07: IP Trust Resolution behind Cloudflare Tunnel vs Direct Reverse Proxy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('ignores cf-connecting-ip by default (TRUST_CF_CONNECTING_IP is unset/false) to prevent spoofing on direct Nginx', async () => {
    delete process.env.TRUST_CF_CONNECTING_IP;

    const headers = new Headers({
      'cf-connecting-ip': '198.51.100.42', // Attacker spoofed header
      'x-real-ip': '203.0.113.195',        // Real IP set by local Nginx
      'x-forwarded-for': '198.51.100.42, 203.0.113.195'
    });

    const ip = await getClientIp(headers);
    expect(ip).toBe('203.0.113.195');
  });

  it('prioritizes cf-connecting-ip when TRUST_CF_CONNECTING_IP is explicitly true (Cloudflare Tunnel mode)', async () => {
    process.env.TRUST_CF_CONNECTING_IP = 'true';

    const headers = new Headers({
      'cf-connecting-ip': '198.51.100.42',
      'x-real-ip': '127.0.0.1', // Local tunnel proxy IP
      'x-forwarded-for': '198.51.100.42'
    });

    const ip = await getClientIp(headers);
    expect(ip).toBe('198.51.100.42');
  });

  it('falls back to x-real-ip and rightmost valid x-forwarded-for if cf-connecting-ip is missing in CF mode', async () => {
    process.env.TRUST_CF_CONNECTING_IP = 'true';

    const headers = new Headers({
      'x-forwarded-for': '203.0.113.10, 203.0.113.20'
    });

    const ip = await getClientIp(headers);
    expect(ip).toBe('203.0.113.20');
  });
});
