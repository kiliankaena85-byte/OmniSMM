import { chromium } from 'playwright';
import { db } from '../src/lib/db';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';
import fs from 'fs';
import path from 'path';

async function createOwnerJwt(userId: string, tenantId = 'smmplan') {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'unknown',
      ipAddress: '127.0.0.1',
    },
  });

  return new SignJWT({
    sessionId: session.id,
    userId,
    canResetPassword: false,
    role: 'OWNER',
    tenantId,
    contour: 'local',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

async function runVisualVerification() {
  console.log('📸 [VISUAL AUDIT] Starting comprehensive visual audit on http://127.0.0.1:3000...');
  
  const outDir = path.resolve(process.cwd(), 'artifacts/visual-verification');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Ensure owner user exists
  let ownerUser = await db.user.findFirst({ where: { role: 'OWNER' } });
  if (!ownerUser) {
    ownerUser = await db.user.create({
      data: {
        email: 'owner@smmplan.test',
        role: 'OWNER',
        tenantId: 'smmplan',
        balance: 1000000n,
      },
    });
  }

  const ownerToken = await createOwnerJwt(ownerUser.id);

  const browser = await chromium.launch({
    headless: true,
  });

  // 1. Desktop Context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await desktopContext.newPage();
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // 1. Desktop Landing
  console.log('1. Capturing Desktop Landing Page (1440x900)...');
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(1000);
  
  const horizontalScrollDesktop = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`   Desktop horizontal scroll: ${horizontalScrollDesktop ? 'DETECTED' : 'NONE (0px)'}`);
  await page.screenshot({ path: path.join(outDir, '01_landing_desktop.png'), fullPage: false });

  // 2. Mobile Context
  console.log('2. Capturing Mobile Landing Page (390x844)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 35000 });
  await mobilePage.waitForTimeout(1000);
  
  const horizontalScrollMobile = await mobilePage.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log(`   Mobile horizontal scroll: ${horizontalScrollMobile ? 'DETECTED' : 'NONE (0px)'}`);
  await mobilePage.screenshot({ path: path.join(outDir, '02_landing_mobile.png'), fullPage: false });

  // 3. Catalog Page
  console.log('3. Capturing Catalog Page (1440x900)...');
  await page.goto('http://127.0.0.1:3000/catalog', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '03_catalog_desktop.png'), fullPage: false });

  // 4. Login Page
  console.log('4. Capturing Login Page (1440x900)...');
  await page.goto('http://127.0.0.1:3000/login', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(outDir, '04_login_desktop.png'), fullPage: false });

  // 5. Admin Import Wizard (Decomposed Wave 14)
  console.log('5. Capturing Admin Import Wizard (/admin/providers/import)...');
  await desktopContext.addCookies([
    {
      name: 'session_token',
      value: ownerToken,
      url: 'http://127.0.0.1:3000/',
    },
    {
      name: 'x_tenant',
      value: 'smmplan',
      url: 'http://127.0.0.1:3000/',
    },
  ]);
  await page.goto('http://127.0.0.1:3000/admin/providers/import', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, '05_admin_import_wizard.png'), fullPage: true });

  await browser.close();

  console.log('\n📊 [AUDIT SUMMARY]');
  console.log(`- Desktop Horizontal Overflow: ${horizontalScrollDesktop ? 'FAILED (Horizontal Scroll detected)' : 'PASSED (0px overflow)'}`);
  console.log(`- Mobile Horizontal Overflow: ${horizontalScrollMobile ? 'FAILED (Horizontal Scroll detected)' : 'PASSED (0px overflow)'}`);
  console.log(`- Captured Screenshots: ${fs.readdirSync(outDir).join(', ')}`);
  console.log(`- Total Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.log('Console Errors:', consoleErrors.slice(0, 5));
  }
}

runVisualVerification().catch((err) => {
  console.error('Visual verification failed:', err);
  process.exit(1);
});
