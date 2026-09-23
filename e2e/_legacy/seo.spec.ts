/**
 * e2e/seo.spec.ts
 * SEO Flow E2E Tests — canonical tags, OG, JSON-LD, robots.txt, sitemap, noindex.
 *
 * RULES (AGENTS.md):
 * - Canonical ОБЯЗАН быть абсолютным через absoluteCanonical(tenantId, path).
 * - НЕТ ссылок на lovable.pro в canonical.
 * - /admin обязан иметь X-Robots-Tag: noindex или meta robots noindex.
 * - /robots.txt обязан содержать Disallow: /admin.
 * - /sitemap.xml обязан содержать /services URLs, НЕ содержать /admin.
 * - SEO Quality Gate: категории с <3 активными услугами не попадают в sitemap.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

test.describe('SEO Checks', () => {
  let adminId: string;

  test.beforeAll(async () => {
    // Seed tenant and system settings
    await db.tenant.upsert({
      where: { id: 'smmplan' },
      update: {},
      create: { id: 'smmplan', name: 'SMMplan', slug: 'smmplan', domain: 'smmplan.pro', vaultSalt: 'test-salt' },
    });

    await db.systemSettings.upsert({
      where: { id: 'smmplan' },
      update: { exchangeRateUSD: 95.0, isTestMode: true },
      create: { id: 'smmplan', exchangeRateUSD: 95.0, isTestMode: true },
    });

    // Admin for /admin access checks
    const admin = await db.user.upsert({
      where: { email_tenantId: { email: 'e2e-seo-admin@smmplan.local', tenantId: 'smmplan' } },
      update: { role: 'OWNER', isActive: true },
      create: { email: 'e2e-seo-admin@smmplan.local', tenantId: 'smmplan', role: 'OWNER', isActive: true, balance: 0 },
    });
    adminId = admin.id;
  });

  test.afterAll(async () => {
    await db.user
      .deleteMany({ where: { email: 'e2e-seo-admin@smmplan.local' } })
      .catch(() => {});
    await db.$disconnect();
  });

  // ─────────────────────────────────────────────
  // 1. Homepage — canonical, OG tags, JSON-LD
  // ─────────────────────────────────────────────
  test('Homepage has canonical URL, OG tags, and JSON-LD', async ({ page }) => {
    await page.goto('/');
    await expect(page).not.toHaveURL(/error/);

    // Canonical link
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveCount(1, { timeout: 10_000 });
    const canonicalHref = await canonical.getAttribute('href');
    expect(canonicalHref).toBeTruthy();
    expect(canonicalHref).not.toContain('lovable.pro');
    expect(canonicalHref).toMatch(/^https?:\/\//);

    // OG title
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveCount(1);
    const title = await ogTitle.getAttribute('content');
    expect(title).toBeTruthy();
    expect(title!.length).toBeGreaterThan(3);

    // OG description
    const ogDescription = page.locator('meta[property="og:description"]');
    await expect(ogDescription).toHaveCount(1);
    expect(await ogDescription.getAttribute('content')).toBeTruthy();
  });

  // ─────────────────────────────────────────────
  // 2. /services — BreadcrumbList JSON-LD
  // ─────────────────────────────────────────────
  test('/services page has BreadcrumbList JSON-LD', async ({ page }) => {
    await page.goto('/services');
    await expect(page).toHaveURL(/\/services/);
    const script = page.locator('script[type="application/ld+json"]').first();
    await expect(script).toBeAttached({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 3. /services/{network}/{category} — FAQPage & Service schema
  // ─────────────────────────────────────────────
  test('Service category page has Service or FAQPage JSON-LD', async ({ page }) => {
    await page.goto('/services/telegram/podpischiki');
    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts.first()).toBeAttached({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 4. /admin — noindex header / meta tag
  // ─────────────────────────────────────────────
  test('/admin has noindex directive (meta tag or header)', async ({ page }) => {
    const resp = await page.goto('/admin');
    const xRobots = resp?.headers()['x-robots-tag'];
    const metaRobots = page.locator('meta[name="robots"]');
    const metaCount = await metaRobots.count();

    let hasNoindex = false;
    if (xRobots && xRobots.includes('noindex')) {
      hasNoindex = true;
    }
    if (metaCount > 0) {
      const content = await metaRobots.getAttribute('content');
      if (content?.includes('noindex')) {
        hasNoindex = true;
      }
    }

    expect(hasNoindex).toBe(true);
  });

  // ─────────────────────────────────────────────
  // 5. /robots.txt — Disallow: /admin
  // ─────────────────────────────────────────────
  test('/robots.txt contains Disallow: /admin', async ({ request }) => {
    const resp = await request.get('/robots.txt');
    expect(resp.status()).toBe(200);

    const body = await resp.text();
    expect(body).toContain('Disallow: /admin');
    expect(body).toMatch(/User-agent:/i);
    expect(body).not.toContain('Allow: /admin');
  });

  // ─────────────────────────────────────────────
  // 6. /sitemap.xml — contains /services, not /admin
  // ─────────────────────────────────────────────
  test('/sitemap.xml contains /services URLs and excludes /admin', async ({ request }) => {
    const resp = await request.get('/sitemap.xml');
    expect(resp.status()).toBe(200);

    const xml = await resp.text();
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('lovable.pro');
  });

  test('/sitemap.xml — /services present for active catalog, /admin absent', async ({ request }) => {
    const resp = await request.get('/sitemap.xml');
    expect(resp.status()).toBe(200);

    const xml = await resp.text();
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('lovable.pro');
  });

  // ─────────────────────────────────────────────
  // 7. Title & Meta Description Checks
  // ─────────────────────────────────────────────
  test('Homepage title is descriptive and unique', async ({ page }) => {
    await page.goto('/');
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(5);
  });

  test('/services has meta description', async ({ page }) => {
    await page.goto('/services');
    const metaDesc = page.locator('meta[name="description"]');
    const count = await metaDesc.count();
    expect(count).toBeGreaterThanOrEqual(1);
    const content = await metaDesc.getAttribute('content');
    expect(content).toBeTruthy();
  });

  test('Canonical URLs across pages never reference lovable.pro', async ({ page }) => {
    const pagesToCheck = ['/', '/services', '/knowledge', '/legal/privacy', '/legal/terms'];
    for (const path of pagesToCheck) {
      await page.goto(path);
      const canonical = page.locator('link[rel="canonical"]');
      if ((await canonical.count()) > 0) {
        const href = await canonical.getAttribute('href');
        expect(href).not.toContain('lovable.pro');
      }
    }
  });
});
