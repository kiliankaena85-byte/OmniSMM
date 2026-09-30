import 'dotenv/config';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public&sslmode=disable';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://:SmmP1anR3dis2026Secure!@localhost:6379';
}

import { chromium } from 'playwright';
import path from 'path';

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:3000';
const AUDIT_EMAIL = 'admin-visual-audit@smmplan.pro';
const AUDIT_PASSWORD = 'TestAdminAudit2026!';
const ARTIFACT_DIR = path.resolve('C:/Users/Shadow/.gemini/antigravity/brain/0ec540ef-9417-4f08-bd3d-109de068e1aa');

async function captureScrolledSettings() {
  console.log('🚀 Запуск захвата прокрученных секций настроек...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#login-email', AUDIT_EMAIL);
  await page.fill('#login-password', AUDIT_PASSWORD);
  await page.click('button[type="submit"]:has-text("Войти в кабинет")');
  await page.waitForFunction(() => window.location.pathname.startsWith('/admin'), { timeout: 20000 });
  await page.waitForTimeout(1000);

  // 1. System Tab Scrolled Down to General Settings
  await page.goto(`${BASE_URL}/admin/settings?tab=system`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);

  // Скроллим контейнер вниз
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTop = 550;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_scrolled_system_general.png') });

  // Скроллим еще ниже к 54-ФЗ и юр. данным
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTop = 1100;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_scrolled_system_legal_tax.png') });

  // 2. Telegram Tab Scrolled to Bot Config
  await page.goto(`${BASE_URL}/admin/settings?tab=telegram`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTop = 550;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_scrolled_telegram_bot.png') });

  // 3. Proxy Tab Scrolled to Table
  await page.goto(`${BASE_URL}/admin/settings?tab=proxy`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTop = 550;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_scrolled_proxy_manager.png') });

  // 4. Team Tab Scrolled to Staff & Roles
  await page.goto(`${BASE_URL}/admin/settings?tab=team`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTop = 550;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_scrolled_team_roles.png') });

  // 5. Storefront Keys Tab Scrolled
  await page.goto(`${BASE_URL}/admin/settings?tab=storefront`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTop = 550;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'settings_scrolled_storefront_keys.png') });

  await browser.close();
  console.log('✅ Скриншоты прокрученных секций сохранены.');
}

captureScrolledSettings().catch(console.error);
