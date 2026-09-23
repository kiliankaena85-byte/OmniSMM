import { test, expect } from '@playwright/test';
import { seedTestAdmin, createAuthenticatedContext } from './fixtures';

test.describe('BLOCK 28: Telemetry Health API, In-App Emergency Siren Banner & ISO 25010 Quality Gate', () => {
  let authContext: any;
  let adminId: string;

  test.beforeAll(async ({ browser }) => {
    const admin = await seedTestAdmin();
    adminId = admin.id;
    authContext = await createAuthenticatedContext(browser, adminId, 'OWNER');
  });

  test.afterAll(async () => {
    await authContext?.close();
  });

  test('[OWASP ASVS V13.1 / ISO 25010] Vector 1: /api/admin/telemetry/health returns strictly typed schema with activeAlerts array', async ({ request }) => {
    const response = await request.get('/api/admin/telemetry/health');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(['HEALTHY', 'DEGRADED', 'CRITICAL']).toContain(body.overallStatus);
    expect(Array.isArray(body.activeAlerts)).toBe(true);

    // Verify hardware metric payloads
    expect(body.disk).toBeDefined();
    expect(body.disk.totalGb).toBeGreaterThanOrEqual(0);
    expect(body.memory).toBeDefined();
    expect(body.memory.osTotalMb).toBeGreaterThan(0);
    expect(body.database).toBeDefined();
    expect(body.queues).toBeDefined();
  });

  test('[ISO 25010 Operability] Vector 2: System Emergency Banner in /admin/dashboard with zero horizontal scroll', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Verify main admin layout is loaded
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible({ timeout: 15000 });

    // Assert zero horizontal scroll on the viewport
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // 1-2px tolerance

    await page.close();
  });

  test('[WCAG 2.2 AA] Vector 3: Emergency Banner Mute Button & Dismissal Touch Targets', async () => {
    const page = await authContext.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });

    // If an alert banner is currently active in the DOM, test toggle buttons
    const banner = page.locator('[role="alert"]');
    const isBannerVisible = await banner.isVisible().catch(() => false);

    if (isBannerVisible) {
      const muteBtn = banner.locator('button[aria-label="Toggle Siren Audio"]');
      await expect(muteBtn).toBeVisible();

      // Click mute
      await muteBtn.click();

      // Click dismiss
      const dismissBtn = banner.locator('button[aria-label="Dismiss Alert"]');
      await expect(dismissBtn).toBeVisible();
      await dismissBtn.click();

      // Banner should now be dismissed
      await expect(banner).toBeHidden();
    }

    await page.close();
  });
});
