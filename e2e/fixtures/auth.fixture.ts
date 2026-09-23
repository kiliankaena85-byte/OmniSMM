import { test as base, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const db = new PrismaClient();

interface AuthFixtures {
  userPage: Page;
  adminPage: Page;
}

export const test = base.extend<AuthFixtures>({
  userPage: async ({ browser }, use) => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('[E2E] JWT_SECRET not set. Add it to .env.test or .env');

    const email = `test-user-${Date.now()}@example.com`;
    const user = await db.user.create({
      data: {
        email,
        role: 'USER',
        balance: 10000,
      }
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await db.session.create({
      data: {
        userId: user.id,
        expiresAt,
        userAgent: 'unknown',
        ipAddress: '127.0.0.1',
      }
    });

    const encodedKey = new TextEncoder().encode(jwtSecret);
    const sessionToken = await new SignJWT({ sessionId: session.id, userId: user.id, role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(encodedKey);

    const context = await browser.newContext();
    await context.addCookies([{
      name: 'session_token',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
    }]);

    const page = await context.newPage();

    try {
      await use(page);
    } finally {
      await context.close();
      await db.user.delete({ where: { id: user.id } });
    }
  },

  adminPage: async ({ browser }, use) => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('[E2E] JWT_SECRET not set. Add it to .env.test or .env');

    const email = `test-admin-${Date.now()}@example.com`;
    const admin = await db.user.create({
      data: {
        email,
        role: 'OWNER',
        balance: 0,
      }
    });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const session = await db.session.create({
      data: {
        userId: admin.id,
        expiresAt,
        userAgent: 'unknown',
        ipAddress: '127.0.0.1',
      }
    });

    const encodedKey = new TextEncoder().encode(jwtSecret);
    const sessionToken = await new SignJWT({ sessionId: session.id, userId: admin.id, role: admin.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(encodedKey);

    const context = await browser.newContext();
    await context.addCookies([{
      name: 'session_token',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
    }]);

    const page = await context.newPage();

    try {
      await use(page);
    } finally {
      await context.close();
      await db.user.delete({ where: { id: admin.id } });
    }
  },
});

export { expect } from '@playwright/test';
