import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public',
    },
  },
});

function getEncodedKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || '58b78402370d7188f93ee41667e3d118892f61de916f8ac0786064b5d7e5c6d5';
  return new TextEncoder().encode(secret);
}

async function createJwt(userId: string) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'stage-cookie-test-agent',
      ipAddress: '127.0.0.1',
    },
  });

  return new SignJWT({
    sessionId: session.id,
    userId,
    role: 'USER',
    tenantId: 'smmplan',
    contour: 'local',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

async function main() {
  console.log('🚀 Verifying Cookie Consent behavior on Stage :3005...');
  const browser = await chromium.launch({ headless: true });

  try {
    // 1. Check Public Landing Page (Unauthenticated, no consent)
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto('http://localhost:3005/');
    await guestPage.waitForTimeout(1500);

    const guestBanner = await guestPage.$('aside[aria-label="Согласие на использование файлов cookie"]');
    if (!guestBanner) {
      throw new Error('❌ Cookie consent banner should be visible on public landing page for guests!');
    }
    console.log('✓ 1. Public landing page correctly displays 152-FZ cookie consent banner for guests.');
    await guestContext.close();

    // 2. Check Dashboard for Authenticated User
    const user = await prisma.user.findFirst({
      where: { role: 'USER' },
      select: { id: true, email: true }
    });
    if (!user) throw new Error('No test user found in DB');

    const authContext = await browser.newContext();
    const sessionToken = await createJwt(user.id);

    await authContext.addCookies([
      {
        name: 'session_token',
        value: sessionToken,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    const authPage = await authContext.newPage();
    await authPage.goto('http://localhost:3005/dashboard');
    await authPage.waitForTimeout(1500);

    const dashboardBanner = await authPage.$('aside[aria-label="Согласие на использование файлов cookie"]');
    if (dashboardBanner) {
      throw new Error('❌ Cookie consent banner should NEVER appear in /dashboard!');
    }
    console.log('✓ 2. Dashboard correctly suppresses cookie consent banner.');

    const cookies = await authContext.cookies('http://localhost:3005');
    const hasConsentCookie = cookies.some(c => c.name === 'cookie_consent' && c.value === 'true');
    if (!hasConsentCookie) {
      throw new Error('❌ cookie_consent=true cookie was not set!');
    }
    console.log('✓ 3. cookie_consent=true is automatically set in browser cookies for authenticated user.');

    // Screenshot dashboard to prove clean view
    await authPage.screenshot({ path: 'artifacts/stage_dashboard_no_cookie_banner.png' });
    console.log('✓ 4. Screenshot saved: artifacts/stage_dashboard_no_cookie_banner.png');

    console.log('🎉 All Cookie Consent Stage tests passed!');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
