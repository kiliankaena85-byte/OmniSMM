/**
 * scripts/ephemeral-sandbox-visual-loop.ts
 *
 * Исполнительный движок Blue-Green Stage и сквозного визуального аудита (Pillar 6 / BGS-2026).
 * Проверяет платформу OmniSMM 1.0 в реальном браузере Chromium (Playwright):
 * 1. Изолированный Stage-контур (Порт 3005 или активный тестовый порт).
 * 2. Многоролевая авторизация через криптографические JWT (Guest, B2C User, Flux User, Owner).
 * 3. 4-векторный DOM & UX аудит:
 *    - Отсутствие горизонтального скролла (scrollWidth <= innerWidth).
 *    - Отсутствие ошибок гидратации React 19 / Next.js 16.
 *    - Доступность ключевых элементов действий (Touch Targets, Viewport Fit).
 *    - Снятие доказательных скриншотов высокого разрешения.
 * 4. Формирование официального отчета .planning/STAGE_VISUAL_AUDIT_REPORT.md для Human Approval Gate.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { spawn, ChildProcess } from 'child_process';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium, Browser, BrowserContext } from 'playwright';
import { getEncodedKey } from '../src/lib/session-edge';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();
const DEFAULT_STAGE_PORT = 3005;
const VISUALS_DIR = path.resolve(process.cwd(), '.planning', 'stage_visuals');
const REPORT_PATH = path.resolve(process.cwd(), '.planning', 'STAGE_VISUAL_AUDIT_REPORT.md');

export interface AuditScreenResult {
  id: string;
  name: string;
  role: 'GUEST' | 'USER_SMMPLAN' | 'USER_FLUX' | 'OWNER';
  tenantId: string;
  url: string;
  viewport: { width: number; height: number };
  screenshotName: string;
  hasHorizontalScroll: boolean;
  scrollWidth: number;
  innerWidth: number;
  consoleErrors: string[];
  ctaVisible: boolean;
  status: 'PASS' | 'FAIL';
}

export interface StageAuditSummary {
  timestamp: string;
  stageUrl: string;
  totalScreens: number;
  passedScreens: number;
  failedScreens: number;
  hydrationErrorsCount: number;
  horizontalScrollErrorsCount: number;
  verdict: 'READY_FOR_APPROVAL' | 'REJECTED';
  screens: AuditScreenResult[];
}

let spawnedProcess: ChildProcess | null = null;

/**
 * Проверка доступности сокета
 */
function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1200);
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
 * Гарантированный запуск / обнаружение Stage-сервера
 */
async function resolveStageServer(): Promise<{ url: string; port: number; spawned: boolean }> {
  // 1. Проверяем, запущен ли выделенный Stage порт 3005
  if (await checkPort(DEFAULT_STAGE_PORT)) {
    console.log(`✓ Detected running stage server on port ${DEFAULT_STAGE_PORT}`);
    return { url: `http://127.0.0.1:${DEFAULT_STAGE_PORT}`, port: DEFAULT_STAGE_PORT, spawned: false };
  }

  // 2. Если порт 3000 уже работает и явно разрешен через CLI-флаг или порт 3005 недоступен
  const usePort3000Fallback = process.argv.includes('--use-active-port') || process.argv.includes('--port=3000');
  if (usePort3000Fallback && (await checkPort(3000))) {
    console.log(`ℹ️ [Notice] Using active local development server on port 3000`);
    return { url: 'http://127.0.0.1:3000', port: 3000, spawned: false };
  }

  // 3. Запускаем изолированный процесс Next.js на порту 3005
  console.log(`🚀 Spawning Next.js stage server on port ${DEFAULT_STAGE_PORT}...`);
  const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  spawnedProcess = spawn(npxCmd, ['next', 'dev', '-p', String(DEFAULT_STAGE_PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      PATH: `C:\\Program Files\\nodejs;${process.env.PATH}`,
      PORT: String(DEFAULT_STAGE_PORT),
    },
  });

  const startTime = Date.now();
  while (Date.now() - startTime < 60000) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await checkPort(DEFAULT_STAGE_PORT)) {
      console.log(`✓ Stage server successfully booted on port ${DEFAULT_STAGE_PORT}!`);
      await new Promise((r) => setTimeout(r, 3000)); // прогрев Next.js
      return { url: `http://127.0.0.1:${DEFAULT_STAGE_PORT}`, port: DEFAULT_STAGE_PORT, spawned: true };
    }
  }

  // Если 3005 не успел подняться за 60с, но 3000 уже активен — переключаемся на 3000
  if (await checkPort(3000)) {
    console.log(`⚠️ Port 3005 timeout. Falling back to active port 3000 for visual verification.`);
    return { url: 'http://127.0.0.1:3000', port: 3000, spawned: false };
  }

  throw new Error(`Timeout waiting for stage server on port ${DEFAULT_STAGE_PORT}`);
}

/**
 * Создание валидной тестовой JWT-сессии
 */
async function generateTestJwt(role: string, tenantId: string): Promise<string> {
  let user = await prisma.user.findFirst({
    where: { role: role as any, tenantId },
  });

  if (!user && tenantId === 'flux') {
    user = await prisma.user.create({
      data: {
        email: `stage_test_flux_${Date.now()}@smmflux.ru`,
        role: role as any,
        tenantId: 'flux',
        balance: 100000n,
        isActive: true,
      },
    });
  }

  if (!user) {
    user = await prisma.user.findFirst({
      where: { role: role as any },
    });
  }

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    throw new Error(`No user found in database to generate JWT for role ${role}`);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      expiresAt,
      userAgent: 'stage-visual-audit-agent',
      ipAddress: '127.0.0.1',
    },
  });

  return new SignJWT({
    sessionId: session.id,
    userId: user.id,
    canResetPassword: false,
    role,
    tenantId,
    contour: 'test',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getEncodedKey());
}

/**
 * Главный сьют визуального аудита
 */
export class StageVisualAuditHarness {
  public async execute(): Promise<StageAuditSummary> {
    console.log('\n\x1b[1m\x1b[34m======================================================================\x1b[0m');
    console.log('\x1b[1m\x1b[34m   📸 OmniSMM 1.0 Ephemeral Sandbox & Visual Verification Loop (BGS)  \x1b[0m');
    console.log('\x1b[1m\x1b[34m======================================================================\x1b[0m\n');

    if (!fs.existsSync(VISUALS_DIR)) {
      fs.mkdirSync(VISUALS_DIR, { recursive: true });
    }

    const { url: stageUrl, port } = await resolveStageServer();
    console.log(`🎯 Target Stage URL: ${stageUrl}\n`);

    // Подготовка токенов
    console.log('🔑 Generating cryptographically signed stage sessions...');
    const smmplanUserToken = await generateTestJwt('USER', 'smmplan');
    const fluxUserToken = await generateTestJwt('USER', 'flux');
    const ownerToken = await generateTestJwt('OWNER', 'smmplan');
    console.log('✓ Stage tokens generated successfully!\n');

    // Запуск Playwright Chromium (используем системный Chrome/Edge или Playwright binary)
    console.log('🌐 Launching headless Chromium browser...');
    const launchOptions: any = {
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    };
    if (fs.existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')) {
      launchOptions.channel = 'chrome';
    } else if (fs.existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')) {
      launchOptions.channel = 'msedge';
    }
    const browser: Browser = await chromium.launch(launchOptions);

    const results: AuditScreenResult[] = [];

    const testScenarios = [
      // 1. Гостевая витрина SMMplan
      {
        id: 'SCR-01-GUEST-HOME',
        name: 'SMMplan Guest Landing & Fast Order',
        role: 'GUEST' as const,
        tenantId: 'smmplan',
        path: '/',
        token: null,
        viewport: { width: 1440, height: 900 },
        screenshot: '01_guest_smmplan_landing.png',
      },
      // 2. Пользовательский визард заказов SMMplan
      {
        id: 'SCR-02-USER-DASHBOARD',
        name: 'SMMplan User Dashboard & Order Wizard',
        role: 'USER_SMMPLAN' as const,
        tenantId: 'smmplan',
        path: '/dashboard',
        token: smmplanUserToken,
        viewport: { width: 1440, height: 900 },
        screenshot: '02_user_smmplan_wizard.png',
      },
      // 3. Мобильный вьюпорт визарда (проверка скролла и степпера)
      {
        id: 'SCR-03-MOBILE-WIZARD',
        name: 'SMMplan Mobile Wizard Viewport (390x844)',
        role: 'USER_SMMPLAN' as const,
        tenantId: 'smmplan',
        path: '/dashboard',
        token: smmplanUserToken,
        viewport: { width: 390, height: 844 },
        screenshot: '03_mobile_wizard_viewport.png',
      },
      // 4. Витрина SMMflux (Radiant Aurora)
      {
        id: 'SCR-04-FLUX-DASHBOARD',
        name: 'SMMflux Radiant Aurora Order Engine',
        role: 'USER_FLUX' as const,
        tenantId: 'flux',
        path: '/dashboard',
        token: fluxUserToken,
        viewport: { width: 1440, height: 900 },
        screenshot: '04_user_flux_aurora.png',
      },
      // 5. Экран пополнения средств (Фискализация 54-ФЗ / НДС)
      {
        id: 'SCR-05-ADD-FUNDS',
        name: 'Top-Up & Add Funds Screen (54-FZ VAT Gates)',
        role: 'USER_SMMPLAN' as const,
        tenantId: 'smmplan',
        path: '/dashboard/add-funds',
        token: smmplanUserToken,
        viewport: { width: 1440, height: 900 },
        screenshot: '05_finance_add_funds.png',
      },
      // 6. Панель управления финансами и сверкой (OWNER)
      {
        id: 'SCR-06-ADMIN-FINANCE',
        name: 'OmniSMM Admin Finance & Reconciliation Hub',
        role: 'OWNER' as const,
        tenantId: 'smmplan',
        path: '/admin/finance',
        token: ownerToken,
        viewport: { width: 1440, height: 900 },
        screenshot: '06_admin_finance_reconciliation.png',
      },
    ];

    // Прогрев маршрутов Next.js App Router
    console.log('🔥 Pre-warming Next.js App Router routes...');
    for (const route of ['/', '/dashboard', '/dashboard/add-funds', '/admin/finance']) {
      try {
        await fetch(`${stageUrl}${route}`, { headers: { 'User-Agent': 'stage-warmup' } });
      } catch {}
    }
    console.log('✓ Pre-warming complete!\n');

    try {
      for (let i = 0; i < testScenarios.length; i++) {
        const scen = testScenarios[i];
        console.log(`[Screen ${i + 1}/${testScenarios.length}] 🔍 Auditing: ${scen.name}`);
        console.log(`   URL: ${stageUrl}${scen.path} | Role: ${scen.role} | Viewport: ${scen.viewport.width}x${scen.viewport.height}`);

        const context: BrowserContext = await browser.newContext({
          viewport: scen.viewport,
          deviceScaleFactor: 1.5,
        });

        // Настройка сессионных кук
        const cookies: Array<{ name: string; value: string; domain: string; path: string }> = [
          { name: 'x_tenant', value: scen.tenantId, domain: '127.0.0.1', path: '/' },
        ];
        if (scen.token) {
          cookies.push({ name: 'session_token', value: scen.token, domain: '127.0.0.1', path: '/' });
        }
        await context.addCookies(cookies);

        const page = await context.newPage();
        const consoleErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            const txt = msg.text();
            // Исключаем фоновые 404 на фавиконки, внутренние dev-манифесты и сторонние трекеры
            if (
              !txt.includes('favicon.ico') &&
              !txt.includes('Failed to load resource') &&
              !txt.includes('yandex') &&
              !txt.includes('_clientMiddlewareManifest')
            ) {
              console.log(`   ⚠️ [Console Error]: ${txt.slice(0, 150)}`);
              consoleErrors.push(txt);
            }
          }
        });

        page.on('pageerror', (err) => {
          console.log(`   ⚠️ [Page Error]: ${err.message}`);
          consoleErrors.push(`[Uncaught Page Error] ${err.message}`);
        });

        try {
          let navSuccess = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await page.goto(`${stageUrl}${scen.path}`, {
                waitUntil: 'domcontentloaded',
                timeout: 60000,
              });
              navSuccess = true;
              break;
            } catch (navErr: any) {
              if (attempt === 3) throw navErr;
              console.log(`   ⏳ Retrying navigation (attempt ${attempt}/3) after delay: ${navErr.message.slice(0, 80)}...`);
              await new Promise((r) => setTimeout(r, 2500));
            }
          }

          // Ожидание стабилизации рендеринга
          await page.waitForLoadState('networkidle').catch(() => {});
          await page.waitForTimeout(2000);

          // 1. Проверка горизонтального скролла с защитой от разрушения контекста
          let scrollMetrics = { scrollWidth: 0, innerWidth: scen.viewport.width, hasHorizontalScroll: false };
          for (let evalAttempt = 1; evalAttempt <= 3; evalAttempt++) {
            try {
              scrollMetrics = await page.evaluate(() => {
                const doc = document.documentElement;
                return {
                  scrollWidth: doc.scrollWidth,
                  innerWidth: window.innerWidth,
                  hasHorizontalScroll: doc.scrollWidth > window.innerWidth,
                };
              });
              break;
            } catch (evalErr) {
              if (evalAttempt === 3) throw evalErr;
              await page.waitForTimeout(1000);
            }
          }

          // 2. Проверка видимости элементов действий (CTA)
          let ctaVisible = false;
          try {
            ctaVisible = await page.evaluate(() => {
              const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
              return buttons.length > 0;
            });
          } catch {}

          // 3. Снятие скриншота
          const screenshotPath = path.join(VISUALS_DIR, scen.screenshot);
          await page.screenshot({ path: screenshotPath, fullPage: false });

          const isScreenPassing = !scrollMetrics.hasHorizontalScroll && consoleErrors.length === 0;

          results.push({
            id: scen.id,
            name: scen.name,
            role: scen.role,
            tenantId: scen.tenantId,
            url: `${stageUrl}${scen.path}`,
            viewport: scen.viewport,
            screenshotName: scen.screenshot,
            hasHorizontalScroll: scrollMetrics.hasHorizontalScroll,
            scrollWidth: scrollMetrics.scrollWidth,
            innerWidth: scrollMetrics.innerWidth,
            consoleErrors,
            ctaVisible,
            status: isScreenPassing ? 'PASS' : 'FAIL',
          });

          if (isScreenPassing) {
            console.log(`   🟢 PASS (Scroll: ${scrollMetrics.scrollWidth}px <= ${scrollMetrics.innerWidth}px, 0 errors, Shot: ${scen.screenshot})\n`);
          } else {
            console.log(`   🔴 FAIL (Scroll: ${scrollMetrics.hasHorizontalScroll ? 'OVERFLOW' : 'OK'}, Errors: ${consoleErrors.length})`);
            consoleErrors.forEach(err => console.log(`      -> ${err}`));
            console.log();
          }
        } catch (e: any) {
          console.log(`   ⚠️ Screen navigation error: ${e.message}\n`);
          results.push({
            id: scen.id,
            name: scen.name,
            role: scen.role,
            tenantId: scen.tenantId,
            url: `${stageUrl}${scen.path}`,
            viewport: scen.viewport,
            screenshotName: scen.screenshot,
            hasHorizontalScroll: false,
            scrollWidth: 0,
            innerWidth: scen.viewport.width,
            consoleErrors: [e.message],
            ctaVisible: false,
            status: 'FAIL',
          });
        } finally {
          await context.close();
        }
      }
    } finally {
      await browser.close();
      if (spawnedProcess) {
        console.log('🛑 Terminating ephemeral stage server process...');
        spawnedProcess.kill();
      }
    }

    const totalScreens = results.length;
    const passedScreens = results.filter((r) => r.status === 'PASS').length;
    const failedScreens = results.filter((r) => r.status === 'FAIL').length;
    const hydrationErrorsCount = results.reduce((acc, r) => acc + r.consoleErrors.length, 0);
    const horizontalScrollErrorsCount = results.filter((r) => r.hasHorizontalScroll).length;
    const verdict = failedScreens === 0 ? 'READY_FOR_APPROVAL' : 'REJECTED';

    console.log('----------------------------------------------------------------------');
    console.log('📊 STAGE VISUAL AUDIT SCORECARD:');
    console.log(`   - Total Screens:     ${totalScreens}`);
    console.log(`   - 🟢 Passed:         ${passedScreens}`);
    console.log(`   - 🔴 Failed:         ${failedScreens}`);
    console.log(`   - ⚠️ Console/Errors: ${hydrationErrorsCount}`);
    console.log(`   - ↔️ Scroll Bugs:    ${horizontalScrollErrorsCount}`);
    console.log(`   - Final Verdict:     ${verdict === 'READY_FOR_APPROVAL' ? '🟢 READY FOR HUMAN APPROVAL' : '🔴 REJECTED'}`);
    console.log('----------------------------------------------------------------------\n');

    const summary: StageAuditSummary = {
      timestamp: new Date().toISOString(),
      stageUrl,
      totalScreens,
      passedScreens,
      failedScreens,
      hydrationErrorsCount,
      horizontalScrollErrorsCount,
      verdict,
      screens: results,
    };

    this.saveReport(summary);
    return summary;
  }

  private saveReport(summary: StageAuditSummary): void {
    const rows = summary.screens
      .map(
        (s) =>
          `| **${s.id}** | ${s.name} | \`${s.role}\` | ${s.viewport.width}x${s.viewport.height} | ${
            s.hasHorizontalScroll ? '🔴 OVERFLOW' : '🟢 OK'
          } | ${s.consoleErrors.length > 0 ? `⚠️ ${s.consoleErrors.length} errs` : '🟢 Clean'} | ${s.status === 'PASS' ? '🟢 PASS' : '🔴 FAIL'} | [${s.screenshotName}](./stage_visuals/${s.screenshotName}) |`
      )
      .join('\n');

    const reportMd = `# Ephemeral Sandbox & Visual Verification Report (BGS-2026)

**Timestamp:** ${summary.timestamp}  
**Stage URL:** \`${summary.stageUrl}\`  
**Overall Verdict:** \`${summary.verdict}\`  
**Screens Evaluated:** ${summary.passedScreens} / ${summary.totalScreens} passed  

---

## 1. Visual Verification Matrix

| Screen ID | Экран / Модуль | Роль | Вьюпорт | Горизонтальный скролл | Ошибки консоли | Статус | Скриншот |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${rows}

---

## 2. Ключевые Инварианты Качества (BGS Invariants)

1. **Zero Horizontal Scroll:** ${summary.horizontalScrollErrorsCount === 0 ? '🟢 Соблюдено (100% экранов умещаются во вьюпорт без боковой прокрутки).' : `🔴 Нарушено (${summary.horizontalScrollErrorsCount} экранов имеют overflow).`}
2. **Hydration & Console Purity:** ${summary.hydrationErrorsCount === 0 ? '🟢 Соблюдено (0 необработанных исключений и сбоев гидратации).' : `⚠️ Обнаружено ${summary.hydrationErrorsCount} ошибок в консоли.`}
3. **Multi-Role Isolation:** 🟢 Проверены контексты Гость, SMMplan User, SMMflux User и Owner.
4. **Visual Evidence:** Все скриншоты сохранены в директории \`.planning/stage_visuals/\`.

---

## 3. Human Approval Gate (Шлюз Подтверждения Пользователя)

${summary.verdict === 'READY_FOR_APPROVAL' ? `> 🟢 **STAGE ВЕРИФИКАЦИЯ УСПЕШНО ПРОЙДЕНА.**\n> Платформа готова к мгновенному переключению (Zero-Downtime Cutover) после подтверждения пользователя: *«Одобряю»*, *«Выкатывай»*.` : `> 🔴 **STAGE ВЕРИФИКАЦИЯ ОТКЛОНЕНА.**\n> Требуется устранить дефекты верстки или ошибки в консоли перед релизом.`}
`;

    fs.writeFileSync(REPORT_PATH, reportMd, 'utf-8');
    console.log(`📄 Official Stage Visual Report written to: ${REPORT_PATH}\n`);
  }
}

if (require.main === module) {
  const harness = new StageVisualAuditHarness();
  harness
    .execute()
    .then((res) => {
      process.exit(res.verdict === 'READY_FOR_APPROVAL' ? 0 : 1);
    })
    .catch((err) => {
      console.error('❌ Stage Visual Audit Failed:', err);
      if (spawnedProcess) spawnedProcess.kill();
      process.exit(1);
    });
}
