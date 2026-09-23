import { chromium, devices } from '@playwright/test';
import { SignJWT } from 'jose';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();
const outDir = 'd:/SMM_plan_2/.agents/teamwork_preview_explorer_visual_ux_audit_3';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
  console.log('[1] Инициализация пользователя и тикета в БД...');
  const secretKey = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(secretKey);
  const email = `e2e-tester@test.com`;

  // Upsert user
  const user = await prisma.user.upsert({
    where: { email_tenantId: { email, tenantId: 'smmplan' } },
    update: { balance: 200000_00, role: 'OWNER' },
    create: {
      email,
      balance: 200000_00,
      role: 'OWNER',
    }
  });

  // Upsert session
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  // Find or create ticket
  let ticket = await prisma.ticket.findFirst({
    where: { userId: user.id, status: 'OPEN' }
  });

  if (!ticket) {
    ticket = await prisma.ticket.create({
      data: {
        userId: user.id,
        subject: 'Проблема с заказом подписчиков',
        status: 'OPEN',
        source: 'WEB',
        messages: {
          create: [
            {
              text: 'Здравствуйте! Я заказал 500 подписчиков на канал, но прошло уже 2 часа и ни один не добавился. Что делать?',
              sender: 'USER',
            },
            {
              text: 'Здравствуйте! Прошу прощения за задержку. Наша система сейчас проверяет статус вашего заказа. Обычно запуск происходит в течение 1-3 часов.',
              sender: 'STAFF',
            }
          ]
        }
      }
    });
  }

  const sessionToken = await new SignJWT({ sessionId: session.id, userId: user.id })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);

  console.log('[2] Запуск Playwright Chromium...');
  const browser = await chromium.launch({ headless: true });

  const logs: string[] = [];
  const logPageEvents = (page: any, contextName: string) => {
    page.on('console', (msg: any) => {
      const logMsg = `[BROWSER LOG][${contextName}] ${msg.type().toUpperCase()}: ${msg.text()}`;
      console.log(logMsg);
      logs.push(logMsg);
    });
    page.on('pageerror', (err: any) => {
      const errStr = `[BROWSER ERROR][${contextName}] ${err.name}: ${err.message}\nStack: ${err.stack}`;
      console.error(errStr);
      logs.push(errStr);
    });
  };

  // --- 1. GUEST DESKTOP CONTEXT ---
  console.log('[3] Съемка гостевых экранов (Desktop)...');
  const guestDesktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const guestDesktopPage = await guestDesktopContext.newPage();
  logPageEvents(guestDesktopPage, 'Guest-Desktop');

  // Go to /support
  await guestDesktopPage.goto('http://localhost:3000/support', { waitUntil: 'networkidle', timeout: 15000 });
  await guestDesktopPage.waitForTimeout(2000);
  await guestDesktopPage.screenshot({ path: path.join(outDir, 'support_desktop.png'), fullPage: true });

  // Go to /support/payment-error
  const paymentErrUrl = 'http://localhost:3000/support/payment-error?error=GATEWAY_REJECTED&gateway=yookassa&email=guest-tester@test.com&quantity=250&url=https://t.me/durov';
  await guestDesktopPage.goto(paymentErrUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await guestDesktopPage.waitForTimeout(2000);
  await guestDesktopPage.screenshot({ path: path.join(outDir, 'payment_error_desktop.png'), fullPage: true });
  await guestDesktopContext.close();

  // --- 2. GUEST MOBILE CONTEXT ---
  console.log('[4] Съемка гостевых экранов (Mobile)...');
  const iPhone = devices['iPhone 12'];
  const guestMobileContext = await browser.newContext({
    ...iPhone,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  const guestMobilePage = await guestMobileContext.newPage();
  logPageEvents(guestMobilePage, 'Guest-Mobile');

  // Go to /support
  await guestMobilePage.goto('http://localhost:3000/support', { waitUntil: 'networkidle', timeout: 15000 });
  await guestMobilePage.waitForTimeout(2000);
  await guestMobilePage.screenshot({ path: path.join(outDir, 'support_mobile.png'), fullPage: true });

  // Go to /support/payment-error
  await guestMobilePage.goto(paymentErrUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await guestMobilePage.waitForTimeout(2000);
  await guestMobilePage.screenshot({ path: path.join(outDir, 'payment_error_mobile.png'), fullPage: true });
  await guestMobileContext.close();

  // --- 3. AUTHENTICATED DESKTOP CONTEXT ---
  console.log('[5] Съемка тикета поддержки (Desktop)...');
  const authDesktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  await authDesktopContext.addCookies([
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
  const authDesktopPage = await authDesktopContext.newPage();
  logPageEvents(authDesktopPage, 'Auth-Desktop');

  await authDesktopPage.goto(`http://localhost:3000/dashboard/tickets/${ticket.id}`, { waitUntil: 'networkidle', timeout: 15000 });
  await authDesktopPage.waitForTimeout(2000);
  await authDesktopPage.screenshot({ path: path.join(outDir, 'ticket_detail_desktop.png'), fullPage: true });
  await authDesktopContext.close();

  // --- 4. AUTHENTICATED MOBILE CONTEXT ---
  console.log('[6] Съемка тикета поддержки (Mobile)...');
  const authMobileContext = await browser.newContext({
    ...iPhone,
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
  });
  await authMobileContext.addCookies([
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
  const authMobilePage = await authMobileContext.newPage();
  logPageEvents(authMobilePage, 'Auth-Mobile');

  await authMobilePage.goto(`http://localhost:3000/dashboard/tickets/${ticket.id}`, { waitUntil: 'networkidle', timeout: 15000 });
  await authMobilePage.waitForTimeout(2000);
  await authMobilePage.screenshot({ path: path.join(outDir, 'ticket_detail_mobile.png'), fullPage: true });
  await authMobileContext.close();

  await browser.close();
  console.log('[7] Запись логов браузера...');
  fs.writeFileSync(path.join(outDir, 'browser_logs.json'), JSON.stringify(logs, null, 2));

  console.log('Готово! Все скриншоты сохранены.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Ошибка в скрипте съемки скриншотов:', err);
    prisma.$disconnect();
    process.exit(1);
  });
