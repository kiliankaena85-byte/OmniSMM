import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { seedTestAdmin, createAuthenticatedContext } from './fixtures';

const db = new PrismaClient();

test.describe('BLOCK 24: Comprehensive Admin Panel Browser & Layout Audit', () => {
  let adminId: string;
  let authContext: any;

  test.beforeAll(async ({ browser }) => {
    const admin = await seedTestAdmin();
    adminId = admin.id;
    authContext = await createAuthenticatedContext(browser, adminId, 'OWNER');
  });

  test.afterAll(async () => {
    if (authContext) await authContext.close();
    await db.$disconnect();
  });

  // Helper to audit each page for zero horizontal scroll, no crashes, and complete rendering
  async function auditAdminPage(page: any, url: string, expectedTitleRegex?: RegExp) {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // 1. Must return HTTP 200 or successful status (< 400)
    expect(response?.status()).toBeLessThan(400);

    // 2. Body must not contain unhandled React / Next.js crash signatures
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('An unexpected response was received from the server');
    expect(pageText).not.toContain('Internal Server Error');
    expect(pageText).not.toContain('Application error: a client-side exception has occurred');

    // 3. Optional Title / Heading check
    if (expectedTitleRegex) {
      await expect(page.locator('body')).toHaveText(expectedTitleRegex, { timeout: 5000 });
    }

    // 4. Viewport Density Check (Zero Horizontal Scroll Rule)
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 5;
    });
    expect(hasHorizontalOverflow).toBe(false);

    // 5. Check that main container or header is visible
    const isMainRendered = await page.evaluate(() => {
      return document.querySelector('main') !== null || 
             document.querySelector('header') !== null || 
             document.querySelector('h1') !== null ||
             document.body.innerText.length > 50;
    });
    expect(isMainRendered).toBe(true);
  }

  test('Tab 01: /admin/dashboard — Overview & Quick Stats', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/dashboard');
    await page.close();
  });

  test('Tab 02: /admin/orders — Order Management & Actions', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/orders');
    await page.close();
  });

  test('Tab 03: /admin/catalog — Services List & Pricing Controls', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/catalog');
    await page.close();
  });

  test('Tab 04: /admin/catalog/categories — Category Hierarchy & Network Groups', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/catalog/categories');
    await page.close();
  });

  test('Tab 05: /admin/catalog/new — Create New Service Wizard', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/catalog/new');
    await page.close();
  });

  test('Tab 06: /admin/catalog/sync — Catalog Synchronization & Zombie Eraser', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/catalog/sync');
    await page.close();
  });

  test('Tab 07: /admin/catalog/quarantine — Loss Prevention & Quarantined Services', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/catalog/quarantine');
    await page.close();
  });

  test('Tab 08: /admin/catalog/drift — Provider Rate Drift Monitor', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/catalog/drift');
    await page.close();
  });

  test('Tab 09: /admin/catalog/patterns — Heuristic Auto-Tagging & Regex Rules', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/catalog/patterns');
    await page.close();
  });

  test('Tab 10: /admin/providers — Provider Cards & Balances', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/providers');
    await page.close();
  });

  test('Tab 11: /admin/providers/new — Add New Provider Form', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/providers/new');
    await page.close();
  });

  test('Tab 12: /admin/providers/import — Cherry-Pick Import Wizard', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/providers/import');
    await page.close();
  });

  test('Tab 13: /admin/providers/keys — 0ms Hot-Reload Provider API Keys', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/providers/keys');
    await page.close();
  });

  test('Tab 14: /admin/providers/health — Provider Health & Ping Latency', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/providers/health');
    await page.close();
  });

  test('Tab 15: /admin/tickets — Live Support Inbox & AI Assistant', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/tickets');
    await page.close();
  });

  test('Tab 16: /admin/finance — Revenue Ledger & 54-FZ Compliance', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/finance');
    await page.close();
  });

  test('Tab 17: /admin/finance/balance-requests — Balance Approvals & Crypto Verification', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/finance/balance-requests');
    await page.close();
  });

  test('Tab 18: /admin/finance/support-review — Support Audit & Refund Verification', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/finance/support-review');
    await page.close();
  });

  test('Tab 19: /admin/refills — Automated Refill & SLA Queue', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/refills');
    await page.close();
  });

  test('Tab 20: /admin/clients — CRM & User Management', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/clients');
    await page.close();
  });

  test('Tab 21: /admin/staff — Staff Roles & Granular Permissions', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/staff');
    await page.close();
  });

  test('Tab 22: /admin/analytics — BI Metrics, LTV & Financial Cohorts', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/analytics');
    await page.close();
  });

  test('Tab 23: /admin/fraud-monitor — Cyber Sentinel & Anomaly Detection', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/fraud-monitor');
    await page.close();
  });

  test('Tab 24: /admin/smart — Smart Drip Campaigns Scheduler', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/smart');
    await page.close();
  });

  test('Tab 25: /admin/cms — CMS Landing Pages & Visual Content Builder', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/cms');
    await page.close();
  });

  test('Tab 26: /admin/pages — Legal & Policy Pages Manager', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/pages');
    await page.close();
  });

  test('Tab 27: /admin/knowledge — Knowledge Base & FAQ Articles', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/knowledge');
    await page.close();
  });

  test('Tab 28: /admin/marketing — Promocodes & Affiliate Programs', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/marketing');
    await page.close();
  });

  test('Tab 29: /admin/settings — Global Settings, Currency & Mail Gateway', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/settings');
    await page.close();
  });

  test('Tab 30: /admin/settings/roles — System Roles & Access Matrix', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/settings/roles');
    await page.close();
  });

  test('Tab 31: /admin/system/features — Feature Flags & Dark Launch Controls', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/system/features');
    await page.close();
  });

  test('Tab 32: /admin/tenants — Multi-Tenant Brands (SMMplan / SMMflux)', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/tenants');
    await page.close();
  });

  test('Tab 33: /admin/manual — Interactive Support & Admin Documentation', async () => {
    const page = await authContext.newPage();
    await auditAdminPage(page, '/admin/manual');
    await page.close();
  });
});
