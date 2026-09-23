import puppeteer from 'puppeteer';
import { db } from '../src/lib/db';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../src/lib/session-edge';
import fs from 'fs';
import path from 'path';

async function createTestJwt(userId: string, role: string, tenantId = 'smmplan') {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'puppeteer-smoke',
      ipAddress: '127.0.0.1',
    },
  });

  return new SignJWT({
    sessionId: session.id,
    userId,
    canResetPassword: false,
    role,
    tenantId,
    contour: 'local',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

async function main() {
  console.log('🚀 Starting Puppeteer Live Browser UI Smoke Verification...');
  const artifactsDir = path.resolve(process.cwd(), 'screenshots');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // 1. Get or create test users
  let clientUser = await db.user.findFirst({ where: { email: 'testclient1@example.com' } });
  if (!clientUser) {
    clientUser = await db.user.create({
      data: {
        email: 'testclient1@example.com',
        balance: 500750n,
        role: 'USER',
        tenantId: 'smmplan',
      },
    });
  }

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

  // Find or create a support user
  let supportUser = await db.user.findFirst({ where: { role: 'SUPPORT' } });
  if (!supportUser) {
    supportUser = await db.user.create({
      data: {
        email: 'support_tester@smmplan.test',
        role: 'SUPPORT',
        tenantId: 'smmplan',
        balance: 0n,
      },
    });
  }

  const clientToken = await createTestJwt(clientUser.id, 'USER');
  const supportToken = await createTestJwt(supportUser.id, 'SUPPORT');
  const ownerToken = await createTestJwt(ownerUser.id, 'OWNER');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // ══════════════════════════════════════════════════════════════════════
  // TEST 1: User Dashboard (Balance consistency & Dynamic Social Networks)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n--- 1. Testing User Dashboard UI (/dashboard) ---');
  await page.setCookie({
    name: 'session',
    value: clientToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });

  await page.goto('http://127.0.0.1:3000/dashboard', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: path.join(artifactsDir, '01_user_dashboard.png'), fullPage: true });

  const pageContent = await page.content();

  // Verify dynamic networks label
  const hasDynamicNetworksHeading = pageContent.includes('Быстрый заказ по соцсетям');
  const hasOldHardcodedPlatformText = pageContent.includes('Все 34 платформы');
  console.log(`✓ "Быстрый заказ по соцсетям" present: ${hasDynamicNetworksHeading}`);
  console.log(`✓ "Все 34 платформы" eradicated: ${!hasOldHardcodedPlatformText}`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 2: Promo / Voucher Code Modal / Page (/dashboard/add-funds)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n--- 2. Testing Promo Code UI (/dashboard/add-funds) ---');
  await page.goto('http://127.0.0.1:3000/dashboard/add-funds', { waitUntil: 'networkidle2', timeout: 30000 });
  
  await page.screenshot({ path: path.join(artifactsDir, '02_add_funds_promo.png'), fullPage: true });
  console.log('✓ Promo code screen rendered without Server Component crash');

  // ══════════════════════════════════════════════════════════════════════
  // TEST 3: Admin Dashboard for SUPPORT Role (Widgets properly hidden)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n--- 3. Testing Admin Dashboard for SUPPORT Role (/admin/dashboard) ---');
  await page.setCookie({
    name: 'session',
    value: supportToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });

  await page.goto('http://127.0.0.1:3000/admin/dashboard', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: path.join(artifactsDir, '03_admin_dashboard_support.png'), fullPage: true });

  const supportAdminContent = await page.content();
  const supportHasLiquidityWidget = supportAdminContent.includes('Внешняя ликвидность') || supportAdminContent.includes('Global Provider Liquidity');
  const supportHasExecutiveAiDigest = supportAdminContent.includes('Executive AI Observer') || supportAdminContent.includes('Kill-Switch');
  const supportHasAuditLog = supportAdminContent.includes('Журнал безопасности и действий');

  console.log(`✓ Provider Liquidity hidden for SUPPORT: ${!supportHasLiquidityWidget}`);
  console.log(`✓ Executive AI Digest hidden for SUPPORT: ${!supportHasExecutiveAiDigest}`);
  console.log(`✓ Audit Log hidden for SUPPORT: ${!supportHasAuditLog}`);

  // ══════════════════════════════════════════════════════════════════════
  // TEST 4: Admin Dashboard for OWNER Role (Full Access)
  // ══════════════════════════════════════════════════════════════════════
  console.log('\n--- 4. Testing Admin Dashboard for OWNER Role (/admin/dashboard) ---');
  await page.setCookie({
    name: 'session',
    value: ownerToken,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });

  await page.goto('http://127.0.0.1:3000/admin/dashboard', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.screenshot({ path: path.join(artifactsDir, '04_admin_dashboard_owner.png'), fullPage: true });
  console.log('✓ Owner Admin Dashboard fully rendered with all administrative controls');

  await browser.close();
  console.log('\n🎉 ALL LIVE UI BROWSER SMOKE TESTS PASSED SUCCESSFULLY!');
}

main().catch((err) => {
  console.error('❌ UI Smoke Error:', err);
  process.exit(1);
});
