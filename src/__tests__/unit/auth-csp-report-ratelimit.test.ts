import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/telemetry/csp-report/route';
import { NextRequest } from 'next/server';
import { SecurityAlertService } from '@/services/security/security-alert.service';

const mockRedisData: Record<string, string> = {};
vi.mock('@/lib/redis', () => ({
  redis: {
    set: vi.fn(async (key: string, value: string, ...args: unknown[]) => {
      if (args.includes('NX') && mockRedisData[key]) {
        return null;
      }
      mockRedisData[key] = value;
      return 'OK';
    }),
    get: vi.fn(async (key: string) => mockRedisData[key] || null),
  }
}));

vi.mock('@/services/security/security-alert.service', () => ({
  SecurityAlertService: {
    record: vi.fn().mockResolvedValue(true)
  }
}));

vi.mock('@/lib/security/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockImplementation(async (ip: string) => {
    if (ip === '1.2.3.4-flooder') {
      return { success: false, limit: 10, remaining: 0, resetSeconds: 60 };
    }
    return { success: true, limit: 10, remaining: 9, resetSeconds: 60 };
  })
}));

describe('AUTH-02: CSP Report Telemetry Hardening & Rate Limiting', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockRedisData)) {
      delete mockRedisData[key];
    }
    vi.clearAllMocks();
  });

  it('records valid CSP report with status 200', async () => {
    const payload = {
      'csp-report': {
        'document-uri': 'https://smmplan.pro/dashboard',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/malicious.js'
      }
    };

    const req = new NextRequest('http://localhost:3000/api/telemetry/csp-report', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '192.168.1.50',
        'user-agent': 'Mozilla/5.0 Test'
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('received');
    expect(SecurityAlertService.record).toHaveBeenCalledTimes(1);
  });

  it('deduplicates identical CSP reports within the deduplication window', async () => {
    const payload = {
      'csp-report': {
        'document-uri': 'https://smmplan.pro/dashboard',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.com/dup.js'
      }
    };

    const req1 = new NextRequest('http://localhost:3000/api/telemetry/csp-report', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '192.168.1.60',
      }
    });

    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    expect((await res1.json()).status).toBe('received');
    expect(SecurityAlertService.record).toHaveBeenCalledTimes(1);

    // Second identical request
    const req2 = new NextRequest('http://localhost:3000/api/telemetry/csp-report', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '192.168.1.60',
      }
    });

    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    expect((await res2.json()).status).toBe('deduplicated');
    // Alert service must NOT be called again
    expect(SecurityAlertService.record).toHaveBeenCalledTimes(1);
  });

  it('blocks telemetry flooders with 429 Rate Limited', async () => {
    const payload = {
      'csp-report': {
        'violated-directive': 'img-src',
        'blocked-uri': 'https://evil.com/flood.png'
      }
    };

    const req = new NextRequest('http://localhost:3000/api/telemetry/csp-report', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '1.2.3.4-flooder',
      }
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(SecurityAlertService.record).not.toHaveBeenCalled();
  });
});
