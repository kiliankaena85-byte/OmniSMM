import { chromium, devices } from '@playwright/test';
import { SignJWT } from 'jose';
import path from 'path';
import { PrismaClient } from '@prisma/client';

import fs from 'fs';

const prisma = new PrismaClient();
const outDir = process.env.AUDIT_OUTPUT_DIR || path.join(process.cwd(), 'visual_audit_assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
  console.log('[1/5] Инициализация авторизации...');
  const secretKey = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(secretKey);
  const email = `e2e-tester@test.com`;

  // Создаем пользователя в БД
  const user = await prisma.user.upsert({
    where: { email_tenantId: { email, tenantId: 'smmplan' } },
    update: { balance: 200000_00, role: 'OWNER' },
    create: {
      email,
      balance: 200000_00,
      role: 'OWNER',
    }
  });

  // Создаем сессию
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  // Генерируем JWT токен
  const sessionToken = await new SignJWT({ sessionId: session.id, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  console.log('[2/5] Запуск Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });

  const pagesToCapture = [
    { name: 'new-order', path: '/dashboard/new-order' },
    { name: 'add-funds', path: '/dashboard/add-funds' },
    { name: 'tickets', path: '/dashboard/tickets' }
  ];

  for (const item of pagesToCapture) {
    console.log(`[3/5] Обработка страницы: ${item.name} (${item.path})`);

    // --- DESKTOP ---
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
    await desktopPage.goto(`http://localhost:3000${item.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await desktopPage.waitForTimeout(2000); // Ожидание анимаций

    const desktopImgPath = path.join(outDir, `${item.name}_desktop.png`);
    await desktopPage.screenshot({ path: desktopImgPath, fullPage: true });
    console.log(`  ✓ Сохранен десктопный скриншот: ${desktopImgPath}`);
    await desktopContext.close();

    // --- MOBILE ---
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
    await mobilePage.goto(`http://localhost:3000${item.path}`, { waitUntil: 'networkidle', timeout: 15000 });
    await mobilePage.waitForTimeout(2000);

    const mobileImgPath = path.join(outDir, `${item.name}_mobile.png`);
    await mobilePage.screenshot({ path: mobileImgPath, fullPage: true });
    console.log(`  ✓ Сохранен мобильный скриншот: ${mobileImgPath}`);
    await mobileContext.close();
  }

  await browser.close();
  console.log('[5/5] Захват скриншотов успешно завершен!');
}

main().catch(err => {
  console.error('Ошибка выполнения скрипта:', err);
  process.exit(1);
});
