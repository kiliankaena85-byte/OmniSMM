/**
 * CHALLENGER M1-2: Empirical Stress Test Suite for Dev Route Obscurity
 * Verifies that all dev routes (/api/dev/*) strictly return HTTP 404 in production environment,
 * regardless of headers, query parameters, or request bodies.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('🔒 CHALLENGER M1-2: Production Dev Route Obscurity Empirical Stress Test', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  const devRoutes = [
    {
      name: 'GET /api/dev/login-direct',
      importPath: '@/app/api/dev/login-direct/route',
      method: 'GET',
      url: 'http://localhost:3000/api/dev/login-direct?email=admin@smmplan.pro&tenant=smmplan',
      body: null,
    },
    {
      name: 'GET /api/dev/mock-payment',
      importPath: '@/app/api/dev/mock-payment/route',
      method: 'GET',
      url: 'http://localhost:3000/api/dev/mock-payment?paymentId=pay_123',
      body: null,
    },
    {
      name: 'POST /api/dev/mock-provider',
      importPath: '@/app/api/dev/mock-provider/route',
      method: 'POST',
      url: 'http://localhost:3000/api/dev/mock-provider',
      body: 'key=test&action=balance',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
    {
      name: 'POST /api/dev/sandbox/yookassa',
      importPath: '@/app/api/dev/sandbox/yookassa/route',
      method: 'POST',
      url: 'http://localhost:3000/api/dev/sandbox/yookassa',
      body: JSON.stringify({ userId: 'victim-id', amount: 10000 }),
      headers: { 'Content-Type': 'application/json' },
    },
    {
      name: 'GET /api/dev/switch-tenant',
      importPath: '@/app/api/dev/switch-tenant/route',
      method: 'GET',
      url: 'http://localhost:3000/api/dev/switch-tenant?to=smmflux',
      body: null,
    },
    {
      name: 'GET /api/dev/test-checkout',
      importPath: '@/app/api/dev/test-checkout/route',
      method: 'GET',
      url: 'http://localhost:3000/api/dev/test-checkout',
      body: null,
    },
    {
      name: 'GET /api/dev/test-magic-link',
      importPath: '@/app/api/dev/test-magic-link/route',
      method: 'GET',
      url: 'http://localhost:3000/api/dev/test-magic-link?email=test@example.com',
      body: null,
    },
  ];

  describe('1. Standard Production Environment (NODE_ENV=production)', () => {
    devRoutes.forEach(({ name, importPath, method, url, body, headers }) => {
      it(`SEC-DEV-404: ${name} returns 404 in production when ENABLE_DEV_ROUTES is unset`, async () => {
        vi.stubEnv('NODE_ENV', 'production');
        delete process.env.ENABLE_DEV_ROUTES;

        const mod = await import(importPath);
        const handler = method === 'POST' ? mod.POST : mod.GET;

        const req = new NextRequest(url, {
          method,
          body: body ? body : undefined,
          headers: headers || undefined,
        });

        const res = await handler(req);
        expect(res.status).toBe(404);
      });

      it(`SEC-DEV-404-OVERRIDE: ${name} returns 404 in production even if ENABLE_DEV_ROUTES='true'`, async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

        const mod = await import(importPath);
        const handler = method === 'POST' ? mod.POST : mod.GET;

        const req = new NextRequest(url, {
          method,
          body: body ? body : undefined,
          headers: headers || undefined,
        });

        const res = await handler(req);
        expect(res.status).toBe(404);
      });
    });
  });

  describe('2. Adversarial Header Injection in Production', () => {
    const adversarialHeaders: { name: string; header: Record<string, string> }[] = [
      { name: 'Admin Master Key', header: { 'x-admin-key': 'master-secret' } },
      { name: 'Bearer Token', header: { 'Authorization': 'Bearer test-admin-token' } },
      { name: 'Internal Forwarded IP', header: { 'x-forwarded-for': '127.0.0.1' } },
      { name: 'Cloudflare Loopback', header: { 'cf-connecting-ip': '127.0.0.1' } },
      { name: 'Bypass Header', header: { 'x-bypass-security': '1' } },
    ];

    devRoutes.forEach(({ name, importPath, method, url, body }) => {
      adversarialHeaders.forEach(({ name: attackName, header }) => {
        it(`SEC-ATTACK: ${name} returns 404 under ${attackName} in production`, async () => {
          vi.stubEnv('NODE_ENV', 'production');

          const mod = await import(importPath);
          const handler = method === 'POST' ? mod.POST : mod.GET;

          const req = new NextRequest(url, {
            method,
            body: body ? body : undefined,
            headers: header,
          });

          const res = await handler(req);
          expect(res.status).toBe(404);
        });
      });
    });
  });

  describe('3. Defense-in-Depth in Non-Production (ENABLE_DEV_ROUTES unset/false)', () => {
    devRoutes.forEach(({ name, importPath, method, url, body, headers }) => {
      it(`SEC-DEFENSE: ${name} returns 404 in non-prod when ENABLE_DEV_ROUTES is unset`, async () => {
        vi.stubEnv('NODE_ENV', 'test');
        delete process.env.ENABLE_DEV_ROUTES;

        const mod = await import(importPath);
        const handler = method === 'POST' ? mod.POST : mod.GET;

        const req = new NextRequest(url, {
          method,
          body: body ? body : undefined,
          headers: headers || undefined,
        });

        const res = await handler(req);
        expect(res.status).toBe(404);
      });

      it(`SEC-DEFENSE: ${name} returns 404 in non-prod when ENABLE_DEV_ROUTES='false'`, async () => {
        vi.stubEnv('NODE_ENV', 'test');
        vi.stubEnv('ENABLE_DEV_ROUTES', 'false');

        const mod = await import(importPath);
        const handler = method === 'POST' ? mod.POST : mod.GET;

        const req = new NextRequest(url, {
          method,
          body: body ? body : undefined,
          headers: headers || undefined,
        });

        const res = await handler(req);
        expect(res.status).toBe(404);
      });
    });
  });
});
