import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { SignJWT } from 'jose';

const BASE_URL = 'http://127.0.0.1:3005';
const JWT_SECRET = Buffer.from('ef4edc9fe34e3dea858e0a32308cbe956341934e0bcbd0f087af54501ffbc44e');

const BRAIN_DIR = 'C:/Users/Артем/.gemini/antigravity/brain/649413b5-d403-4baa-baa8-c7005bc1923b';
const LOCAL_DIR = path.resolve(process.cwd(), 'artifacts/screenshots-lovable');

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

async function capture() {
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

  const token = await generateAuthToken();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. Desktop Context (1440x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await desktopContext.addCookies([
    { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
  ]);

  const desktopPage = await desktopContext.newPage();

  // Storefront Desktop
  console.log('Capturing Lovable Storefront Desktop (3005)...');
  await desktopPage.goto(`${BASE_URL}/?tenant=flux`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({
    path: path.join(LOCAL_DIR, 'lovable-storefront-desktop.png'),
    clip: { x: 0, y: 0, width: 1440, height: 550 },
  });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'lovable-storefront-desktop.png'),
    path.join(BRAIN_DIR, 'lovable-storefront-desktop.png')
  );

  // Dashboard Desktop
  console.log('Capturing Lovable Dashboard Desktop (3005)...');
  await desktopPage.goto(`${BASE_URL}/dashboard?tenant=flux`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  await desktopPage.screenshot({
    path: path.join(LOCAL_DIR, 'lovable-dashboard-desktop.png'),
    clip: { x: 0, y: 0, width: 1440, height: 550 },
  });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'lovable-dashboard-desktop.png'),
    path.join(BRAIN_DIR, 'lovable-dashboard-desktop.png')
  );

  await desktopContext.close();

  // 2. Mobile Context (iPhone 390x844)
  console.log('Capturing Lovable Mobile (3005)...');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobileContext.addCookies([
    { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
  ]);

  const mobilePage = await mobileContext.newPage();

  // Storefront Mobile
  await mobilePage.goto(`${BASE_URL}/?tenant=flux`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({
    path: path.join(LOCAL_DIR, 'lovable-storefront-mobile.png'),
    clip: { x: 0, y: 0, width: 390, height: 550 },
  });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'lovable-storefront-mobile.png'),
    path.join(BRAIN_DIR, 'lovable-storefront-mobile.png')
  );

  // Dashboard Mobile
  await mobilePage.goto(`${BASE_URL}/dashboard?tenant=flux`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({
    path: path.join(LOCAL_DIR, 'lovable-dashboard-mobile.png'),
    clip: { x: 0, y: 0, width: 390, height: 550 },
  });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'lovable-dashboard-mobile.png'),
    path.join(BRAIN_DIR, 'lovable-dashboard-mobile.png')
  );

  await mobileContext.close();
  await browser.close();
  console.log('✅ Done! All Lovable screenshots captured and saved to brain.');
}

capture().catch(console.error);
