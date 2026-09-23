import { chromium, devices } from '@playwright/test';
import { SignJWT } from 'jose';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const outDir = 'C:/Users/Артём/.gemini/antigravity/brain/0c658106-5570-47b2-9b3c-d6d91d5c44e0';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
  console.log('[1] Инициализация авторизации...');
  const secretKey = process.env.JWT_SECRET || 'smmplan_lite_jwt_secret_for_rbac';
  const encodedKey = new TextEncoder().encode(secretKey);
  const email = `admin@smmplan.ru`;

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'OWNER' },
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

  // Detect active local port
  let baseUrl = 'http://localhost:3000';
  for (const port of [3000, 3001]) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`http://localhost:${port}/`, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok || res.status < 500) {
        baseUrl = `http://localhost:${port}`;
        break;
      }
    } catch (e) {
      // ignore and try next
    }
  }
  console.log(`[2] Использование URL: ${baseUrl}`);

  console.log('[3] Запуск Playwright...');
  const browser = await chromium.launch({ headless: true });

  const tabs = ['system', 'integrations', 'team', 'cop', 'audit'];

  // Desktop captures
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

  for (const tab of tabs) {
    console.log(`[Desktop] Переход на вкладку "${tab}"...`);
    await desktopPage.goto(`${baseUrl}/admin/settings?tab=${tab}`, { waitUntil: 'networkidle', timeout: 30000 });
    await desktopPage.waitForTimeout(1000);

    if (tab === 'cop') {
      const simButton = desktopPage.locator('button:has-text("Запустить симуляцию")');
      if (await simButton.isVisible()) {
        console.log('[Desktop] Запуск симуляции трения...');
        await simButton.click();
        await desktopPage.waitForSelector('text=Результаты расчёта UX-метрик', { timeout: 10000 });
        await desktopPage.waitForTimeout(1000);
      }
    }

    // Set Light Theme
    console.log(`[Desktop] Переключение на Light Theme для "${tab}"...`);
    await desktopPage.evaluate(() => {
      localStorage.setItem('theme', 'telegram-light');
      document.documentElement.className = 'telegram-light';
    });
    await desktopPage.reload({ waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1000);
    if (tab === 'cop') {
      const simButton = desktopPage.locator('button:has-text("Запустить симуляцию")');
      if (await simButton.isVisible()) {
        await simButton.click();
        await desktopPage.waitForSelector('text=Результаты расчёта UX-метрик', { timeout: 10000 });
        await desktopPage.waitForTimeout(1000);
      }
    }
    await desktopPage.screenshot({ path: path.join(outDir, `admin_${tab}_light_desktop.png`), fullPage: true });

    // Set Dark Theme
    console.log(`[Desktop] Переключение на Dark Theme для "${tab}"...`);
    await desktopPage.evaluate(() => {
      localStorage.setItem('theme', 'telegram-dark');
      document.documentElement.className = 'telegram-dark';
    });
    await desktopPage.reload({ waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(1000);
    if (tab === 'cop') {
      const simButton = desktopPage.locator('button:has-text("Запустить симуляцию")');
      if (await simButton.isVisible()) {
        await simButton.click();
        await desktopPage.waitForSelector('text=Результаты расчёта UX-метрик', { timeout: 10000 });
        await desktopPage.waitForTimeout(1000);
      }
    }
    await desktopPage.screenshot({ path: path.join(outDir, `admin_${tab}_dark_desktop.png`), fullPage: true });
  }
  await desktopContext.close();

  // Mobile captures
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

  for (const tab of tabs) {
    console.log(`[Mobile] Переход на вкладку "${tab}"...`);
    await mobilePage.goto(`${baseUrl}/admin/settings?tab=${tab}`, { waitUntil: 'networkidle', timeout: 30000 });
    await mobilePage.waitForTimeout(1000);

    if (tab === 'cop') {
      const simButton = mobilePage.locator('button:has-text("Запустить симуляцию")');
      if (await simButton.isVisible()) {
        console.log('[Mobile] Запуск симуляции трения...');
        await simButton.click();
        await mobilePage.waitForSelector('text=Результаты расчёта UX-метрик', { timeout: 10000 });
        await mobilePage.waitForTimeout(1000);
      }
    }

    // Set Light Theme
    console.log(`[Mobile] Переключение на Light Theme для "${tab}"...`);
    await mobilePage.evaluate(() => {
      localStorage.setItem('theme', 'telegram-light');
      document.documentElement.className = 'telegram-light';
    });
    await mobilePage.reload({ waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);
    if (tab === 'cop') {
      const simButton = mobilePage.locator('button:has-text("Запустить симуляцию")');
      if (await simButton.isVisible()) {
        await simButton.click();
        await mobilePage.waitForSelector('text=Результаты расчёта UX-метрик', { timeout: 10000 });
        await mobilePage.waitForTimeout(1000);
      }
    }
    await mobilePage.screenshot({ path: path.join(outDir, `admin_${tab}_light_mobile.png`), fullPage: true });

    // Set Dark Theme
    console.log(`[Mobile] Переключение на Dark Theme для "${tab}"...`);
    await mobilePage.evaluate(() => {
      localStorage.setItem('theme', 'telegram-dark');
      document.documentElement.className = 'telegram-dark';
    });
    await mobilePage.reload({ waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(1000);
    if (tab === 'cop') {
      const simButton = mobilePage.locator('button:has-text("Запустить симуляцию")');
      if (await simButton.isVisible()) {
        await simButton.click();
        await mobilePage.waitForSelector('text=Результаты расчёта UX-метрик', { timeout: 10000 });
        await mobilePage.waitForTimeout(1000);
      }
    }
    await mobilePage.screenshot({ path: path.join(outDir, `admin_${tab}_dark_mobile.png`), fullPage: true });
  }
  await mobileContext.close();

  await browser.close();
  console.log('Все скриншоты панели администратора успешно сделаны!');
}

main().catch(err => {
  console.error('Ошибка создания скриншотов панели администратора:', err);
  process.exit(1);
});
