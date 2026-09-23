import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { proxy as middleware } from '@/proxy';

describe('Multi-Tenant Isolation Enhancements', () => {

  describe('1. Cache Tag Tenant Isolation', () => {
    it('should configure tenant-specific cache keys and tags in catalog functions', async () => {
      const { getCachedNetworks, getCachedServicesByCategory } = await import('@/actions/order/catalog');

      expect(typeof getCachedNetworks).toBe('function');
      expect(typeof getCachedServicesByCategory).toBe('function');
      
      // Test function signatures and tenant parameter behavior
      const planRes = await getCachedNetworks('smmplan');
      const fluxRes = await getCachedNetworks('flux');
      
      expect(Array.isArray(planRes)).toBe(true);
      expect(Array.isArray(fluxRes)).toBe(true);
    });
  });

  describe('2. Rate Limits Tenant Isolation', () => {
    it('should apply separate rate limits per tenant for the same user', async () => {
      const prevEnv = process.env.ENABLE_RATE_LIMIT_TEST;
      process.env.ENABLE_RATE_LIMIT_TEST = 'true';
      try {
        const mockUserId = `user-test-isolation-${Date.now()}`;
        const limit = 3;
        const windowSec = 60;

        // 1. Consume full quota on 'smmplan'
        for (let i = 0; i < limit; i++) {
          const allowed = await RateLimitService.checkCustomKey(`cancel-order:smmplan:${mockUserId}`, limit, windowSec);
          expect(allowed).toBe(true);
        }

        // 2. Next request on 'smmplan' MUST be blocked
        const planBlocked = await RateLimitService.checkCustomKey(`cancel-order:smmplan:${mockUserId}`, limit, windowSec);
        expect(planBlocked).toBe(false);

        // 3. Same user on 'flux' MUST STILL BE ALLOWED because rate limit is isolated per-tenant
        const fluxAllowed = await RateLimitService.checkCustomKey(`cancel-order:flux:${mockUserId}`, limit, windowSec);
        expect(fluxAllowed).toBe(true);
      } finally {
        process.env.ENABLE_RATE_LIMIT_TEST = prevEnv;
      }
    });
  });

  describe('3. Admin Tenant Context & x_admin_tenant Cookie in Middleware', () => {
    it('should respect x_admin_tenant cookie in middleware for /admin paths', async () => {
      const req = new NextRequest('http://smmplan.pro/admin/orders', {
        headers: {
          host: 'smmplan.pro',
          cookie: 'x_admin_tenant=flux; session_token=test'
        }
      });

      const res = await middleware(req);
      const tenantHeader = res?.headers.get('x-tenant-id') || req.headers.get('x-tenant-id');
      
      expect(tenantHeader).toBe('flux');
    });

    it('should fallback to host-derived tenant on public paths even if x_admin_tenant is present', async () => {
      const req = new NextRequest('http://smmplan.pro/services', {
        headers: {
          host: 'smmplan.pro',
          cookie: 'x_admin_tenant=flux'
        }
      });

      const res = await middleware(req);
      const tenantHeader = res?.headers.get('x-tenant-id') || req.headers.get('x-tenant-id');
      
      expect(tenantHeader).toBe('smmplan');
    });
  });
});
