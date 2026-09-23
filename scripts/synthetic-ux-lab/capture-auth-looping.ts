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

  const iPhone = devices['iPhone 12'];

  // --- 1. AUTHENTICATED DESKTOP ---
  console.log('[3] Съемка тикета поддержки (Desktop)...');
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
  
  try {
    // Wait only for domcontentloaded to bypass infinite loop hang
    await authDesktopPage.goto(`http://localhost:3000/dashboard/tickets/${ticket.id}`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 10000 
    });
    console.log('Ждем рендеринга страницы...');
    await authDesktopPage.waitForTimeout(4000);
    await authDesktopPage.screenshot({ path: path.join(outDir, 'ticket_detail_desktop.png'), fullPage: true });
    console.log('Скриншот Desktop сохранен.');
  } catch (err) {
    console.error('Ошибка съемки Desktop:', err);
  } finally {
    await authDesktopContext.close();
  }

  // --- 2. AUTHENTICATED MOBILE ---
  console.log('[4] Съемка тикета поддержки (Mobile)...');
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
  
  try {
    await authMobilePage.goto(`http://localhost:3000/dashboard/tickets/${ticket.id}`, { 
      waitUntil: 'domcontentloaded', 
      timeout: 10000 
    });
    console.log('Ждем рендеринга страницы...');
    await authMobilePage.waitForTimeout(4000);
    await authMobilePage.screenshot({ path: path.join(outDir, 'ticket_detail_mobile.png'), fullPage: true });
    console.log('Скриншот Mobile сохранен.');
  } catch (err) {
    console.error('Ошибка съемки Mobile:', err);
  } finally {
    await authMobileContext.close();
  }

  await browser.close();
  console.log('Сценарий съемки зацикленных страниц завершен.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(err => {
    console.error('Ошибка:', err);
    prisma.$disconnect();
    process.exit(1);
  });
