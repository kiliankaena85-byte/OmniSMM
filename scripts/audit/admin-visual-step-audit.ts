import 'dotenv/config';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5435/smmplan_lite?schema=public&sslmode=disable';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://:SmmP1anR3dis2026Secure!@localhost:6379';
}

import { chromium } from 'playwright';
import { db } from '../../src/lib/db';
import { redis } from '../../src/lib/redis';
import { hashPassword } from '../../src/lib/auth/password';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.APP_URL || 'http://127.0.0.1:3000';
const AUDIT_EMAIL = 'admin-visual-audit@smmplan.pro';
const AUDIT_PASSWORD = 'TestAdminAudit2026!';
const TENANT_ID = 'smmplan';

interface StepResult {
  step: string;
  url: string;
  activeSidebarLabel: string;
  expectedSidebarLabel: string;
  sidebarStable: boolean;
  settingsVisibleCount: number;
  jsErrors: string[];
  screenshotPath: string;
  status: 'PASS' | 'FAIL';
}

async function prepareAuditOwner() {
  console.log(`\n🔧 [Audit Prep] Подготовка OWNER аккаунта ${AUDIT_EMAIL}...`);
  const passwordHash = await hashPassword(AUDIT_PASSWORD);

  // Очистка rate-limit в Redis
  try {
    await redis.del(
      `auth:password:ip`,
      `password-attempts:${AUDIT_EMAIL}`,
      `auth:password:ip:burst:127.0.0.1`
    );
    const keys = await redis.keys(`*${AUDIT_EMAIL}*`);
    if (keys.length > 0) await redis.del(...keys);
    console.log(`✓ Rate limits в Redis очищены`);
  } catch (err) {
    console.warn('Redis rate limit cleanup warning:', err);
  }

  let user = await db.user.findFirst({
    where: { email: AUDIT_EMAIL, tenantId: TENANT_ID },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        email: AUDIT_EMAIL,
        passwordHash,
        role: 'OWNER',
        tenantId: TENANT_ID,
        allowedTenants: ['smmplan', 'flux'],
        isActive: true,
        isEmailVerified: true,
        twoFactorEnabled: false,
      },
    });
    console.log(`✓ Создан тестовый OWNER: ${user.email} (id: ${user.id})`);
  } else {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        role: 'OWNER',
        allowedTenants: ['smmplan', 'flux'],
        isActive: true,
        isEmailVerified: true,
        twoFactorEnabled: false,
        isDeleted: false,
      },
    });
    console.log(`✓ Обновлен тестовый OWNER: ${user.email} (id: ${user.id})`);
  }

  return user;
}

async function runVisualAudit() {
  const artifactDir = path.resolve('C:/Users/Shadow/.gemini/antigravity/brain/0ec540ef-9417-4f08-bd3d-109de068e1aa');
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }

  await prepareAuditOwner();

  console.log(`🚀 Запуск Playwright Chromium для пошагового аудита...`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Visual-Audit-Agent'
  });

  const page = await context.newPage();
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

  // 1. Авторизация через реальную форму UI (/login)
  console.log(`\n🔑 [ШАГ 0] Вход в систему через ${BASE_URL}/login...`);
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#login-email', { timeout: 10000 });

  await page.fill('#login-email', AUDIT_EMAIL);
  await page.fill('#login-password', AUDIT_PASSWORD);

  const submitBtn = page.locator('button[type="submit"]:has-text("Войти в кабинет")');
  await submitBtn.click();

  // Ожидание перехода в админ-панель
  await page.waitForURL('**/admin/**', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(2000);
  console.log(`✓ Успешный вход в админ-панель! Текущий URL: ${page.url()}`);

  // Разворачиваем сайдбар, если он свернут
  try {
    const expandBtn = page.locator('button[aria-label="Развернуть меню"]');
    if (await expandBtn.isVisible({ timeout: 2000 })) {
      await expandBtn.click();
      await page.waitForTimeout(500);
      console.log(`✓ Боковая панель развернута для детального аудита`);
    }
  } catch {
    // Игнорируем, если уже развернута
  }

  const stepsToTest = [
    { name: '1_Dashboard', url: `${BASE_URL}/admin/dashboard`, expectedSidebar: 'Дашборд' },
    { name: '2_Orders_Main', url: `${BASE_URL}/admin/orders`, expectedSidebar: 'Заказы' },
    { name: '3_Orders_Sub_Refills', url: `${BASE_URL}/admin/refills`, expectedSidebar: 'Заказы' },
    { name: '4_Orders_Sub_Smart', url: `${BASE_URL}/admin/smart`, expectedSidebar: 'Заказы' },
    { name: '5_Catalog_Main', url: `${BASE_URL}/admin/catalog`, expectedSidebar: 'Каталог услуг' },
    { name: '6_Catalog_Sub_Categories', url: `${BASE_URL}/admin/catalog/categories`, expectedSidebar: 'Каталог услуг' },
    { name: '7_Finance_Main', url: `${BASE_URL}/admin/finance`, expectedSidebar: 'Финансы & Касса' },
    { name: '8_Finance_Sub_Transactions', url: `${BASE_URL}/admin/transactions`, expectedSidebar: 'Транзакции' },
    { name: '9_Settings_Main', url: `${BASE_URL}/admin/settings`, expectedSidebar: 'Настройки' },
    { name: '10_Settings_Tab_Telegram', url: `${BASE_URL}/admin/settings?tab=telegram`, expectedSidebar: 'Настройки' },
    { name: '11_Settings_Tab_Proxy', url: `${BASE_URL}/admin/settings?tab=proxy`, expectedSidebar: 'Настройки' },
    { name: '12_Settings_Sub_Roles', url: `${BASE_URL}/admin/settings/roles`, expectedSidebar: 'Настройки' },
    { name: '13_Settings_Sub_Tenants', url: `${BASE_URL}/admin/tenants`, expectedSidebar: 'Настройки' },
    { name: '14_Settings_Sub_Features', url: `${BASE_URL}/admin/system/features`, expectedSidebar: 'Настройки' }
  ];

  console.log(`\n🚀 Старт пошагового аудита ${stepsToTest.length} экранов админ-панели...`);
  const results: StepResult[] = [];

  for (const step of stepsToTest) {
    jsErrors.length = 0;
    console.log(`\n▶ [ШАГ] Проверка ${step.name}: ${step.url}`);

    await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1200); // Ожидание гидратации React 19

    // Проверяем, какой пункт подсвечен в боковой панели
    const activeSidebarItem = await page.evaluate(() => {
      const activeEl = document.querySelector('aside a[class*="bg-primary/10"], aside a[class*="text-primary"], aside a[data-active="true"]');
      if (activeEl) {
        return activeEl.getAttribute('aria-label') || activeEl.textContent?.trim().replace(/\s+/g, ' ') || 'Unknown Active';
      }
      return 'None';
    });

    // Проверяем видимость настроек / элементов управления на странице
    const settingsElementsCount = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea, button[role="switch"], [role="tab"], table, form');
      return inputs.length;
    });

    // Сохраняем скриншот прямо в brain dir
    const screenshotFilename = `visual_audit_${step.name}.png`;
    const screenshotPath = path.join(artifactDir, screenshotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    const isMatch = activeSidebarItem.includes(step.expectedSidebar) || 
                   (step.expectedSidebar === 'Настройки' && activeSidebarItem.includes('Настройки')) ||
                   (step.expectedSidebar === 'Заказы' && activeSidebarItem.includes('Заказы')) ||
                   (step.expectedSidebar === 'Каталог услуг' && activeSidebarItem.includes('Каталог'));

    const stepRes: StepResult = {
      step: step.name,
      url: step.url,
      activeSidebarLabel: activeSidebarItem,
      expectedSidebarLabel: step.expectedSidebar,
      sidebarStable: isMatch,
      settingsVisibleCount: settingsElementsCount,
      jsErrors: [...jsErrors],
      screenshotPath,
      status: isMatch && jsErrors.length === 0 ? 'PASS' : (jsErrors.length > 0 ? 'FAIL' : 'PASS')
    };

    results.push(stepRes);
    console.log(`   Подсвечен пункт меню: "${activeSidebarItem}" (Ожидался: "${step.expectedSidebar}")`);
    console.log(`   Сайдбар стабилен: ${isMatch ? '🟢 ДА (НЕ ПЕРЕКЛЮЧАЕТСЯ)' : '❌ ПЕРЕКЛЮЧИЛСЯ / СБРОСИЛСЯ'}`);
    console.log(`   Интерактивных элементов/настроек найдено: ${settingsElementsCount}`);
    console.log(`   Ошибок JS в консоли: ${jsErrors.length === 0 ? '0' : jsErrors.join('; ')}`);
    console.log(`   📸 Скриншот: ${screenshotFilename}`);
  }

  await browser.close();

  // Вывод итоговой сводки
  console.log('\n================================================================');
  console.log('🏁 ИТОГОВАЯ ТАБЛИЦА ВИЗУАЛЬНОГО АУДИТА АДМИН-ПАНЕЛИ');
  console.log('================================================================');

  let failedSteps = 0;
  for (const r of results) {
    const icon = r.status === 'PASS' && r.sidebarStable ? '🟢' : '🔴';
    if (icon === '🔴') failedSteps++;
    console.log(`${icon} [${r.step}] Активный сайдбар: "${r.activeSidebarLabel}" | Контролов/Настроек: ${r.settingsVisibleCount} | Ошибок: ${r.jsErrors.length}`);
  }

  console.log(`\nВсего шагов: ${results.length}, Успешно: ${results.length - failedSteps}, Неуспешно: ${failedSteps}`);
  if (failedSteps > 0) {
    process.exit(1);
  }
}

runVisualAudit().catch((err) => {
  console.error('Fatal error in runVisualAudit:', err);
  process.exit(1);
});
