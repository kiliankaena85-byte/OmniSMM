import 'dotenv/config';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public&sslmode=disable';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://:SmmP1anR3dis2026Secure!@localhost:6379';
}

import { chromium, Page } from 'playwright';
import { db } from '../../src/lib/db';
import { redis } from '../../src/lib/redis';
import { hashPassword } from '../../src/lib/auth/password';
import { LayaClient, LayaDecisionPayload } from '../laya/laya-client';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:3000';
const AUDIT_EMAIL = 'admin-visual-audit@smmplan.pro';
const AUDIT_PASSWORD = 'TestAdminAudit2026!';
const ARTIFACT_DIR = path.resolve('C:/Users/Shadow/.gemini/antigravity/brain/0ec540ef-9417-4f08-bd3d-109de068e1aa');

interface TabAuditResult {
  tabId: string;
  tabLabel: string;
  url: string;
  fullScreenshot: string;
  viewportScreenshot: string;
  mobileScreenshot: string;
  horizontalOverflow: boolean;
  totalElements: number;
  interactiveInputsCount: number;
  smallTouchTargetsCount: number;
  jsErrors: string[];
  layaAnalysis: LayaDecisionPayload;
  layoutObservations: string[];
}

async function prepareAuditOwner() {
  const passwordHash = await hashPassword(AUDIT_PASSWORD);
  try {
    await redis.del(`auth:password:ip`, `password-attempts:${AUDIT_EMAIL}`, `auth:password:ip:burst:127.0.0.1`);
    const keys = await redis.keys(`*${AUDIT_EMAIL}*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    console.warn('Redis cleanup warning:', err);
  }

  await db.user.upsert({
    where: {
      email_tenantId: {
        email: AUDIT_EMAIL,
        tenantId: 'smmplan',
      },
    },
    update: {
      passwordHash,
      role: 'OWNER',
      allowedTenants: ['smmplan', 'flux'],
      isActive: true,
      isEmailVerified: true,
      twoFactorEnabled: false,
    },
    create: {
      email: AUDIT_EMAIL,
      passwordHash,
      role: 'OWNER',
      tenantId: 'smmplan',
      allowedTenants: ['smmplan', 'flux'],
      isActive: true,
      isEmailVerified: true,
      twoFactorEnabled: false,
    },
  });
}

async function runSettingsLayaAudit() {
  console.log('🚀 [Settings Laya Audit] Инициализация глубокого аудита вкладки «Настройки»...');
  await prepareAuditOwner();

  const layaClient = new LayaClient('http://127.0.0.1:8150');
  const isLayaHealthy = await layaClient.isHealthy();
  console.log(`📡 Laya Decision Engine статус: ${isLayaHealthy ? '🟢 ONLINE (Port 8150)' : '🟡 LOCAL FALLBACK'}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36 Settings-Audit-Bot',
  });

  const page = await desktopContext.newPage();
  const jsErrors: string[] = [];

  page.on('pageerror', (err) => {
    jsErrors.push(`[PAGE_ERROR] ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('mc.yandex.ru') && !text.includes('google-analytics') && !text.includes('favicon')) {
        jsErrors.push(`[CONSOLE_ERROR] ${text}`);
      }
    }
  });

  // Login
  console.log(`🔑 Авторизация через форму входа...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.fill('#login-email', AUDIT_EMAIL);
  await page.fill('#login-password', AUDIT_PASSWORD);
  await page.click('button[type="submit"]:has-text("Войти в кабинет")');
  await page.waitForFunction(() => window.location.pathname.startsWith('/admin'), { timeout: 20000 });
  await page.waitForTimeout(1500);

  const tabsToAudit = [
    { id: 'system', label: 'Бренд и Витрина', url: `${BASE_URL}/admin/settings?tab=system` },
    { id: 'catalog', label: 'Каталог и Цены', url: `${BASE_URL}/admin/settings?tab=catalog` },
    { id: 'integrations', label: 'Кассы и Шлюзы', url: `${BASE_URL}/admin/settings?tab=integrations` },
    { id: 'telegram', label: 'Telegram Бот', url: `${BASE_URL}/admin/settings?tab=telegram` },
    { id: 'proxy', label: 'Прокси провайдеров', url: `${BASE_URL}/admin/settings?tab=proxy` },
    { id: 'storefront', label: 'Ключи витрин (API)', url: `${BASE_URL}/admin/settings?tab=storefront` },
    { id: 'team', label: 'Команда и RBAC', url: `${BASE_URL}/admin/settings?tab=team` },
    { id: 'templates', label: 'Шаблоны ответов', url: `${BASE_URL}/admin/settings?tab=templates` },
    { id: 'audit', label: 'Журнал аудита', url: `${BASE_URL}/admin/settings?tab=audit` },
  ];

  const results: TabAuditResult[] = [];

  for (const tab of tabsToAudit) {
    jsErrors.length = 0;
    console.log(`\n🔍 [АУДИТ] Анализ вкладки: ${tab.label} (${tab.id}) -> ${tab.url}`);

    await page.goto(tab.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500); // React 19 hydration & live states

    // 1. Layout Metrics in Browser
    const domMetrics = await page.evaluate(() => {
      const body = document.body;
      const html = document.documentElement;
      const hasHorizontalScroll = html.scrollWidth > html.clientWidth || body.scrollWidth > window.innerWidth;

      const interactive = document.querySelectorAll('input, select, textarea, button, a[href]');
      let smallTargets = 0;
      interactive.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.width < 32 || rect.height < 32)) {
          smallTargets++;
        }
      });

      const totalElements = document.querySelectorAll('*').length;
      const inputsCount = document.querySelectorAll('input, select, textarea, button[role="switch"]').length;

      // Extract text content and key class patterns for Laya
      const outerHtml = document.querySelector('main') ? document.querySelector('main')!.innerHTML : document.body.innerHTML;
      const textSnippets = document.body.innerText.slice(0, 3000);

      return {
        hasHorizontalScroll,
        totalElements,
        inputsCount,
        smallTargets,
        htmlSample: outerHtml.slice(0, 8000),
        textSnippets,
      };
    });

    // 2. Screenshots (Viewport + FullPage)
    const viewportShot = `settings_audit_${tab.id}_viewport.png`;
    const fullShot = `settings_audit_${tab.id}_fullpage.png`;
    await page.screenshot({ path: path.join(ARTIFACT_DIR, viewportShot), fullPage: false });
    await page.screenshot({ path: path.join(ARTIFACT_DIR, fullShot), fullPage: true });

    // 3. Mobile Viewport Check (390x844 iPhone 14 / modern Android)
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    });
    // Copy cookies
    const cookies = await desktopContext.cookies();
    await mobileContext.addCookies(cookies);
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(tab.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await mobilePage.waitForTimeout(1000);
    const mobileShot = `settings_audit_${tab.id}_mobile.png`;
    await mobilePage.screenshot({ path: path.join(ARTIFACT_DIR, mobileShot), fullPage: false });
    await mobileContext.close();

    // 4. Laya Decision Model Analysis
    const layaPayload = await layaClient.decide(
      `Tab: ${tab.label} (${tab.id})\nText: ${domMetrics.textSnippets}\nHTML: ${domMetrics.htmlSample}`,
      `admin_settings_${tab.id}`
    );

    const layoutObservations: string[] = [];
    if (domMetrics.hasHorizontalScroll) {
      layoutObservations.push('⚠️ Обнаружен горизонтальный скролл на десктопе');
    } else {
      layoutObservations.push('✓ Горизонтальный скролл отсутствует (Zero-Scroll standard)');
    }

    if (domMetrics.smallTouchTargetsCount > 5) {
      layoutObservations.push(`⚠️ Найдено ${domMetrics.smallTouchTargetsCount} компактных интерактивных элементов (<32px)`);
    } else {
      layoutObservations.push('✓ Интерактивные элементы соответствуют эргономике кликов');
    }

    results.push({
      tabId: tab.id,
      tabLabel: tab.label,
      url: tab.url,
      viewportScreenshot: viewportShot,
      fullScreenshot: fullShot,
      mobileScreenshot: mobileShot,
      horizontalOverflow: domMetrics.hasHorizontalScroll,
      totalElements: domMetrics.totalElements,
      interactiveInputsCount: domMetrics.inputsCount,
      smallTouchTargetsCount: domMetrics.smallTouchTargetsCount,
      jsErrors: [...jsErrors],
      layaAnalysis: layaPayload,
      layoutObservations,
    });

    console.log(`   Плотность информации Laya: ${layaPayload.scores.informationDensity.toFixed(2)}`);
    console.log(`   Вердикт Laya: ${layaPayload.decision} (Confidence: ${layaPayload.confidence})`);
    console.log(`   Zero-Slop: ${layaPayload.gates.zeroSlopPass ? '100% PASS' : 'FAIL'}`);
    console.log(`   Контролов: ${domMetrics.inputsCount} | Элементов: ${domMetrics.totalElements}`);
  }

  await browser.close();

  // Save JSON summary
  const summaryPath = path.join(ARTIFACT_DIR, 'settings_laya_audit_summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n✅ [Settings Laya Audit] Аудит всех ${results.length} вкладок завершен. Отчет сохранен: ${summaryPath}`);
}

runSettingsLayaAudit().catch((err) => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
