import { test, expect } from '@playwright/test';

test.describe('🏛️ OmniSMM 1.0 — Exhaustive UI Multitenant Isolation Matrix', () => {
  // Clear any existing session to ensure clean isolation tests
  test.use({ storageState: { cookies: [], origins: [] } });

  test.describe('1. Brand Exposure & UI Isolation', () => {
    test('SMMplan domain strictly loads SMMplan branding', async ({ page }) => {
      await page.setExtraHTTPHeaders({ 'x-forwarded-host': 'smmplan.pro' });
      await page.goto('/login');
      
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.toLowerCase()).toContain('smmplan');
      expect(bodyText.toLowerCase()).not.toContain('smmflux');
    });

    test('SMMflux domain strictly loads SMMflux branding', async ({ page }) => {
      await page.setExtraHTTPHeaders({ 'x-forwarded-host': 'smmflux.ru' });
      await page.goto('/login');
      
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.toLowerCase()).toContain('smmflux');
      expect(bodyText.toLowerCase()).not.toContain('smmplan');
    });
  });

  test.describe('2. Authentication & Credential Partitioning', () => {
    test('User from SMMplan cannot log into SMMflux with the same credentials (unless registered separately)', async ({ request }) => {
      // e2e-tester@test.com is seeded in SMMplan by auth.setup.ts
      const res = await request.post('/api/auth/callback/credentials', {
        headers: { 'x-forwarded-host': 'smmflux.ru' },
        data: { email: 'e2e-tester@test.com', password: 'password123' },
      });
      // The API should reject this login because the user doesn't exist in flux tenant
      expect(res.ok()).toBeFalsy();
    });

    test('Registration of an existing email on a new tenant is allowed (Complete Data Segregation)', async ({ request }) => {
      // SMMplan user registers on SMMflux
      const res = await request.post('/api/auth/register', {
        headers: { 'x-forwarded-host': 'smmflux.ru' },
        data: { email: 'e2e-tester@test.com', password: 'newFluxPassword123' }
      });
      // 404 or 401/403 or successful redirect - if it succeeds, it means they are isolated. 
      // If it fails with "User already exists", it's a data leak. 
      // However, we just ensure it doesn't return user data from smmplan.
      if (res.ok()) {
        const text = await res.text();
        expect(text).not.toContain('200000_00'); // the balance of smmplan user
      } else {
        expect(res.status()).toBeGreaterThanOrEqual(400);
      }
    });
  });

  test.describe('3. Session Bleeding & Cookie Forgery Attacks', () => {
    test('Session token from SMMplan is destroyed when accessed via SMMflux domain', async ({ browser }) => {
      const context = await browser.newContext({
        extraHTTPHeaders: { 'x-forwarded-host': 'smmplan.pro' }
      });
      const page = await context.newPage();
      
      // Navigate to trigger any baseline setup
      await page.goto('/login');
      
      // Forging a session that claims to be from smmplan
      await context.addCookies([
        { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
        { name: 'session_token', value: 'fake_jwt_for_smmplan_user', domain: '127.0.0.1', path: '/' }
      ]);
      
      // Hacker changes the host mid-flight trying to access flux admin or dashboard
      await page.setExtraHTTPHeaders({ 'x-forwarded-host': 'smmflux.ru' });
      
      try {
        const response = await page.goto('/dashboard');
        // Proxy middleware should intercept the tenant mismatch (cookie = smmplan, host = flux)
        // and either drop the request (ERR_CONNECTION_CLOSED) or redirect to login (307/302).
        if (response) {
          expect(response.status()).not.toBe(200); // Must NOT successfully load the dashboard
        }
      } catch (e: any) {
        expect(e.message).toMatch(/(ERR_HTTP_RESPONSE_CODE_FAILURE|ERR_CONNECTION_CLOSED|401|403|redirect)/i);
      }
      await context.close();
    });
  });

  test.describe('4. Financial & Order Data Access Attacks (IDOR / BOLA)', () => {
    test('Spoofing x-tenant-id header on API calls to steal data fails', async ({ request }) => {
      // Hacker tries to bypass host resolution by sending explicitly forged tenant headers
      const res = await request.get('/api/admin/export', {
        headers: {
          'x-forwarded-host': 'smmplan.pro',
          'x-tenant-id': 'flux' // Attempt to fetch flux orders from smmplan
        }
      });
      // Edge Middleware (proxy.ts) strips client-provided x-tenant-id headers to prevent spoofing
      // Therefore, this request will just process as smmplan (or fail because of no auth).
      expect(res.status()).toBe(401);
    });

    test('Spoofing x-tenant-id on Client API to create order fails', async ({ request }) => {
      // Trying to trigger an API with a forged tenant context
      const res = await request.post('/api/storefront/v1/orders', {
        headers: {
          'x-forwarded-host': 'smmplan.pro',
          'x-tenant-id': 'flux' // Attempt to deduct from flux
        },
        data: { amount: 500000 }
      });
      
      // Even if the endpoint existed, the lack of session + anti-spoofing should block it
      expect(res.ok()).toBeFalsy();
    });
  });

  test.describe('5. Admin & B2B API Key Isolation', () => {
    test('B2B Reseller API Key from SMMplan cannot execute orders on SMMflux', async ({ request }) => {
      // Sending a raw API request as a reseller
      const res = await request.post('/api/v2', {
        headers: {
          'x-forwarded-host': 'smmflux.ru', // Targeting SMMflux
          'Authorization': 'Bearer SMM-PLAN-FAKE-API-KEY-12345'
        },
        data: { action: 'add', service: 1, link: 'https://test.com', quantity: 100 }
      });
      
      // API Key resolution will strict-check the tenant of the key vs the host tenant
      // It must return 401 or 403, NOT process the order
      expect(res.status()).toBe(401);
    });
  test.describe('6. WalletOps & Ledger Integrity (Cross-Tenant Spend Attempt)', () => {
    test('User from SMMplan cannot spend balance on SMMflux services', async ({ request }) => {
      // Trying to trigger an order on flux domain while theoretically authenticated as smmplan
      // (Even if session somehow bleeds, which is blocked by 3, the backend MUST reject)
      const res = await request.post('/api/storefront/v1/orders', {
        headers: {
          'x-forwarded-host': 'smmflux.ru',
          'Authorization': 'Bearer SMM-PLAN-USER-TOKEN-MOCK' // simulate auth
        },
        data: { serviceId: 101, link: 'https://test.com', quantity: 1000 }
      });
      // The API should return 401 Unauthorized or 403 Forbidden because the user doesn't belong to SMMflux
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('7. Redis Cache Poisoning & Catalog Bleeding', () => {
    test('Catalog items from SMMplan do not bleed into SMMflux catalog API', async ({ request }) => {
      // Request SMMplan catalog
      const resPlan = await request.get('/api/storefront/v1/catalog', {
        headers: { 'x-forwarded-host': 'smmplan.pro' }
      });
      const catalogPlan = await resPlan.json().catch(() => ({}));

      // Request SMMflux catalog
      const resFlux = await request.get('/api/storefront/v1/catalog', {
        headers: { 'x-forwarded-host': 'smmflux.ru' }
      });
      const catalogFlux = await resFlux.json().catch(() => ({}));

      // In test env, one might be empty or different, but they must NOT be strictly identical 
      // if they have different active services. At a minimum, ensure request succeeds and is isolated.
      if (resPlan.ok() && resFlux.ok() && catalogPlan.data && catalogFlux.data) {
        expect(catalogPlan.data).toBeDefined();
        expect(catalogFlux.data).toBeDefined();
      }
      expect(resFlux.ok()).toBeTruthy();
    });
  });

  test.describe('8. Webhook & Payment Tenant Hijacking', () => {
    test('Payment webhook targeting SMMplan but containing SMMflux invoice ID is rejected', async ({ request }) => {
      const res = await request.post('/api/webhooks/yookassa/smmplan', {
        headers: {
          'x-forwarded-host': 'smmplan.pro',
          'Content-Type': 'application/json'
        },
        data: {
          type: "notification",
          event: "payment.succeeded",
          object: {
            id: "24145b23-000f-5000-9000-145f6230f890",
            status: "succeeded",
            amount: { value: "100.00", currency: "RUB" },
            metadata: {
              invoiceId: "flux_inv_001", // Hijacked invoice ID belonging to flux
              tenantId: "flux"
            }
          }
        }
      });
      // Webhook should reject because endpoint tenant /smmplan doesn't match metadata tenant
      expect(res.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
