import { chromium, devices } from '@playwright/test';
import { SignJWT } from 'jose';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const outDir = 'C:/Users/Артём/.gemini/antigravity/brain/73acab9d-bf20-4e61-8801-bab479069f83';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
  console.log('[1] Инициализация авторизации...');
  const secretKey = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(secretKey);
  const email = `e2e-tester@test.com`;

  const user = await prisma.user.upsert({
    where: { email_tenantId: { email, tenantId: 'smmplan' } },
    update: { balance: 200000_00, role: 'OWNER' },
    create: {
      email,
      balance: 200000_00,
      role: 'OWNER',
    }
  });

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

  console.log('[2] Запуск Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });

  // --- DESKTOP CONTEXT ---
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  await desktopContext.addCookies([
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

  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto('http://localhost:3000/dashboard/new-order', { waitUntil: 'networkidle', timeout: 15000 });
  await desktopPage.waitForTimeout(2000);
  
  // 1. Single Order Tab (Desktop)
  const singleOrderDesktopPath = path.join(outDir, 'new-order_single_desktop.png');
  await desktopPage.screenshot({ path: singleOrderDesktopPath, fullPage: true });
  console.log(`✓ Saved: ${singleOrderDesktopPath}`);

  // 2. Mass Order Tab (Desktop)
  const massOrderTabBtn = desktopPage.getByRole('button', { name: /Массовый заказ/i });
  if (await massOrderTabBtn.isVisible()) {
    await massOrderTabBtn.click();
    await desktopPage.waitForTimeout(1000);
    const massOrderDesktopPath = path.join(outDir, 'new-order_mass_desktop.png');
    await desktopPage.screenshot({ path: massOrderDesktopPath, fullPage: true });
    console.log(`✓ Saved: ${massOrderDesktopPath}`);
  } else {
    console.log('Could not find Mass Order tab button on desktop');
  }
  await desktopContext.close();

  // --- MOBILE CONTEXT ---
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
  await mobilePage.goto('http://localhost:3000/dashboard/new-order', { waitUntil: 'networkidle', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  
  // 3. Single Order Tab (Mobile)
  const singleOrderMobilePath = path.join(outDir, 'new-order_single_mobile.png');
  await mobilePage.screenshot({ path: singleOrderMobilePath, fullPage: true });
  console.log(`✓ Saved: ${singleOrderMobilePath}`);

  // 4. Mass Order Tab (Mobile)
  const massOrderTabBtnMobile = mobilePage.getByRole('button', { name: /Массовый заказ/i });
  if (await massOrderTabBtnMobile.isVisible()) {
    await massOrderTabBtnMobile.click();
    await mobilePage.waitForTimeout(1000);
    const massOrderMobilePath = path.join(outDir, 'new-order_mass_mobile.png');
    await mobilePage.screenshot({ path: massOrderMobilePath, fullPage: true });
    console.log(`✓ Saved: ${massOrderMobilePath}`);
  } else {
    console.log('Could not find Mass Order tab button on mobile');
  }
  await mobileContext.close();

  // --- LANDING PAGE DESKTOP ---
  const landingDesktopCtx = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 2,
  });
  const landingDesktopPage = await landingDesktopCtx.newPage();
  await landingDesktopPage.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
  await landingDesktopPage.waitForTimeout(2000);
  
  // 5. Landing Page Checkout Widget (Desktop)
  const landingDesktopPath = path.join(outDir, 'landing_checkout_desktop.png');
  await landingDesktopPage.screenshot({ path: landingDesktopPath, fullPage: true });
  console.log(`✓ Saved: ${landingDesktopPath}`);
  await landingDesktopCtx.close();

  // --- LANDING PAGE MOBILE ---
  const landingMobileCtx = await browser.newContext({
    ...iPhone,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const landingMobilePage = await landingMobileCtx.newPage();
  await landingMobilePage.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
  await landingMobilePage.waitForTimeout(2000);
  
  // 6. Landing Page Checkout Widget (Mobile)
  const landingMobilePath = path.join(outDir, 'landing_checkout_mobile.png');
  await landingMobilePage.screenshot({ path: landingMobilePath, fullPage: true });
  console.log(`✓ Saved: ${landingMobilePath}`);
  await landingMobileCtx.close();

  await browser.close();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error('Error running screenshots:', err);
  process.exit(1);
});
