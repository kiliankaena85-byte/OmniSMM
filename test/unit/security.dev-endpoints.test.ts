/**
 * T-003: Security test for dev-only endpoints.
 * Verifies that /api/dev/* endpoints are blocked in production.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

describe('🔒 SEC-001: Dev Endpoints — Production Guard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe('POST /api/dev/sandbox/yookassa', () => {
    it('SEC-YOOKASSA-001: Returns 404 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const { POST } = await import(
        '@/app/api/dev/sandbox/yookassa/route'
      );
      const req = new NextRequest('http://localhost:3000/api/dev/sandbox/yookassa', {
        method: 'POST',
        body: JSON.stringify({ userId: 'attacker-id', amount: 99999 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req);
      expect(response.status).toBe(404);
    });

    it('SEC-YOOKASSA-002: Blocks unauthenticated requests in dev', async () => {
      vi.stubEnv('NODE_ENV', 'test'); // non-production
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      // Mock requireStaffPermission to return unauthorized
      vi.doMock('@/lib/server/rbac', () => ({
        requireStaffPermission: vi.fn().mockResolvedValue({ error: 'Unauthorized access' }),
      }));

      const { POST } = await import(
        '@/app/api/dev/sandbox/yookassa/route'
      );
      const req = new NextRequest('http://localhost:3000/api/dev/sandbox/yookassa', {
        method: 'POST',
        body: JSON.stringify({ userId: 'attacker-id', amount: 99999 }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(req);
      // Should be 401 (unauthorized) not 200
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/dev/mock-provider', () => {
    it('SEC-MOCK-001: Returns 404 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');

      const { SettingsProvider } = await import('@/lib/settings');
      vi.spyOn(SettingsProvider, 'isTestMode').mockResolvedValue(false);

      const { POST } = await import(
        '@/app/api/dev/mock-provider/route'
      );
      const req = new NextRequest('http://localhost:3000/api/dev/mock-provider', {
        method: 'POST',
        body: 'key=test&action=balance',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const response = await POST(req);
      expect(response.status).toBe(404);
    });

    it('SEC-MOCK-002: Returns 403 with wrong API key in dev', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('MOCK_PROVIDER_KEY', 'secure-key-from-env');

      const { POST } = await import(
        '@/app/api/dev/mock-provider/route'
      );
      const req = new NextRequest('http://localhost:3000/api/dev/mock-provider', {
        method: 'POST',
        // Attacker sends old hardcoded key 'test'
        body: 'key=test&action=balance',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const response = await POST(req);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Incorrect API key');
    });

    it('SEC-MOCK-003: Allows request with correct env-configured key in dev', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');
      vi.stubEnv('MOCK_PROVIDER_KEY', 'mock-dev-key');

      const { POST } = await import(
        '@/app/api/dev/mock-provider/route'
      );
      const req = new NextRequest('http://localhost:3000/api/dev/mock-provider', {
        method: 'POST',
        body: 'key=mock-dev-key&action=balance',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const response = await POST(req);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('balance');
    });
  });

  describe('GET /api/dev/login-direct', () => {
    it('SEC-LOGIN-DIRECT-001: Returns 404 in production even with secret and dev flag', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      const { GET } = await import('@/app/api/dev/login-direct/route');
      const req = new NextRequest('http://localhost:3000/api/dev/login-direct?email=admin@smmplan.pro&secret=any');
      const response = await GET(req);
      expect(response.status).toBe(404);
    });

    it('SEC-LOGIN-DIRECT-002: Returns 503 if QA_SECRET_KEY is not configured in dev', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');
      delete process.env.QA_SECRET_KEY;

      const { GET } = await import('@/app/api/dev/login-direct/route');
      const req = new NextRequest('http://localhost:3000/api/dev/login-direct?email=admin@smmplan.pro');
      const response = await GET(req);
      expect(response.status).toBe(503);
    });

    it('SEC-LOGIN-DIRECT-003: Rejects host poisoning attack with X-Forwarded-Host: evil.com returning 404 in production without setting cookies', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      const { GET } = await import('@/app/api/dev/login-direct/route');
      const req = new NextRequest('http://localhost:3000/api/dev/login-direct?email=admin@smmplan.pro&secret=any', {
        headers: {
          'x-forwarded-host': 'evil.com',
        },
      });
      const response = await GET(req);
      expect(response.status).toBe(404);
      expect(response.headers.get('set-cookie')).toBeNull();
    });

    it('SEC-LOGIN-DIRECT-004: Rejects host poisoning attack with X-Forwarded-Host: evil.com returning 503 when QA_SECRET_KEY is not configured', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');
      delete process.env.QA_SECRET_KEY;

      const { GET } = await import('@/app/api/dev/login-direct/route');
      const req = new NextRequest('http://localhost:3000/api/dev/login-direct?email=admin@smmplan.pro', {
        headers: {
          'x-forwarded-host': 'evil.com',
        },
      });
      const response = await GET(req);
      expect(response.status).toBe(503);
      expect(response.headers.get('set-cookie')).toBeNull();
    });
  });

  describe('GET /api/dev/mock-payment', () => {
    it('SEC-MOCK-PAYMENT-001: Returns 404 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      const { GET } = await import('@/app/api/dev/mock-payment/route');
      const req = new NextRequest('http://localhost:3000/api/dev/mock-payment?paymentId=123');
      const response = await GET(req);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/dev/test-magic-link', () => {
    it('SEC-MAGIC-LINK-001: Returns 404 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      const { GET } = await import('@/app/api/dev/test-magic-link/route');
      const req = new NextRequest('http://localhost:3000/api/dev/test-magic-link?email=test@example.com');
      const response = await GET(req);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/dev/test-checkout', () => {
    it('SEC-TEST-CHECKOUT-001: Returns 404 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      const { GET } = await import('@/app/api/dev/test-checkout/route');
      const req = new NextRequest('http://localhost:3000/api/dev/test-checkout');
      const response = await GET(req);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/dev/switch-tenant', () => {
    it('SEC-SWITCH-TENANT-001: Returns 404 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      const { GET } = await import('@/app/api/dev/switch-tenant/route');
      const req = new NextRequest('http://localhost:3000/api/dev/switch-tenant?to=flux');
      const response = await GET(req);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/debug', () => {
    it('SEC-DEBUG-001: Returns 404 in production', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('ENABLE_DEV_ROUTES', 'true');

      const { GET } = await import('@/app/api/debug/route');
      const req = new NextRequest('http://localhost:3000/api/debug');
      const response = await GET(req);
      expect(response.status).toBe(404);
    });
  });
});
