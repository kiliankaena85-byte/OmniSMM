import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';

const prisma = new PrismaClient();
const OUTPUT_FILE = path.join(
  process.cwd(),
  '.gemini/antigravity/brain/94b4db79-7a02-4bc2-a8e3-43afbae751e5/real_treasury_screenshot.png'
);

let nextServerProcess: ChildProcess | null = null;

async function checkServer(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    s.setTimeout(1000);
    s.on('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.on('error', () => {
      resolve(false);
    });
    s.on('timeout', () => {
      s.destroy();
      resolve(false);
    });
    s.connect(port, '127.0.0.1');
  });
}

async function ensureServerRunning(): Promise<string> {
  const freePort = 3005;
  if (await checkServer(freePort)) {
    console.log(`✓ Обнаружен уже работающий dev сервер на порту ${freePort}`);
    return `http://localhost:${freePort}`;
  }

  console.log(`🚀 Запуск свежего Next.js dev сервера на порту ${freePort}...`);
  nextServerProcess = spawn('npx', ['next', 'dev', '-p', String(freePort)], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 60000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await checkServer(freePort)) {
      console.log(`✓ Next.js dev сервер успешно поднят на порту ${freePort}!`);
      // Даем еще 3 секунды на инициализацию Turbopack
      await new Promise((r) => setTimeout(r, 3000));
      return `http://localhost:${freePort}`;
    }
  }

  throw new Error('Не удалось дождаться запуска Next.js dev сервера за 60 секунд');
}

async function setupAdminUser() {
  const users = await prisma.$queryRaw<Array<{ id: string; email: string; role: string }>>`
    SELECT id, email, role FROM "User" WHERE role = 'OWNER' LIMIT 1
  `;

  if (users.length > 0) {
    console.log(`👤 Найден существующий OWNER пользователь ${users[0].email}...`);
    return users[0];
  }

  const anyUsers = await prisma.$queryRaw<Array<{ id: string; email: string; role: string }>>`
    SELECT id, email, role FROM "User" LIMIT 1
  `;
  if (anyUsers.length > 0) {
    await prisma.$executeRaw`UPDATE "User" SET role = 'OWNER' WHERE id = ${anyUsers[0].id}`;
    return { ...anyUsers[0], role: 'OWNER' };
  }

  throw new Error('No user found in database to authenticate');
}

async function createSessionToken(userId: string, userAgent = 'treasury-live-audit') {
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
  const sessionToken = await new SignJWT({
    sessionId: session.id,
    userId,
    role: 'OWNER',
    canResetPassword: false,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  return sessionToken;
}

async function main() {
  try {
    const baseUrl = await ensureServerRunning();
    const adminUser = await setupAdminUser();
    const token = await createSessionToken(adminUser.id);

    console.log('🌐 Запуск Chromium Playwright для снятия реального скриншота...');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      deviceScaleFactor: 1.5,
    });

    // Установка аутентификационных кук
    const domain = 'localhost';
    await context.addCookies([
      { name: 'session_token', value: token, domain, path: '/', httpOnly: true, secure: false },
      { name: 'x_admin_tenant', value: 'smmplan', domain, path: '/' },
    ]);

    const page = await context.newPage();
    const targetUrl = `${baseUrl}/admin/finance/treasury`;
    console.log(`📄 Переход на ${targetUrl}...`);

    await page.goto(targetUrl, { waitUntil: 'load', timeout: 60000 });

    // Ждем компиляции и загрузки контента
    await page.waitForSelector('h1, main, .max-w-7xl', { timeout: 45000 });
    await page.waitForTimeout(2000); // 2s стабилизация анимаций

    // Создаем директорию если не создана
    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Снимаем скриншот всей страницы
    await page.screenshot({ path: OUTPUT_FILE, fullPage: true });
    console.log(`📸 Реальный скриншот сохранен: ${OUTPUT_FILE}`);

    // Также сохраняем копию в C:\Users\Артём\.gemini\antigravity\brain\94b4db79-7a02-4bc2-a8e3-43afbae751e5\real_treasury_screenshot.png
    const winPath = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\94b4db79-7a02-4bc2-a8e3-43afbae751e5\\real_treasury_screenshot.png';
    fs.copyFileSync(OUTPUT_FILE, winPath);
    console.log(`📸 Копия сохранена: ${winPath}`);

    await browser.close();
  } catch (err) {
    console.error('❌ Ошибка снятия скриншота:', err);
  } finally {
    if (nextServerProcess) {
      nextServerProcess.kill();
    }
    await prisma.$disconnect();
  }
}

main();
