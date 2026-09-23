/**
 * PixelRAG Admin Audit Crawler v1.0
 * Автоматически проверяет / поднимает Next.js dev сервер, создаёт OWNER сессию
 * и захватывает скриншоты 15 разделов админ-панели в 3 viewports.
 *
 * Запуск: npx tsx scripts/pixelrag-admin-audit.ts
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';

const prisma = new PrismaClient();
const OUTPUT_DIR = path.join(process.cwd(), '.gemini/antigravity/brain/885ac1c3-7b31-4778-8759-606a07e457ae/admin_tiles');

const VIEWPORTS = [
  { name: 'mobile',  width: 375,  height: 812,  isMobile: true,  dpr: 2 },
  { name: 'tablet',  width: 768,  height: 1024, isMobile: false, dpr: 1 },
  { name: 'desktop', width: 1280, height: 800,  isMobile: false, dpr: 1 },
];

const TARGET_PAGES = [
  { name: 'dashboard', path: '/admin/dashboard', waitFor: 'main' },
  { name: 'orders', path: '/admin/orders', waitFor: 'main' },
  { name: 'refills', path: '/admin/refills', waitFor: 'main' },
  { name: 'tickets', path: '/admin/tickets', waitFor: 'main' },
  { name: 'clients', path: '/admin/clients', waitFor: 'main' },
  { name: 'finance', path: '/admin/finance', waitFor: 'main' },
  { name: 'marketing', path: '/admin/marketing', waitFor: 'main' },
  { name: 'catalog', path: '/admin/catalog', waitFor: 'main' },
  { name: 'quarantine', path: '/admin/catalog/quarantine', waitFor: 'main' },
  { name: 'smart', path: '/admin/smart', waitFor: 'main' },
  { name: 'providers', path: '/admin/providers', waitFor: 'main' },
  { name: 'pages', path: '/admin/pages', waitFor: 'main' },
  { name: 'knowledge', path: '/admin/knowledge', waitFor: 'main' },
  { name: 'settings', path: '/admin/settings', waitFor: 'main' },
  { name: 'features', path: '/admin/system/features', waitFor: 'main' },
];

let nextServerProcess: ChildProcess | null = null;

async function checkServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on('connect', () => { s.destroy(); resolve(true); });
    s.on('error', () => { resolve(false); });
    s.on('timeout', () => { s.destroy(); resolve(false); });
    s.connect(port, '127.0.0.1');
  });
}

async function ensureServerRunning(): Promise<string> {
  for (const p of [3000, 3001, 3002, 3003, 3005]) {
    if (await checkServer(p)) {
      console.log(`✓ Обнаружен работающий сервер на порту ${p}`);
      return `http://localhost:${p}`;
    }
  }

  const freePort = 3005;
  console.log(`🚀 Запуск Next.js dev сервера на порту ${freePort}...`);
  nextServerProcess = spawn('npx', ['next', 'dev', '-p', String(freePort)], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'ignore'
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 60000) {
    await new Promise(r => setTimeout(r, 2000));
    if (await checkServer(freePort)) {
      console.log(`✓ Next.js dev сервер успешно поднялся на порту ${freePort}!`);
      return `http://localhost:${freePort}`;
    }
  }

  throw new Error("Не удалось дождаться запуска Next.js dev сервера за 60 секунд");
}

async function setupAdminUser() {
  const email = 'pixelrag-admin@smmplan.test';
  console.log(`👤 Настройка OWNER пользователя ${email}...`);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: 'OWNER', isActive: true, isDeleted: false, balance: BigInt(50000000) },
    create: { email, role: 'OWNER', isActive: true, isDeleted: false, balance: BigInt(50000000) },
  });

  return user;
}

async function createSessionToken(userId: string, userAgent = 'pixelrag-admin-audit') {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId,
      expiresAt,
      userAgent,
      ipAddress: '127.0.0.1',
    },
  });

  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(jwtSecret);
  const sessionToken = await new SignJWT({ sessionId: session.id, userId, role: 'OWNER', canResetPassword: false })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  return sessionToken;
}

async function captureViewportShots(page: any, prefix: string, vpWidth: number, vpHeight: number) {
  const shots: string[] = [];

  // Стабилизация CSS анимаций и размытие токенов/паролей
  await page.addStyleTag({
    content: `
      *, *::before, *::after { transition: none !important; animation: none !important; }
      input[type="password"], [class*="secret"], [class*="key"] { filter: blur(6px) !important; }
    `,
  });
  await page.waitForTimeout(500);

  // 1. Above-the-fold (Top)
  const topPath = path.join(OUTPUT_DIR, `${prefix}_top.png`);
  await page.screenshot({ path: topPath, clip: { x: 0, y: 0, width: vpWidth, height: vpHeight } });
  shots.push(topPath);

  // 2. Full Page
  const fullPath = path.join(OUTPUT_DIR, `${prefix}_full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  shots.push(fullPath);

  return shots;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('\n🎯 PixelRAG Admin Audit Crawler v1.0');
  console.log(`📁 Output Directory: ${OUTPUT_DIR}\n`);

  const baseUrl = await ensureServerRunning();
  const user = await setupAdminUser();
  console.log(`✅ Пользователь OWNER проверен: ${user.email}\n`);

  const browser = await chromium.launch({ headless: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    user: user.email,
    baseUrl,
    pages: [] as any[],
  };

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n📐 Viewport: ${vp.name} (${vp.width}×${vp.height})`);
      console.log('─'.repeat(60));

      const ua = vp.isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';

      const sessionToken = await createSessionToken(user.id, ua);

      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.dpr,
        isMobile: vp.isMobile,
        userAgent: ua,
      });

      await context.addCookies([
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

      // Прогревочный запрос на дашборд
      const warmupPage = await context.newPage();
      await warmupPage.goto(`${baseUrl}/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => null);
      await warmupPage.close();

      for (const target of TARGET_PAGES) {
        console.log(`  🔍 [${vp.name}] /admin/${target.name}...`);
        const page = await context.newPage();
        const consoleErrors: string[] = [];

        page.on('console', msg => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        try {
          await page.goto(`${baseUrl}${target.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 45000,
          });

          const finalUrl = page.url();
          if (finalUrl.includes('/login')) {
            console.log(`  ⚠️ Ошибка авторизации (Редирект на /login): ${finalUrl}`);
            const errPath = path.join(OUTPUT_DIR, `${target.name}_${vp.name}_AUTH_ERROR.png`);
            await page.screenshot({ path: errPath });
          } else {
            await page.waitForSelector(target.waitFor, { timeout: 3000 }).catch(() => null);
            await page.waitForTimeout(1500);

            const prefix = `${target.name}_${vp.name}`;
            const shots = await captureViewportShots(page, prefix, vp.width, vp.height);

            manifest.pages.push({
              name: target.name,
              viewport: vp.name,
              url: finalUrl,
              screenshots: shots.map(s => path.basename(s)),
              consoleErrors: consoleErrors.slice(0, 5),
            });
          }
        } catch (err: any) {
          console.error(`  ❌ Ошибка захвата ${target.name}: ${err.message}`);
        } finally {
          await page.close();
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      await context.close();
    }
  } finally {
    await browser.close();
    await prisma.$disconnect();
    if (nextServerProcess) {
      console.log("\n🛑 Остановка дочернего Next.js dev сервера...");
      nextServerProcess.kill('SIGTERM');
    }
  }

  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const totalShots = manifest.pages.reduce((a, p) => a + p.screenshots.length, 0);
  console.log(`\n✅ Манифест успешно записан: ${manifestPath}`);
  console.log(`✅ Создано скриншотов: ${totalShots}`);
  console.log('\n🎨 PixelRAG Admin Audit Crawler завершён!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
