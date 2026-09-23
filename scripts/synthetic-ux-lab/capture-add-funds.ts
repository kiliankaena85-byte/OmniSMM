import { chromium, devices } from '@playwright/test';
import { SignJWT } from 'jose';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const outDir = 'C:/Users/Артём/.gemini/antigravity/brain/73acab9d-bf20-4e61-8801-bab479069f83';

async function main() {
  console.log('Logging in and launching browser for add-funds mobile...');
  const secretKey = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(secretKey);
  const email = `e2e-tester@test.com`;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('User not found');

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  const sessionToken = await new SignJWT({ sessionId: session.id, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  const browser = await chromium.launch({ headless: true });
  const iPhone = devices['iPhone 12'];
  const mobileContext = await browser.newContext({
    ...iPhone,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  await mobileContext.addCookies([
    {
      name: 'session_token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }
  ]);

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://localhost:3000/dashboard/add-funds', { waitUntil: 'networkidle', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);

  // Take screenshot of the page
  const fixedPath = path.join(outDir, 'media__promocode_fixed.png');
  await mobilePage.screenshot({ path: fixedPath, fullPage: true });
  console.log(`✓ Saved fixed promocode screenshot to: ${fixedPath}`);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
