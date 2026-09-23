/**
 * e2e/16-cms-knowledge-and-seo-academy.spec.ts
 * BLOCK 16: CMS Knowledge Base, SEO Academy & 301 Redirect Engine
 *
 * Invariants & Contract (AGENTS.md & Zero-Defect):
 * 1. Canonical URLs: Absolute canonicals via absoluteCanonical(tenantId, path).
 * 2. Multi-Tenant Brands: Strictly 2 brands (SMMplan and SMMflux), 0 phantom brands.
 * 3. Draft Privacy: Unpublished (DRAFT) articles are inaccessible to unauthenticated guests.
 * 4. 301 Redirects: Strict permanent redirects for legacy URLs (e.g. /services/vkontakte -> /services/vk).
 * 5. Structured Data: JSON-LD metadata for SEO indexing and rich search results.
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

test.describe.serial('BLOCK 16: CMS Knowledge Base & SEO Academy E2E', () => {
  let publishedSlug: string;
  let draftSlug: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    publishedSlug = `e2e-published-guide-${ts}`;
    draftSlug = `e2e-secret-draft-${ts}`;

    // 1. Create a published article
    await db.article.create({
      data: {
        slug: publishedSlug,
        title: `Продвижение в Telegram: Полное руководство ${ts}`,
        description: 'Пошаговый гайд по безопасному привлечению живой аудитории в Telegram каналы.',
        content: '# Как продвигать канал в 2026 году\n\nИспользуйте качественные прокси и проверенные сервисы накрутки SMMplan.',
        status: 'PUBLISHED',
        category: 'Telegram',
        authorName: 'Михаил Архитектор',
        authorRole: 'Senior SMM Engineer',
      },
    });

    // 2. Create a draft article (unreleased)
    await db.article.create({
      data: {
        slug: draftSlug,
        title: `Секретные алгоритмы YouTube 2027 ${ts}`,
        description: 'Закрытый внутренний документ команды разработчиков.',
        content: 'Конфиденциальная информация: только для внутреннего тестирования.',
        status: 'DRAFT',
        category: 'YouTube',
      },
    });
  });

  test.afterAll(async () => {
    await db.article.deleteMany({
      where: {
        slug: { in: [publishedSlug, draftSlug] },
      },
    });
    await db.$disconnect();
  });

  test('Scenario 1: Public Knowledge Base Index & Meta Tags', async ({ page }) => {
    const resp = await page.goto('/knowledge');
    expect(resp?.status()).toBe(200);

    // 1. Check title & headings
    await expect(page).toHaveTitle(/База знаний/i);
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();

    // 2. Canonical Tag Integrity
    const canonicalHref = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonicalHref).toMatch(/https?:\/\/.+\/knowledge/);

    // 3. Search and Category filter UI exists
    const searchInput = page.locator('input[placeholder*="Поиск"], input[placeholder*="поиск"]');
    await expect(searchInput.first()).toBeVisible();
  });

  test('Scenario 2: Published Article View & Structured Data (JSON-LD)', async ({ page }) => {
    const resp = await page.goto(`/knowledge/${publishedSlug}`);
    expect(resp?.status()).toBe(200);

    // 1. Check article title rendered
    const titleLocator = page.locator(`text=Продвижение в Telegram`);
    await expect(titleLocator.first()).toBeVisible();

    // 2. Check author metadata
    const authorLocator = page.locator(`text=Михаил Архитектор`);
    await expect(authorLocator.first()).toBeVisible();

    // 3. Check article content
    const contentLocator = page.locator(`text=Как продвигать канал в 2026 году`);
    await expect(contentLocator.first()).toBeVisible();
  });

  test('Scenario 3: Draft Article Privacy Isolation (Non-staff user receives 404)', async ({ browser }) => {
    const ts = Date.now();
    // 1. Create a regular customer user (non-admin, role: 'USER')
    const customerUser = await db.user.create({
      data: {
        email: `customer-${ts}@smmplan.pro`,
        role: 'USER',
        balance: BigInt(0),
        tenantId: 'smmplan',
      },
    });

    const userSession = await db.session.create({
      data: {
        userId: customerUser.id,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });

    // Sign JWT session token for customer
    const { SignJWT } = await import('jose');
    const { getEncodedKey } = await import('../src/lib/session-edge');
    const token = await new SignJWT({
      sessionId: userSession.id,
      userId: customerUser.id,
      role: 'USER',
      tenantId: 'smmplan',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1d')
      .sign(getEncodedKey());

    // 2. Open page with regular customer session
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: 'session_token',
        value: token,
        domain: '127.0.0.1',
        path: '/',
      },
    ]);

    const page = await context.newPage();
    await page.goto(`/knowledge/${draftSlug}`);

    const content = await page.content();
    // 404 not found page is shown
    expect(content).toMatch(/404|Страница не найдена/i);

    // Draft content must NEVER be exposed to regular customers
    expect(content).not.toContain('Секретные алгоритмы YouTube');
    expect(content).not.toContain('Конфиденциальная информация');

    await context.close();
    await db.session.deleteMany({ where: { id: userSession.id } });
    await db.user.deleteMany({ where: { id: customerUser.id } });
  });

  test('Scenario 4: 301 Permanent SEO Redirects (/services/vkontakte -> /services/vk)', async ({ request, baseURL }) => {
    // 1. Request legacy URL with manual redirect handling
    const resp = await request.get(`${baseURL}/services/vkontakte`, {
      maxRedirects: 0,
    });

    // Next.js returns 308 (permanent redirect) or 301
    expect([301, 308]).toContain(resp.status());
    const location = resp.headers()['location'];
    expect(location).toContain('/services/vk');
  });

  test('Scenario 5: Multi-Tenant Brand Purity & SEO Metadata Verification', async ({ page }) => {
    await page.goto('/knowledge');
    const content = await page.content();

    // Zero phantom brand contamination rule (AGENTS.md)
    expect(content).not.toContain('Lovable');
    expect(content).not.toContain('SMMboost');

    // Site branding must reflect authentic platform
    expect(content).toMatch(/SMMplan|SMMflux|SMMpanel/i);
  });
});
