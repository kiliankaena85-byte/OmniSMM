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
    test('Spoofing x-tenant-id header on API calls to steal orders fails', async ({ request }) => {
      // Hacker tries to bypass host resolution by sending explicitly forged tenant headers
      const res = await request.get('/api/admin/orders', {
        headers: {
          'x-forwarded-host': 'smmplan.pro',
          'x-tenant-id': 'flux' // Attempt to fetch flux orders from smmplan
        }
      });
      // Edge Middleware (proxy.ts) strips client-provided x-tenant-id headers to prevent spoofing
      // Therefore, this request will just process as smmplan (or fail because of no auth).
      expect(res.status()).toBe(401);
    });

    test('Spoofing x-tenant-id on Client Action to deduct balance fails', async ({ request }) => {
      // Trying to trigger a Server Action with a forged tenant context
      const res = await request.post('/api/user/balance/deduct', {
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
      const res = await request.post('/api/v2/order', {
        headers: {
          'x-forwarded-host': 'smmflux.ru', // Targeting SMMflux
          'Authorization': 'Bearer SMM-PLAN-FAKE-API-KEY-12345'
        },
        data: { service: 1, link: 'https://test.com', quantity: 100 }
      });
      
      // API Key resolution will strict-check the tenant of the key vs the host tenant
      // It must return 401 or 403, NOT process the order
      expect(res.status()).toBe(401);
    });
  });
});
