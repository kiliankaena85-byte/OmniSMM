import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const outDir = 'd:/SMM_plan_2/.agents/teamwork_preview_explorer_visual_ux_audit_3';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function main() {
  console.log('[1] Запуск Playwright для чистой съемки гостевых страниц...');
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

  // --- 1. GUEST PURE DESKTOP ---
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  // Set explicit_logout to bypass DEV_AUTO_LOGIN
  await desktopContext.addCookies([
    {
      name: 'explicit_logout',
      value: 'true',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    }
  ]);
  const desktopPage = await desktopContext.newPage();
  logPageEvents(desktopPage, 'Pure-Guest-Desktop');

  console.log('Навигация на /support (Desktop)...');
  await desktopPage.goto('http://localhost:3000/support', { waitUntil: 'networkidle', timeout: 15000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: path.join(outDir, 'support_desktop.png'), fullPage: true });

  console.log('Навигация на /support/payment-error (Desktop)...');
  const paymentErrUrl = 'http://localhost:3000/support/payment-error?error=GATEWAY_REJECTED&gateway=yookassa&email=guest-tester@test.com&quantity=250&url=https://t.me/durov';
  await desktopPage.goto(paymentErrUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await desktopPage.waitForTimeout(2000);
  await desktopPage.screenshot({ path: path.join(outDir, 'payment_error_desktop.png'), fullPage: true });
  await desktopContext.close();

  // --- 2. GUEST PURE MOBILE ---
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  });
  await mobileContext.addCookies([
    {
      name: 'explicit_logout',
      value: 'true',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    }
  ]);
  const mobilePage = await mobileContext.newPage();
  logPageEvents(mobilePage, 'Pure-Guest-Mobile');

  console.log('Навигация на /support (Mobile)...');
  await mobilePage.goto('http://localhost:3000/support', { waitUntil: 'networkidle', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: path.join(outDir, 'support_mobile.png'), fullPage: true });

  console.log('Навигация на /support/payment-error (Mobile)...');
  await mobilePage.goto(paymentErrUrl, { waitUntil: 'networkidle', timeout: 15000 });
  await mobilePage.waitForTimeout(2000);
  await mobilePage.screenshot({ path: path.join(outDir, 'payment_error_mobile.png'), fullPage: true });
  await mobileContext.close();

  await browser.close();
  console.log('Готово! Чистые гостевые скриншоты сохранены.');
}

main().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});
