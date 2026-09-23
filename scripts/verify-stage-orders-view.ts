import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public',
    },
  },
});

function getEncodedKey(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('[SECURITY FATAL] JWT_SECRET or NEXTAUTH_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

async function createJwt(userId: string, role: string, tenantId = 'smmplan') {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'stage-screenshot-agent',
      ipAddress: '127.0.0.1',
    },
  });

  return new SignJWT({
    sessionId: session.id,
    userId,
    canResetPassword: false,
    role,
    tenantId,
    contour: 'test',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

async function main() {
  console.log('🚀 Starting Stage Visual Verification of Orders View Mode Switcher on :3005...');

  const artifactsDir = path.resolve(process.cwd(), 'artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const user = await prisma.user.findFirst({
    where: { email: 'art@artmspektr.ru' },
  });

  if (!user) {
    throw new Error('User art@artmspektr.ru not found in database');
  }

  const token = await createJwt(user.id, user.role, 'smmplan');
  console.log(`✓ Generated session token for user: ${user.email} (${user.id})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });

  await context.addCookies([
    { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
  ]);

  const page = await context.newPage();

  // 1. Desktop 1440px - Table Mode
  console.log('1. Testing Desktop 1440px (Table Mode)...');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://127.0.0.1:3005/dashboard/orders', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check horizontal overflow
  const desktopOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`   Desktop overflow: ${desktopOverflow ? 'FAIL (Horizontal scroll detected!)' : 'PASS (No horizontal scroll)'}`);

  // Switch to Table if not active
  const tableBtn = page.locator('button[title*="компактным списком"]');
  await tableBtn.click();
  await page.waitForTimeout(500);

  const shot1 = path.join(artifactsDir, '01_desktop_table_1440.png');
  await page.screenshot({ path: shot1, fullPage: false });
  console.log(`   Saved: ${shot1}`);

  // 2. Desktop 1440px - Cards Mode
  console.log('2. Testing Desktop 1440px (Cards Mode)...');
  const cardsBtn = page.locator('button[title*="карточками"]');
  await cardsBtn.click();
  await page.waitForTimeout(500);

  const shot2 = path.join(artifactsDir, '02_desktop_cards_1440.png');
  await page.screenshot({ path: shot2, fullPage: false });
  console.log(`   Saved: ${shot2}`);

  // 3. Tablet 1024px - Compact List Mode
  console.log('3. Testing Tablet 1024px (Compact List Mode)...');
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.waitForTimeout(500);

  const tabletOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`   Tablet overflow: ${tabletOverflow ? 'FAIL' : 'PASS (No horizontal scroll)'}`);

  await tableBtn.click();
  await page.waitForTimeout(500);

  const shot3 = path.join(artifactsDir, '03_tablet_compact_1024.png');
  await page.screenshot({ path: shot3, fullPage: false });
  console.log(`   Saved: ${shot3}`);

  // 4. Tablet 1024px - Cards Mode
  console.log('4. Testing Tablet 1024px (Cards Mode)...');
  await cardsBtn.click();
  await page.waitForTimeout(500);

  const shot4 = path.join(artifactsDir, '04_tablet_cards_1024.png');
  await page.screenshot({ path: shot4, fullPage: false });
  console.log(`   Saved: ${shot4}`);

  // 5. Mobile 390px - Compact List Mode
  console.log('5. Testing Mobile 390px (Compact List Mode)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`   Mobile overflow: ${mobileOverflow ? 'FAIL' : 'PASS (No horizontal scroll)'}`);

  await tableBtn.click();
  await page.waitForTimeout(500);

  const shot5 = path.join(artifactsDir, '05_mobile_compact_390.png');
  await page.screenshot({ path: shot5, fullPage: false });
  console.log(`   Saved: ${shot5}`);

  // 6. Mobile 390px - Cards Mode
  console.log('6. Testing Mobile 390px (Cards Mode)...');
  await cardsBtn.click();
  await page.waitForTimeout(500);

  const shot6 = path.join(artifactsDir, '06_mobile_cards_390.png');
  await page.screenshot({ path: shot6, fullPage: false });
  console.log(`   Saved: ${shot6}`);

  // Dismiss cookie consent banner if present
  try {
    const cookieAcceptBtn = page.locator('button:has-text("Принять")');
    if (await cookieAcceptBtn.isVisible({ timeout: 1000 })) {
      await cookieAcceptBtn.click();
      await page.waitForTimeout(300);
    }
  } catch {
    // ignore
  }

  // 7. Mobile 390px - Open Drawer
  console.log('7. Testing Mobile 390px (Open Details Drawer)...');
  // Switch to compact list first so we test clicking the compact list row
  await tableBtn.click();
  await page.waitForTimeout(500);

  // Click on the first compact order row
  const firstOrderRow = page.locator('.space-y-2 > div[role="button"]').first();
  await firstOrderRow.click();
  await page.waitForSelector('text=Заказ #', { timeout: 5000 });
  await page.waitForTimeout(600);

  const shot7 = path.join(artifactsDir, '07_mobile_drawer_390.png');
  await page.screenshot({ path: shot7, fullPage: false });
  console.log(`   Saved: ${shot7}`);

  await browser.close();
  await prisma.$disconnect();
  console.log('🎉 All 7 Stage visual verification checks completed successfully!');
}

main().catch((err) => {
  console.error('Error during stage visual verification:', err);
  process.exit(1);
});
