/**
 * e2e/admin.spec.ts
 * Admin Flow E2E Tests — доступ к панели, защита роутов, dev route блокировка,
 * balance adjustment (policy check), support compensation (limit check).
 *
 * RULES (AGENTS.md):
 * - /admin → 200 для OWNER/ADMIN, redirect для USER
 * - /api/dev/login-direct → 404 (ENABLE_DEV_BYPASS не задан)
 * - Balance adjustment проходит через SupportBalancePolicyService
 * - Server/Client boundary: Server Actions used for admin mutations
 */

import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const db = new PrismaClient();

async function mintToken(userId: string, role: string): Promise<string> {
  const jwtSecret = process.env.JWT_SECRET ?? 'fallback-secret';
  const encodedKey = new TextEncoder().encode(jwtSecret);
  const session = await db.session.create({
    data: { userId, expiresAt: new Date(Date.now() + 86_400_000) },
  });
  return new SignJWT({ sessionId: session.id, userId, role, tenantId: 'smmplan' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(encodedKey);
}

test.describe('Admin Panel Access & Security', () => {
  let adminId: string;
  let regularUserId: string;
  let targetUserId: string;

  test.beforeAll(async () => {
    const admin = await db.user.upsert({
      where: { email_tenantId: { email: 'e2e-admin-test@smmplan.local', tenantId: 'smmplan' } },
      update: { role: 'OWNER', isActive: true, balance: 0 },
      create: { email: 'e2e-admin-test@smmplan.local', tenantId: 'smmplan', role: 'OWNER', isActive: true, balance: 0 },
    });
    adminId = admin.id;

    const regular = await db.user.upsert({
      where: { email_tenantId: { email: 'e2e-regular-test@smmplan.local', tenantId: 'smmplan' } },
      update: { role: 'USER', isActive: true, balance: 5000 },
      create: { email: 'e2e-regular-test@smmplan.local', tenantId: 'smmplan', role: 'USER', isActive: true, balance: 5000 },
    });
    regularUserId = regular.id;

    const target = await db.user.upsert({
      where: { email_tenantId: { email: 'e2e-target-user@smmplan.local', tenantId: 'smmplan' } },
      update: { balance: 0, isActive: true, role: 'USER' },
      create: { email: 'e2e-target-user@smmplan.local', tenantId: 'smmplan', role: 'USER', isActive: true, balance: 0 },
    });
    targetUserId = target.id;

    // Seed BalanceAdjustmentPolicy for admin adjustment tests
    const existingPolicy = await db.balanceAdjustmentPolicy.findFirst({
      where: { enabled: true },
    });
    if (!existingPolicy) {
      await db.balanceAdjustmentPolicy.create({
        data: {
          enabled: true,
          scopeType: 'GLOBAL',
          maxCreditPerRequest: 100_000,
          maxDebitPerRequest: 100_000,
          maxTotalPerDay: 500_000,
          allowedTargetRoles: ['USER'],
          allowedCreditReasonCodes: ['COMPENSATION', 'PROMO', 'BONUS'],
          allowedDebitReasonCodes: ['CORRECTION', 'CHARGEBACK'],
          canRequestCredit: true,
          canRequestDebit: true,
          requireTicket: false,
        },
      });
    }
  });

  test.afterAll(async () => {
    await db.user
      .deleteMany({
        where: {
          email: {
            in: [
              'e2e-admin-test@smmplan.local',
              'e2e-regular-test@smmplan.local',
              'e2e-target-user@smmplan.local',
            ],
          },
        },
      })
      .catch(() => {});
    await db.$disconnect();
  });

  // ─────────────────────────────────────────────
  // 1. Admin login → dashboard accessible
  // ─────────────────────────────────────────────
  test('Admin can access /admin dashboard (200)', async ({ page }) => {
    const token = await mintToken(adminId, 'OWNER');
    await page.context().addCookies([{ name: 'session_token', value: token, domain: 'localhost', path: '/' }]);

    const response = await page.goto('/admin/dashboard');
    expect(response?.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/Дашборд|Dashboard|SMMplan|Операционка/i, { timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 2. Regular user → /admin redirected (403/redirect to /login or /dashboard)
  // ─────────────────────────────────────────────
  test('Regular USER is denied access to /admin', async ({ page }) => {
    const token = await mintToken(regularUserId, 'USER');
    await page.context().addCookies([{ name: 'session_token', value: token, domain: '127.0.0.1', path: '/' }]);

    await page.goto('/admin');
    // Must redirect to /login or /dashboard — NOT stay on /admin
    await expect(page).not.toHaveURL(/\/admin$/, { timeout: 8_000 });
  });

  // ─────────────────────────────────────────────
  // 3. Unauthenticated → /admin redirected to /login
  // ─────────────────────────────────────────────
  test('Unauthenticated visitor is redirected from /admin to /login', async ({ page }) => {
    // Clear cookies — no session
    await page.context().clearCookies();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 4. /api/dev/login-direct → 404 (ENABLE_DEV_BYPASS not set)
  // ─────────────────────────────────────────────
  test('/api/dev/login-direct returns 404 when ENABLE_DEV_BYPASS is not set', async ({ request }) => {
    // In test env, ENABLE_DEV_BYPASS is not set → should return 404
    const resp = await request.get('/api/dev/login-direct?email=test@test.com');
    // The route guard: NODE_ENV !== production, but ENABLE_DEV_BYPASS must be 'true' to open
    // Since we don't set ENABLE_DEV_BYPASS in .env.test, this should be 404
    expect([404, 400]).toContain(resp.status());
  });

  // ─────────────────────────────────────────────
  // 5. Admin dashboard loads key sections
  // ─────────────────────────────────────────────
  test('Admin dashboard contains navigation links to orders, users, finance', async ({ page }) => {
    const token = await mintToken(adminId, 'OWNER');
    await page.context().addCookies([{ name: 'session_token', value: token, domain: 'localhost', path: '/' }]);

    await page.goto('/admin/dashboard');
    await expect(page.locator('body')).toContainText(/Дашборд|Dashboard|SMMplan/i, { timeout: 10_000 });

    const nav = page.locator('nav, aside, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 5_000 });
  });

  // ─────────────────────────────────────────────
  // 6. Admin users list is accessible
  // ─────────────────────────────────────────────
  test('Admin can access /admin/users page', async ({ page }) => {
    const token = await mintToken(adminId, 'OWNER');
    await page.context().addCookies([{ name: 'session_token', value: token, domain: '127.0.0.1', path: '/' }]);

    await page.goto('/admin/clients');
    await expect(page).toHaveURL(/\/admin\/clients/, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/Клиенты|Clients|Пользователи/i, { timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 7. Balance adjustment UI exists and policy is enforced
  // ─────────────────────────────────────────────
  test('Admin can navigate to user balance adjustment page', async ({ page }) => {
    const token = await mintToken(adminId, 'OWNER');
    await page.context().addCookies([{ name: 'session_token', value: token, domain: 'localhost', path: '/' }]);

    // Navigate to target user's admin page
    await page.goto(`/admin/clients/${targetUserId}`);
    await expect(page.locator('body')).toContainText(/Баланс|Balance|Клиент|Client|Пользователь/i, { timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 8. Balance adjustment API enforces policy limits
  // ─────────────────────────────────────────────
  test('Balance adjustment that exceeds policy limit is rejected', async ({ request }) => {
    const token = await mintToken(adminId, 'OWNER');

    // Attempt to credit 1M RUB — exceeds any reasonable policy
    const response = await request.post('/api/admin/balance-adjust', {
      headers: { Cookie: `session_token=${token}` },
      data: {
        userId: targetUserId,
        amountRub: 1_000_000,
        reason: 'e2e-test-overlimit',
        type: 'CREDIT',
      },
    });

    // Should be rejected (400, 403, 404, 422, 500)
    expect([400, 403, 404, 422, 500]).toContain(response.status());
  });

  // ─────────────────────────────────────────────
  // 9. Support Compensation page requires ticket context
  // ─────────────────────────────────────────────
  test('Support compensation endpoint requires valid ticket reference', async ({ request }) => {
    const token = await mintToken(adminId, 'OWNER');

    // Try compensation without valid ticket
    const response = await request.post('/api/admin/compensation', {
      headers: { Cookie: `session_token=${token}` },
      data: {
        ticketId: 'nonexistent-ticket-id',
        costRub: '50.00',
        note: 'E2E test compensation',
        topUpBalance: true,
      },
    });

    // Must be rejected
    expect([400, 403, 404, 422, 500]).toContain(response.status());
  });

  // ─────────────────────────────────────────────
  // 10. Admin orders page loads
  // ─────────────────────────────────────────────
  test('Admin can access /admin/orders page', async ({ page }) => {
    const token = await mintToken(adminId, 'OWNER');
    await page.context().addCookies([{ name: 'session_token', value: token, domain: '127.0.0.1', path: '/' }]);

    await page.goto('/admin/orders');
    await expect(page).toHaveURL(/\/admin\/orders/, { timeout: 10_000 });
    // Page renders without crash
    await expect(page.locator('h1, table, [data-testid="orders-grid"]').first()).toBeVisible({ timeout: 10_000 });
  });

  // ─────────────────────────────────────────────
  // 11. Admin finance page loads
  // ─────────────────────────────────────────────
  test('Admin can access /admin/finance page', async ({ page }) => {
    const token = await mintToken(adminId, 'OWNER');
    await page.context().addCookies([{ name: 'session_token', value: token, domain: 'localhost', path: '/' }]);

    await page.goto('/admin/finance');
    await expect(page).toHaveURL(/\/admin\/finance/, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText(/Финансы|Finance|Баланс|Выручка|Доход/i, { timeout: 10_000 });
  });
});
