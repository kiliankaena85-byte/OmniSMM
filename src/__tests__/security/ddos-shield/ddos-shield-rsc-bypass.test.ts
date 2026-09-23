import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { checkClientHintsAnomaly } from '@/lib/security/ddos-shield/fingerprint';

describe('DDoS Shield RSC/Action & Tablet Navigation Invariants', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, DDOS_SHIELD_ENABLED: 'true', NODE_ENV: 'development' };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('permits Android tablet UA without mobile keyword sending sec-ch-ua-mobile: ?0', () => {
    const tabletHeaders = new Headers({
      'user-agent': 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'sec-ch-ua-platform': '"Android"',
      'sec-ch-ua-mobile': '?0',
    });

    const anomaly = checkClientHintsAnomaly(tabletHeaders);
    expect(anomaly.isAnomalous).toBe(false);
  });

  it('excludes /api/maintenance-status and /api/health from DDoS challenge', async () => {
    const reqMaintenance = new NextRequest('http://127.0.0.1:3000/api/maintenance-status', {
      method: 'GET',
      headers: { host: 'localhost:3000' },
    });
    const resMaintenance = await proxy(reqMaintenance);
    expect(resMaintenance.status).not.toBe(429);

    const reqHealth = new NextRequest('http://127.0.0.1:3000/api/health', {
      method: 'GET',
      headers: { host: 'localhost:3000' },
    });
    const resHealth = await proxy(reqHealth);
    expect(resHealth.status).not.toBe(429);
  });

  it('does not subject RSC requests to document PoW HTML challenge', async () => {
    const rscReq = new NextRequest('http://127.0.0.1:3000/services/telegram/members', {
      method: 'GET',
      headers: {
        host: 'localhost:3000',
        rsc: '1',
        'x-forwarded-for': '198.51.100.42',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0',
      },
    });

    const res = await proxy(rscReq);
    // Should not return HTML PoW challenge
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).not.toContain('text/html');
    if (res.status === 429) {
      expect(contentType).toContain('application/json');
    } else {
      expect(res.status).toBe(200);
    }
  });

  it('does not subject Server Actions to document PoW HTML challenge', async () => {
    const actionReq = new NextRequest('http://127.0.0.1:3000/', {
      method: 'POST',
      headers: {
        host: 'localhost:3000',
        'next-action': 'action-uuid-1234',
        'x-forwarded-for': '198.51.100.42',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0',
      },
    });

    const res = await proxy(actionReq);
    const contentType = res.headers.get('content-type') || '';
    expect(contentType).not.toContain('text/html');
    expect(res.status).not.toBe(429);
  });
});
