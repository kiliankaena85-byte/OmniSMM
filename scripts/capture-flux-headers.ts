import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { SignJWT } from 'jose';

const BASE_URL = 'http://127.0.0.1:3000';
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

async function capture() {
  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

  const token = await generateAuthToken();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1. Desktop Context
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await desktopContext.addCookies([
    { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
  ]);

  const desktopPage = await desktopContext.newPage();

  // Storefront Desktop Header
  console.log('Capturing Desktop Storefront Header...');
  await desktopPage.goto(`${BASE_URL}/?tenant=flux`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);
  
  const storefrontHeader = desktopPage.locator('header').first();
  await storefrontHeader.screenshot({ path: path.join(LOCAL_DIR, 'flux-storefront-header-desktop.png') });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-storefront-header-desktop.png'),
    path.join(BRAIN_DIR, 'flux-storefront-header-desktop.png')
  );

  // Storefront Desktop Top Hero Section
  await desktopPage.screenshot({
    path: path.join(LOCAL_DIR, 'flux-storefront-full-top-desktop.png'),
    clip: { x: 0, y: 0, width: 1440, height: 450 }
  });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-storefront-full-top-desktop.png'),
    path.join(BRAIN_DIR, 'flux-storefront-full-top-desktop.png')
  );

  // Dashboard Desktop Header
  console.log('Capturing Desktop Dashboard Header...');
  await desktopPage.goto(`${BASE_URL}/dashboard?tenant=flux`, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  const dashboardHeader = desktopPage.locator('header').first();
  await dashboardHeader.screenshot({ path: path.join(LOCAL_DIR, 'flux-dashboard-header-desktop.png') });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-dashboard-header-desktop.png'),
    path.join(BRAIN_DIR, 'flux-dashboard-header-desktop.png')
  );

  // Dashboard Desktop Top Section
  await desktopPage.screenshot({
    path: path.join(LOCAL_DIR, 'flux-dashboard-full-top-desktop.png'),
    clip: { x: 0, y: 0, width: 1440, height: 450 }
  });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-dashboard-full-top-desktop.png'),
    path.join(BRAIN_DIR, 'flux-dashboard-full-top-desktop.png')
  );

  await desktopContext.close();

  // 2. Mobile Context (iPhone 390x844)
  console.log('Capturing Mobile Headers...');
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

  // Storefront Mobile Header
  await mobilePage.goto(`${BASE_URL}/?tenant=flux`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  const mobileStorefrontHeader = mobilePage.locator('header').first();
  await mobileStorefrontHeader.screenshot({ path: path.join(LOCAL_DIR, 'flux-storefront-header-mobile.png') });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-storefront-header-mobile.png'),
    path.join(BRAIN_DIR, 'flux-storefront-header-mobile.png')
  );

  // Dashboard Mobile Header
  await mobilePage.goto(`${BASE_URL}/dashboard?tenant=flux`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);
  const mobileDashboardHeader = mobilePage.locator('header').first();
  await mobileDashboardHeader.screenshot({ path: path.join(LOCAL_DIR, 'flux-dashboard-header-mobile.png') });
  fs.copyFileSync(
    path.join(LOCAL_DIR, 'flux-dashboard-header-mobile.png'),
    path.join(BRAIN_DIR, 'flux-dashboard-header-mobile.png')
  );

  await mobileContext.close();
  await browser.close();

  console.log('All screenshots captured successfully!');
}

capture().catch(err => console.error('Screenshot capture failed:', err));
