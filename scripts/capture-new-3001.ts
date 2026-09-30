import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { SignJWT } from 'jose';

const BASE_URL = 'http://127.0.0.1:3001';
const JWT_SECRET = Buffer.from('ef4edc9fe34e3dea858e0a32308cbe956341934e0bcbd0f087af54501ffbc44e');

const BRAIN_DIR = 'C:/Users/Артем/.gemini/antigravity/brain/649413b5-d403-4baa-baa8-c7005bc1923b';
const LOCAL_DIR = path.resolve(process.cwd(), 'artifacts/screenshots');

async function generateAuthToken(): Promise<string> {
  return new SignJWT({
    sessionId: 'sess_flux_playwright_test_01',
    userId: 'cmumf87zb0001w6bs74tvohep',
    canResetPassword: false,
    role: 'USER',
    tenantId: 'flux',
    allowedTenants: ['flux'],
    contour: 'test',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

async function captureNew() {
  const token = await generateAuthToken();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await context.addCookies([
    { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
  ]);

  const page = await context.newPage();

  // 1. Storefront on 3001
  console.log('Capturing 3001 Storefront Header...');
  await page.goto(`${BASE_URL}/?tenant=flux`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.locator('header').first().screenshot({ path: path.join(LOCAL_DIR, 'flux-header-storefront-3001.png') });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-header-storefront-3001.png'),
    path.join(BRAIN_DIR, 'flux-header-storefront-3001.png')
  );

  // 2. Dashboard on 3001
  console.log('Capturing 3001 Dashboard Header...');
  await page.goto(`${BASE_URL}/dashboard?tenant=flux`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  await page.locator('header').first().screenshot({ path: path.join(LOCAL_DIR, 'flux-header-dashboard-3001.png') });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-header-dashboard-3001.png'),
    path.join(BRAIN_DIR, 'flux-header-dashboard-3001.png')
  );

  // 3. Full top section of Dashboard on 3001
  await page.screenshot({
    path: path.join(LOCAL_DIR, 'flux-top-dashboard-3001.png'),
    clip: { x: 0, y: 0, width: 1440, height: 350 }
  });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-top-dashboard-3001.png'),
    path.join(BRAIN_DIR, 'flux-top-dashboard-3001.png')
  );

  await context.close();
  await browser.close();
  console.log('3001 screenshots done!');
}

captureNew().catch(err => console.error(err.message));
