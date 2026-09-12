import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';

vi.mock('@/lib/session-edge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/session-edge')>();
  return {
    ...actual,
    decryptSessionToken: vi.fn()
  };
});

import { decryptSessionToken } from '@/lib/session-edge';

describe('SEC-03: ?tenant= Override Staff Authentication Guard on Production', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('ignores ?tenant= override on production when unauthenticated and resolves to smmplan', async () => {
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    process.env.CONTOUR = 'prod';

    const req = new NextRequest('https://smmplan.pro/services?tenant=flux', {
      headers: {
        host: 'smmplan.pro'
      }
    });

    const res = await proxy(req);
    expect(res.headers.get('x-tenant-id')).toBe('smmplan');
  });

  it('ignores ?tenant= override on production for regular USER role and resolves to smmplan', async () => {
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    process.env.CONTOUR = 'prod';

    vi.mocked(decryptSessionToken).mockResolvedValueOnce({
      sessionId: 'sess-1',
      userId: 'user-1',
      role: 'USER',
      tenantId: 'smmplan'
    });

    const req = new NextRequest('https://smmplan.pro/services?tenant=flux', {
      headers: {
        host: 'smmplan.pro',
        cookie: 'session_token=mock_user_token'
      }
    });

    const res = await proxy(req);
    expect(res.headers.get('x-tenant-id')).toBe('smmplan');
  });

  it('permits ?tenant= override on production for ADMIN staff role and resolves to flux', async () => {
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    process.env.CONTOUR = 'prod';

    vi.mocked(decryptSessionToken).mockResolvedValueOnce({
      sessionId: 'sess-admin',
      userId: 'admin-1',
      role: 'ADMIN',
      tenantId: 'smmplan'
    });

    const req = new NextRequest('https://smmplan.pro/services?tenant=flux', {
      headers: {
        host: 'smmplan.pro',
        cookie: 'session_token=mock_admin_token'
      }
    });

    const res = await proxy(req);
    expect(res.headers.get('x-tenant-id')).toBe('flux');
  });

  it('permits unrestricted ?tenant= override on test contour for QA workflow', async () => {
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    process.env.CONTOUR = 'test';

    const req = new NextRequest('https://test.smmplan.pro/services?tenant=flux', {
      headers: {
        host: 'test.smmplan.pro'
      }
    });

    const res = await proxy(req);
    expect(res.headers.get('x-tenant-id')).toBe('flux');
  });

  it('protects test.smmplan.pro from being hijacked by stale x_tenant=flux cookie', async () => {
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    process.env.CONTOUR = 'test';

    // Request to test.smmplan.pro with a stale x_tenant=flux cookie in browser
    const req = new NextRequest('https://test.smmplan.pro/', {
      headers: {
        host: 'test.smmplan.pro',
        cookie: 'x_tenant=flux'
      }
    });

    const res = await proxy(req);
    expect(res.headers.get('x-tenant-id')).toBe('smmplan');
  });

  it('protects reverse-proxied x-forwarded-host test.smmplan.pro from stale cookie hijack', async () => {
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'production';
    process.env.CONTOUR = 'test';

    // Request coming from Cloudflare Worker tunnel: hostHeader is internal tunnel, fwdHost is test.smmplan.pro
    const req = new NextRequest('http://127.0.0.1:3000/', {
      headers: {
        host: 'localhost.lhr.life:3000',
        'x-forwarded-host': 'test.smmplan.pro',
        'x-forwarded-proto': 'https',
        cookie: 'x_tenant=flux'
      }
    });

    const res = await proxy(req);
    expect(res.headers.get('x-tenant-id')).toBe('smmplan');
  });

  it('allows local developer on localhost:3000 to switch tenants via cookie', async () => {
    (process.env as Record<string, string | undefined>)['NODE_ENV'] = 'development';

    const req = new NextRequest('http://localhost:3000/', {
      headers: {
        host: 'localhost:3000',
        cookie: 'x_tenant=flux'
      }
    });

    const res = await proxy(req);
    expect(res.headers.get('x-tenant-id')).toBe('flux');
  });
});
