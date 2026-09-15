import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v2/route';
import { RateLimitService } from '@/services/core/rate-limit.service';

vi.mock('@/lib/db', () => ({
  db: {
    apiRequestLog: { create: vi.fn().mockResolvedValue({}) },
    user: { 
      findFirst: vi.fn(),
      findUnique: vi.fn().mockResolvedValue({ id: 'user-123', balance: BigInt(100000), tenantId: 'smmplan' })
    },
    service: { findMany: vi.fn() }
  }
}));

vi.mock('@/lib/api-auth', () => ({
  verifyAPIKey: vi.fn().mockResolvedValue({
    id: 'user-123',
    role: 'USER',
    tenantId: 'smmplan',
    balance: BigInt(100000)
  }),
  resolveTenantFromRequest: vi.fn().mockReturnValue('smmplan'),
  resolveContourFromHost: vi.fn().mockReturnValue('test')
}));

vi.mock('@/services/security/security-alert.service', () => ({
  SecurityAlertService: { record: vi.fn() }
}));

describe('SEC-01: API v2 RFC 9331 RateLimit Headers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets accurate RateLimit-Limit, RateLimit-Remaining, and RateLimit-Reset headers on valid request', async () => {
    vi.spyOn(RateLimitService, 'checkCustomKeyDetail').mockResolvedValueOnce({
      allowed: true,
      limit: 50,
      remaining: 49,
      resetSeconds: 58
    });

    const formData = new FormData();
    formData.append('key', 'valid_test_api_key_123');
    formData.append('action', 'balance');

    const req = new NextRequest('http://localhost:3000/api/v2', {
      method: 'POST',
      body: formData
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('RateLimit-Limit')).toBe('50');
    expect(res.headers.get('RateLimit-Remaining')).toBe('49');
    expect(res.headers.get('RateLimit-Reset')).toBe('58');
    expect(res.headers.get('RateLimit-Policy')).toBe('50;w=58');
  });

  it('sets RateLimit-Remaining to 0 and correct Reset on 429 response when limit exceeded', async () => {
    vi.spyOn(RateLimitService, 'checkCustomKeyDetail').mockResolvedValueOnce({
      allowed: false,
      limit: 50,
      remaining: 0,
      resetSeconds: 42
    });

    const formData = new FormData();
    formData.append('key', 'flooding_api_key_123');
    formData.append('action', 'balance');

    const req = new NextRequest('http://localhost:3000/api/v2', {
      method: 'POST',
      body: formData
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('RateLimit-Limit')).toBe('50');
    expect(res.headers.get('RateLimit-Remaining')).toBe('0');
    expect(res.headers.get('RateLimit-Reset')).toBe('42');
    expect(res.headers.get('RateLimit-Policy')).toBe('50;w=42');

    const json = await res.json();
    expect(json.error).toContain('Too many requests');
  });
});
