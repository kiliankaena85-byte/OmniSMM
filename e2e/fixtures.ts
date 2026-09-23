/**
 * e2e/fixtures.ts
 * Shared E2E Test Helpers & Data Seeding
 */

import { test as base, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { WalletOps } from '../src/services/financial/wallet-ops';
import { SignJWT } from 'jose';

export const db = new PrismaClient();

export const TEST_USER = {
  email: 'e2e-user@test.local',
  password: 'E2ePass123!',
};

export const TEST_ADMIN = {
  email: 'e2e-admin@test.local',
  password: 'E2eAdmin123!',
};

import crypto from 'crypto';

export async function hashTestPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
  return `$s2$65536$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Creates or resets a regular test user with specified RUB balance via WalletOps
 */
export async function seedTestUser(balanceRub: number = 10_000): Promise<{ id: string; email: string }> {
  const hash = await hashTestPassword(TEST_USER.password);

  const user = await db.user.upsert({
    where: { email_tenantId: { email: TEST_USER.email, tenantId: 'smmplan' } },
    update: { passwordHash: hash, isActive: true, role: 'USER' },
    create: {
      email: TEST_USER.email,
      tenantId: 'smmplan',
      passwordHash: hash,
      role: 'USER',
      isActive: true,
      balance: 0,
    },
  });

  // Ensure balance via WalletOps
  const currentBalanceCents = user.balance;
  const targetBalanceCents = Math.round(balanceRub * 100);
  const deltaCents = targetBalanceCents - currentBalanceCents;
  if (deltaCents !== 0) {
    if (deltaCents > 0) {
      await WalletOps.credit(
        db,
        user.id,
        deltaCents,
        'E2E test seed deposit',
        { idempotencyKey: `e2e-seed-${user.id}-${Date.now()}` }
      );
    } else {
      await WalletOps.charge(
        db,
        user.id,
        Math.abs(deltaCents),
        'E2E test seed balance adjust',
        { idempotencyKey: `e2e-seed-debit-${user.id}-${Date.now()}` }
      );
    }
  }

  return { id: user.id, email: user.email };
}

/**
 * Creates or resets an OWNER/ADMIN user with EmployeeResponsibilityConsent
 */
export async function seedTestAdmin(): Promise<{ id: string; email: string }> {
  const hash = await hashTestPassword(TEST_ADMIN.password);

  const admin = await db.user.upsert({
    where: { email_tenantId: { email: TEST_ADMIN.email, tenantId: 'smmplan' } },
    update: { passwordHash: hash, isActive: true, isDeleted: false, role: 'OWNER' },
    create: {
      email: TEST_ADMIN.email,
      tenantId: 'smmplan',
      passwordHash: hash,
      role: 'OWNER',
      isActive: true,
      isDeleted: false,
      balance: 0,
    },
  });

  // Ensure EmployeeResponsibilityConsent
  const consent = await db.employeeResponsibilityConsent.findFirst({
    where: { userId: admin.id, status: 'ACTIVE' },
  });
  if (!consent) {
    await db.employeeResponsibilityConsent.create({
      data: {
        userId: admin.id,
        tenantId: 'smmplan',
        documentHash: 'e2e-consent-hash',
        documentVersionText: '1.0',
        status: 'ACTIVE',
        acceptedIp: '127.0.0.1',
        acceptedUserAgent: 'Playwright E2E',
      },
    });
  }

  return { id: admin.id, email: admin.email };
}

/**
 * Performs real UI login via /login page
 */
export async function login(page: Page, user: { email: string; password?: string }): Promise<void> {
  const pass = user.password || TEST_USER.password;
  await page.goto('/login');
  await page.locator('#login-email').fill(user.email);
  await page.locator('#login-password').fill(pass);
  await page.getByRole('button', { name: /Войти в кабинет/i }).click();
  await page.waitForURL(/\/(dashboard|admin)/, { timeout: 15_000 });
}

import { getEncodedKey } from '../src/lib/session-edge';

/**
 * Mints JWT session token directly for headless fast auth
 */
export async function createAuthenticatedSession(userId: string, role: string = 'USER'): Promise<string> {
  const encodedKey = getEncodedKey();
  const session = await db.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: '127.0.0.1',
      userAgent: 'Playwright E2E',
    },
  });
  return new SignJWT({ sessionId: session.id, userId, role, tenantId: 'smmplan' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

/**
 * Creates a browser context with authenticated cookies and tenant header
 */
export async function createAuthenticatedContext(browser: any, userId: string, role: string = 'USER') {
  const token = await createAuthenticatedSession(userId, role);
  const expiryUnix = Math.floor(Date.now() / 1000) + 7 * 86400;
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: 'session_token',
      value: token,
      domain: '127.0.0.1',
      path: '/',
      expires: expiryUnix,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'x_tenant',
      value: 'smmplan',
      domain: '127.0.0.1',
      path: '/',
      expires: expiryUnix,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  return context;
}

/**
 * Removes test users safely via email matching
 */
export async function cleanupTestUsers(): Promise<void> {
  await db.user.deleteMany({
    where: {
      email: {
        in: [TEST_USER.email, TEST_ADMIN.email],
      },
    },
  }).catch(() => {});
}
