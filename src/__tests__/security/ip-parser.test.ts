import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn(),
}));

import { getClientIp } from '@/utils/ip';
import { headers } from 'next/headers';

describe('Client IP Resolution Suite (src/utils/ip.ts)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TRUST_CF_CONNECTING_IP;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns fallback when no headers or request are provided and headers() fails', async () => {
    vi.mocked(headers).mockImplementationOnce(() => { throw new Error('headers() called outside request scope'); });
    const ip = await getClientIp(null, '192.168.1.1');
    // Outside of next request context headers() throws, returning fallback
    expect(ip).toBe('192.168.1.1');
  });

  it('returns fallback string when reqOrHeadersOrFallback is a string', async () => {
    vi.mocked(headers).mockImplementationOnce(() => { throw new Error('headers() called outside request scope'); });
    const ip = await getClientIp('10.0.0.1');
    expect(ip).toBe('10.0.0.1');
  });

  it('extracts x-real-ip accurately from Headers object', async () => {
    const headers = new Headers();
    headers.set('x-real-ip', '178.62.204.10');
    const ip = await getClientIp(headers);
    expect(ip).toBe('178.62.204.10');
  });

  it('extracts rightmost valid hop from x-forwarded-for', async () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', '203.0.113.195, 70.41.3.18, 150.172.238.178');
    const ip = await getClientIp(headers);
    expect(ip).toBe('150.172.238.178');
  });

  it('filters out invalid IPs in x-forwarded-for and picks last valid hop', async () => {
    const headers = new Headers();
    headers.set('x-forwarded-for', 'spoofed-bad-ip, 198.51.100.22, invalid-host');
    const ip = await getClientIp(headers);
    expect(ip).toBe('198.51.100.22');
  });

  it('normalizes IPv4-mapped IPv6 addresses (::ffff:192.0.2.128)', async () => {
    const headers = new Headers();
    headers.set('x-real-ip', '::ffff:192.0.2.128');
    const ip = await getClientIp(headers);
    expect(ip).toBe('192.0.2.128');
  });

  it('handles standard IPv6 addresses correctly', async () => {
    const headers = new Headers();
    headers.set('x-real-ip', '2001:0db8:85a3:0000:0000:8a2e:0370:7334');
    const ip = await getClientIp(headers);
    expect(ip).toBe('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
  });

  it('prioritizes cf-connecting-ip when TRUST_CF_CONNECTING_IP is true', async () => {
    process.env.TRUST_CF_CONNECTING_IP = 'true';
    const headers = new Headers();
    headers.set('cf-connecting-ip', '93.184.216.34');
    headers.set('x-real-ip', '10.0.0.1');
    const ip = await getClientIp(headers);
    expect(ip).toBe('93.184.216.34');
  });

  it('ignores invalid cf-connecting-ip and falls back to x-real-ip', async () => {
    process.env.TRUST_CF_CONNECTING_IP = 'true';
    const headers = new Headers();
    headers.set('cf-connecting-ip', 'not-an-ip');
    headers.set('x-real-ip', '198.51.100.5');
    const ip = await getClientIp(headers);
    expect(ip).toBe('198.51.100.5');
  });

  it('extracts IP from Request object with headers', async () => {
    const req = new Request('http://localhost:3000/api/test', {
      headers: {
        'x-real-ip': '82.102.23.4',
      },
    });
    const ip = await getClientIp(req);
    expect(ip).toBe('82.102.23.4');
  });
});
