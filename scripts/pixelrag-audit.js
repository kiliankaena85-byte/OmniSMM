/**
 * PixelRAG Audit Script v2 — Личный кабинет & Новый заказ
 * Использует тот же механизм аутентификации, что и основной QA-скрипт:
 * создаёт сессию в БД, генерирует JWT и добавляет session_token куку.
 *
 * Захватывает скриншоты в 3 viewport: mobile (375), tablet (768), desktop (1280)
 * Для каждой страницы: top (above-fold), mid (если страница длинная), full, bottom
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = 'C:/Users/Артём/.gemini/antigravity/brain/05da5888-d80c-4551-9edc-59620cba9876/pixelrag_audit';
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3001';

const VIEWPORTS = [
  { name: 'mobile',  width: 375,  height: 812,  isMobile: true,  dpr: 2 },
  { name: 'tablet',  width: 768,  height: 1024, isMobile: false, dpr: 1 },
  { name: 'desktop', width: 1280, height: 800,  isMobile: false, dpr: 1 },
];

const TARGET_PAGES = [
  {
    name: 'dashboard_home',
    path: '/dashboard',
    waitFor: 'main, [class*="card"], h2, .grid',
    scrollSections: true,
  },
  {
    name: 'new_order',
    path: '/dashboard/new-order',
    waitFor: 'form, select, input[type="text"], [class*="form"]',
    scrollSections: true,
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Auth helpers
// ───────────────────────────────────────────────────────────────────────────

async function setupTestUser() {
  const email = 'e2e-dashboard-tester@test.com';
  console.log(`👤 Настройка пользователя ${email}...`);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'USER', isActive: true, isDeleted: false, balance: 15000_00n },
    create: { email, role: 'USER', isActive: true, isDeleted: false, balance: 15000_00n },
  });

  return user;
}

async function createSession(userId) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent: 'pixelrag-audit-v2',
      ipAddress: '127.0.0.1',
    },
  });

  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new SignJWT({ sessionId: session.id, userId, role: 'USER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  return sessionToken;
}

function buildSessionCookie(sessionToken, domain = '127.0.0.1') {
  return {
    name: 'session_token',
    value: sessionToken,
    domain,
    path: '/',
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Screenshot helpers
// ───────────────────────────────────────────────────────────────────────────

async function captureViewportShots(page, prefix, vpWidth, vpHeight) {
  const shots = [];

  // Стабилизируем анимации
  await page.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });
  await page.waitForTimeout(600);

  // 1. Above-the-fold
  const topPath = path.join(OUTPUT_DIR, `${prefix}_top.png`);
  await page.screenshot({ path: topPath, clip: { x: 0, y: 0, width: vpWidth, height: vpHeight } });
  shots.push(topPath);
  console.log(`    📸 [above-fold] ${path.basename(topPath)}`);

  // 2. Full page
  const fullPath = path.join(OUTPUT_DIR, `${prefix}_full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  shots.push(fullPath);
  console.log(`    📸 [full-page]  ${path.basename(fullPath)}`);

  // 3. Mid-scroll (если страница длиннее 1.5× viewport)
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  if (pageHeight > vpHeight * 1.5) {
    await page.evaluate((h) => window.scrollTo({ top: h / 2, behavior: 'instant' }), pageHeight);
    await page.waitForTimeout(300);
    const midPath = path.join(OUTPUT_DIR, `${prefix}_mid.png`);
    await page.screenshot({ path: midPath, clip: { x: 0, y: 0, width: vpWidth, height: vpHeight } });
    shots.push(midPath);
    console.log(`    📸 [mid-scroll] ${path.basename(midPath)}`);
  }

  // 4. Bottom (sticky nav overlap check)
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(300);
  const btmPath = path.join(OUTPUT_DIR, `${prefix}_bottom.png`);
  await page.screenshot({ path: btmPath, clip: { x: 0, y: 0, width: vpWidth, height: vpHeight } });
  shots.push(btmPath);
  console.log(`    📸 [bottom]     ${path.basename(btmPath)}`);

  // Сброс прокрутки
  await page.evaluate(() => window.scrollTo(0, 0));

  return shots;
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('\n🎯 PixelRAG Audit v2 — Личный кабинет & Новый заказ');
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  const user = await setupTestUser();
  const sessionToken = await createSession(user.id);
  console.log(`✅ JWT сессия создана для ${user.email}\n`);

  const browser = await chromium.launch({ headless: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    user: user.email,
    baseUrl: BASE_URL,
    pages: [],
  };

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n📐 Viewport: ${vp.name} (${vp.width}×${vp.height})`);
      console.log('─'.repeat(60));

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
        isMobile: vp.isMobile,
        userAgent: vp.isMobile
          ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      });

      // Инъекция сессионной куки
      await context.addCookies([buildSessionCookie(sessionToken, '127.0.0.1')]);

      for (const target of TARGET_PAGES) {
        console.log(`\n  🔍 ${target.name} (${vp.name}) → ${BASE_URL}${target.path}`);

        const page = await context.newPage();
        const consoleErrors = [];
        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        try {
          await page.goto(`${BASE_URL}${target.path}`, {
            waitUntil: 'networkidle',
            timeout: 30_000,
          });

          // Проверка — не редиректнуло ли на /login
          const finalUrl = page.url();
          if (finalUrl.includes('/login')) {
            console.log(`  ⚠️  Редирект на /login — сессия не подхвачена! URL: ${finalUrl}`);
            const errPath = path.join(OUTPUT_DIR, `${target.name}_${vp.name}_AUTH_ERROR.png`);
            await page.screenshot({ path: errPath });
            console.log(`  📸 [auth-error] ${path.basename(errPath)}`);
          } else {
            // Ждём нужный контент
            await page.waitForSelector(target.waitFor, { timeout: 8_000 }).catch(() => null);
            await page.waitForTimeout(800);

            const prefix = `${target.name}_${vp.name}`;
            const shots = await captureViewportShots(page, prefix, vp.width, vp.height);

            manifest.pages.push({
              name: target.name,
              viewport: vp.name,
              url: finalUrl,
              screenshots: shots.map(s => path.basename(s)),
              consoleErrors: consoleErrors.slice(0, 5),
            });

            if (consoleErrors.length) {
              console.log(`  ⚠️  Console errors (${consoleErrors.length}): ${consoleErrors[0]}`);
            }
          }
        } catch (err) {
          console.error(`  ❌ Ошибка: ${err.message}`);
          const errPath = path.join(OUTPUT_DIR, `${target.name}_${vp.name}_CRASH.png`);
          await page.screenshot({ path: errPath }).catch(() => null);
        } finally {
          await page.close();
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const totalShots = manifest.pages.reduce((a, p) => a + p.screenshots.length, 0);
  console.log(`\n✅ Манифест: ${manifestPath}`);
  console.log(`✅ Скриншотов: ${totalShots}`);
  console.log('\n🎨 PixelRAG Audit v2 завершён!');
}

main().catch(console.error);
