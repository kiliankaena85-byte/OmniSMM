/**
 * scripts/qa-sentinel/runner.ts
 *
 * Главный оркестратор и CLI автономной QA-студии Omni-Sentinel QA.
 * Запуск: npx tsx scripts/qa-sentinel/runner.ts [--quick] [--url=http://127.0.0.1:3000]
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  ScreenScenario,
  ScreenCheckResult,
  QASentinelSummary,
  UserRole,
} from './types';
import {
  browserDomScanner,
  isBenignConsoleError,
  isHydrationError,
  calculateScreenStatus,
} from './dom-inspector';
import { createOrGetTestSession } from './session-factory';
import { printTerminalSummary, generateHtmlReport } from './report-generator';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const REPORT_DIR = path.resolve(process.cwd(), '.planning', 'qa_reports');
const SCREENSHOTS_DIR = path.join(REPORT_DIR, 'screenshots');

/**
 * Проверка доступности порта
 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Определение целевого URL сервера
 */
async function resolveTargetUrl(): Promise<string> {
  if (process.env.TARGET_URL) {
    return process.env.TARGET_URL.replace(/\/$/, '');
  }

  const urlArg = process.argv.find((a) => a.startsWith('--url='));
  if (urlArg) {
    return urlArg.split('=')[1].replace(/\/$/, '');
  }

  const portArg = process.argv.find((a) => a.startsWith('--port='));
  if (portArg) {
    const p = parseInt(portArg.split('=')[1], 10);
    return `http://127.0.0.1:${p}`;
  }

  // Проверяем 3000 (основной рабочий сервер / Docker)
  if (await checkPort(3000)) {
    return 'http://127.0.0.1:3000';
  }

  // Проверяем 3005 (Stage инстанс)
  if (await checkPort(3005)) {
    return 'http://127.0.0.1:3005';
  }

  // Fallback
  return 'http://127.0.0.1:3000';
}

/**
 * Матрица тестовых сценариев
 */
const SCENARIOS: ScreenScenario[] = [
  // 1. Гостевая витрина SMMplan (Desktop)
  {
    id: 'SCR-01-GUEST-DESKTOP',
    name: 'SMMplan Landing (Desktop)',
    role: 'GUEST',
    tenantId: 'smmplan',
    path: '/',
    viewport: { width: 1920, height: 1080, name: 'Full HD Desktop' },
    screenshotFileName: '01_guest_desktop_1920.png',
    isQuick: true,
  },
  // 2. Гостевая витрина SMMplan (Mobile iPhone)
  {
    id: 'SCR-02-GUEST-MOBILE',
    name: 'SMMplan Landing (Mobile 390px)',
    role: 'GUEST',
    tenantId: 'smmplan',
    path: '/',
    viewport: { width: 390, height: 844, name: 'Mobile iPhone' },
    screenshotFileName: '02_guest_mobile_390.png',
    isQuick: true,
  },
  // 3. Страница входа / авторизации
  {
    id: 'SCR-03-GUEST-LOGIN',
    name: 'Authentication Screen (/login)',
    role: 'GUEST',
    tenantId: 'smmplan',
    path: '/login',
    viewport: { width: 1440, height: 900, name: 'Desktop' },
    screenshotFileName: '03_auth_login.png',
    isQuick: false,
  },
  // 4. Дашборд B2C пользователя SMMplan (Desktop)
  {
    id: 'SCR-04-USER-DASHBOARD-DESKTOP',
    name: 'SMMplan User Order Wizard (Desktop)',
    role: 'USER_SMMPLAN',
    tenantId: 'smmplan',
    path: '/dashboard',
    viewport: { width: 1440, height: 900, name: 'Desktop' },
    screenshotFileName: '04_user_dashboard_desktop.png',
    isQuick: true,
  },
  // 5. Дашборд B2C пользователя SMMplan (Mobile)
  {
    id: 'SCR-05-USER-DASHBOARD-MOBILE',
    name: 'SMMplan Mobile Wizard Viewport (390px)',
    role: 'USER_SMMPLAN',
    tenantId: 'smmplan',
    path: '/dashboard',
    viewport: { width: 390, height: 844, name: 'Mobile iPhone' },
    screenshotFileName: '05_user_dashboard_mobile.png',
    isQuick: true,
  },
  // 6. Пополнение баланса (54-ФЗ / Фискализация)
  {
    id: 'SCR-06-USER-ADD-FUNDS',
    name: 'Payment Top-Up Gateways (/dashboard/add-funds)',
    role: 'USER_SMMPLAN',
    tenantId: 'smmplan',
    path: '/dashboard/add-funds',
    viewport: { width: 1440, height: 900, name: 'Desktop' },
    screenshotFileName: '06_user_add_funds.png',
    isQuick: false,
  },
  // 7. Витрина SMMflux (Radiant Aurora Engine)
  {
    id: 'SCR-07-FLUX-DASHBOARD',
    name: 'SMMflux Radiant Aurora Dashboard',
    role: 'USER_FLUX',
    tenantId: 'flux',
    path: '/dashboard',
    viewport: { width: 1440, height: 900, name: 'Desktop' },
    screenshotFileName: '07_flux_dashboard.png',
    isQuick: false,
  },
  // 8. Административный дашборд
  {
    id: 'SCR-08-ADMIN-DASHBOARD',
    name: 'OmniSMM Owner Operations Hub (/admin/dashboard)',
    role: 'OWNER',
    tenantId: 'smmplan',
    path: '/admin/dashboard',
    viewport: { width: 1920, height: 1080, name: 'Full HD Desktop' },
    screenshotFileName: '08_admin_dashboard.png',
    isQuick: true,
  },
  // 9. Финансовый центр и реестр транзакций (OWNER)
  {
    id: 'SCR-09-ADMIN-FINANCE',
    name: 'OmniSMM Finance & Ledger Hub (/admin/finance)',
    role: 'OWNER',
    tenantId: 'smmplan',
    path: '/admin/finance',
    viewport: { width: 1920, height: 1080, name: 'Full HD Desktop' },
    screenshotFileName: '09_admin_finance.png',
    isQuick: false,
  },
  // 10. Проверка плотности таблиц на ноутбуке (1366x768)
  {
    id: 'SCR-10-LAPTOP-TABLE-DENSITY',
    name: 'Laptop Orders Table Density (1366x768)',
    role: 'USER_SMMPLAN',
    tenantId: 'smmplan',
    path: '/dashboard/orders',
    viewport: { width: 1366, height: 768, name: 'Laptop Display' },
    screenshotFileName: '10_laptop_orders_table.png',
    isQuick: false,
  },
];

async function main() {
  const isQuick = process.argv.includes('--quick');
  const targetUrl = await resolveTargetUrl();
  const startTime = Date.now();

  console.log(`\n\x1b[1m\x1b[36m🛡️  Инициализация Omni-Sentinel QA Studio...\x1b[0m`);
  console.log(`🎯 Target URL: ${targetUrl} (Режим: ${isQuick ? '⚡ QUICK (Экспресс)' : '🔍 FULL (Полный аудит)'})`);

  // Подготовка каталогов
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // 1. Предварительная генерация тестовых JWT сессий
  console.log(`\n🔑 Генерация криптографических сессий для ролей...`);
  const sessions: Record<string, string | null> = {
    GUEST: null,
    USER_SMMPLAN: await createOrGetTestSession('USER_SMMPLAN', 'smmplan'),
    USER_FLUX: await createOrGetTestSession('USER_FLUX', 'flux'),
    SUPPORT: await createOrGetTestSession('SUPPORT', 'smmplan'),
    OWNER: await createOrGetTestSession('OWNER', 'smmplan'),
  };
  console.log(`✓ Сессии подготовлены!`);

  // 2. Запуск Playwright Chromium
  console.log(`🌐 Запуск браузерного движка Headless Chromium...`);
  const launchOptions: any = {
    headless: !process.argv.includes('--headless=false'),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  };

  // Попытка использовать системный Chrome или Edge
  if (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')) {
    launchOptions.channel = 'chrome';
  } else if (fs.existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')) {
    launchOptions.channel = 'msedge';
  }

  const browser: Browser = await chromium.launch(launchOptions);

  const activeScenarios = isQuick ? SCENARIOS.filter((s) => s.isQuick) : SCENARIOS;
  const screenResults: ScreenCheckResult[] = [];

  console.log(`\n🚀 Старт инспекции ${activeScenarios.length} экранов...\n`);

  try {
    for (let i = 0; i < activeScenarios.length; i++) {
      const scen = activeScenarios[i];
      const screenStartTime = Date.now();
      process.stdout.write(`[${i + 1}/${activeScenarios.length}] Проверка "${scen.name}"... `);

      const context: BrowserContext = await browser.newContext({
        viewport: { width: scen.viewport.width, height: scen.viewport.height },
        deviceScaleFactor: 1.25,
      });

      // Сессионные куки
      const token = sessions[scen.role];
      const cookies: any[] = [
        { name: 'x_tenant', value: scen.tenantId, url: targetUrl },
      ];
      if (token) {
        cookies.push({ name: 'session_token', value: token, url: targetUrl });
        if (targetUrl.startsWith('https:')) {
          cookies.push({ name: '__Host-session_token', value: token, url: targetUrl, secure: true });
        }
      }
      await context.addCookies(cookies);

      const page: Page = await context.newPage();
      const consoleErrors: string[] = [];
      const consoleWarnings: string[] = [];
      const failedNetworkRequests: Array<{ url: string; status: number; method: string }> = [];

      // Перехват логов консоли
      page.on('console', (msg) => {
        const txt = msg.text();
        if (msg.type() === 'error') {
          if (!isBenignConsoleError(txt)) {
            consoleErrors.push(txt);
          }
        } else if (msg.type() === 'warning') {
          if (!isBenignConsoleError(txt)) {
            consoleWarnings.push(txt);
          }
        }
      });

      page.on('pageerror', (err) => {
        const msg = err.message || '';
        if (!isBenignConsoleError(msg)) {
          consoleErrors.push(`[Uncaught Page Error] ${msg}`);
        }
      });

      // Перехват сетевых сбоев
      page.on('response', (res) => {
        const status = res.status();
        if (status >= 400) {
          const url = res.url();
          if (!isBenignConsoleError(url)) {
            failedNetworkRequests.push({
              url,
              status,
              method: res.request().method(),
            });
          }
        }
      });

      // Навигация
      const fullUrl = `${targetUrl}${scen.path}`;
      try {
        await page.goto(fullUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });

        // Даем короткое время на сетевую стабилизацию и рендеринг компонентов
        await page.waitForLoadState('networkidle').catch(() => {});
        await page.waitForTimeout(1000);
      } catch (navErr: any) {
        consoleErrors.push(`[Navigation Failed] ${navErr.message}`);
      }

      // Сканирование DOM и геометрии
      let domMetrics = {
        hasHorizontalScroll: false,
        scrollWidth: scen.viewport.width,
        innerWidth: scen.viewport.width,
        overflowPixels: 0,
        overflowElements: [],
        hydrationErrorDetected: false,
        smallTouchTargetsCount: 0,
      };

      try {
        domMetrics = await page.evaluate(browserDomScanner);
      } catch (evalErr: any) {
        // Контекст страницы мог перезагрузиться
      }

      // Детекция ошибки гидратации
      const hydrationErr = consoleErrors.find(isHydrationError);
      if (hydrationErr) {
        domMetrics.hydrationErrorDetected = true;
        (domMetrics as any).hydrationErrorMessage = hydrationErr;
      }

      // Снятие скриншота
      const screenshotRelative = `screenshots/${scen.screenshotFileName}`;
      const screenshotAbs = path.join(REPORT_DIR, screenshotRelative);
      try {
        await page.screenshot({ path: screenshotAbs, fullPage: false });
      } catch (ssErr: any) {
        // Ошибка скриншота не крашит аудит
      }

      const screenDuration = Date.now() - screenStartTime;
      const status = calculateScreenStatus(consoleErrors, failedNetworkRequests, domMetrics);

      if (status === 'PASS') {
        console.log(`\x1b[32mPASS\x1b[0m (${screenDuration}ms)`);
      } else if (status === 'WARN') {
        console.log(`\x1b[33mWARN\x1b[0m (${screenDuration}ms)`);
      } else {
        const reasons: string[] = [];
        if (consoleErrors.length > 0) reasons.push(`Console: ${consoleErrors.length}`);
        if (domMetrics.hasHorizontalScroll) reasons.push(`Scroll: +${domMetrics.overflowPixels}px`);
        if (domMetrics.hydrationErrorDetected) reasons.push(`Hydration error`);
        const net500 = failedNetworkRequests.filter((r) => r.status >= 500);
        if (net500.length > 0) reasons.push(`Net 5xx: ${net500.length}`);
        console.log(`\x1b[31mFAIL\x1b[0m (${screenDuration}ms) [${reasons.join(', ')}]`);
        if (consoleErrors.length > 0) {
          consoleErrors.slice(0, 2).forEach((e) => console.log(`     \x1b[31m↳ ${e.slice(0, 110)}\x1b[0m`));
        }
      }

      screenResults.push({
        id: scen.id,
        name: scen.name,
        role: scen.role,
        tenantId: scen.tenantId,
        path: scen.path,
        url: fullUrl,
        viewport: scen.viewport,
        screenshotPath: screenshotRelative,
        consoleErrors,
        consoleWarnings,
        failedNetworkRequests,
        domMetrics,
        durationMs: screenDuration,
        status,
      });

      await context.close();
    }
  } finally {
    await browser.close();
  }

  // Расчет сводной статистики
  const totalDuration = Date.now() - startTime;
  const passedScreens = screenResults.filter((s) => s.status === 'PASS').length;
  const warnScreens = screenResults.filter((s) => s.status === 'WARN').length;
  const failedScreens = screenResults.filter((s) => s.status === 'FAIL').length;
  const totalConsoleErrors = screenResults.reduce((acc, s) => acc + s.consoleErrors.length, 0);
  const totalFailedRequests = screenResults.reduce((acc, s) => acc + s.failedNetworkRequests.length, 0);
  const totalOverflowIssues = screenResults.filter((s) => s.domMetrics.hasHorizontalScroll).length;

  let verdict: 'EXCELLENT' | 'STABLE_WITH_WARNINGS' | 'CRITICAL_DEFECTS' = 'EXCELLENT';
  if (failedScreens > 0) {
    verdict = 'CRITICAL_DEFECTS';
  } else if (warnScreens > 0) {
    verdict = 'STABLE_WITH_WARNINGS';
  }

  const summary: QASentinelSummary = {
    timestamp: new Date().toLocaleString('ru-RU'),
    targetUrl,
    totalScreens: screenResults.length,
    passedScreens,
    warnScreens,
    failedScreens,
    totalConsoleErrors,
    totalFailedRequests,
    totalOverflowIssues,
    totalDurationMs: totalDuration,
    verdict,
    screens: screenResults,
  };

  // Вывод в терминал и сохранение HTML
  printTerminalSummary(summary);
  const htmlPath = generateHtmlReport(summary, REPORT_DIR);
  console.log(`📄 Интерактивный визуальный отчет сформирован: file:///${htmlPath.replace(/\\/g, '/')}\n`);

  if (verdict === 'CRITICAL_DEFECTS') {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n🚨 Непредвиденная ошибка Omni-Sentinel QA:', err);
  process.exit(1);
});
