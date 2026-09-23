import { test as setup } from '@playwright/test';
import { SignJWT } from 'jose';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { getEncodedKey } from '../src/lib/session-edge';

const prisma = new PrismaClient();
const authFile = path.join(__dirname, 'playwright/.auth/user.json');

setup('authenticate', async ({ page, context }) => {
  // Clear any existing cookies to avoid stale session tokens
  await context.clearCookies();

  const email = `e2e-tester@test.com`;

  const user = await prisma.user.upsert({
    where: { email_tenantId: { email, tenantId: 'smmplan' } },
    update: { balance: 200000_00, role: 'OWNER', isActive: true, isDeleted: false },
    create: {
      email,
      tenantId: 'smmplan',
      balance: 200000_00,
      role: 'OWNER',
      isActive: true,
      isDeleted: false
    }
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  const encodedKey = getEncodedKey();
  const sessionToken = await new SignJWT({
    sessionId: session.id,
    userId: user.id,
    role: user.role,
    tenantId: 'smmplan'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  const expiryUnix = Math.floor(Date.now() / 1000) + 7 * 86400;

  // Inject cookies with proper origin URLs and future expiry
  await context.addCookies([
    {
      name: 'session_token',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
      expires: expiryUnix,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'session_token',
      value: sessionToken,
      domain: 'localhost',
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
    {
      name: 'x_tenant',
      value: 'smmplan',
      domain: 'localhost',
      path: '/',
      expires: expiryUnix,
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    }
  ]);

  // Save storage state for remaining tests
  await context.storageState({ path: authFile });
});
