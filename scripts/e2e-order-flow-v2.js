/**
 * e2e-order-flow-v2.js
 * Улучшенный E2E тест — взаимодействует с Radix Select дропдаунами,
 * ждёт загрузки услуг, выбирает конкретную категорию и услугу.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { chromium } from 'playwright';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = 'C:/Users/Артём/.gemini/antigravity/brain/05da5888-d80c-4551-9edc-59620cba9876/e2e_order_flow';
const BASE_URL = 'http://127.0.0.1:3001';

async function setupUser() {
  const email = 'e2e-dashboard-tester@test.com';
  const user = await prisma.user.upsert({
    where: { email },
    update: { balance: 500000_00n, isActive: true }, // 500,000 руб
    create: { email, role: 'USER', isActive: true, balance: 500000_00n },
  });
  return user;
}

async function createSession(userId) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { userId, expiresAt, userAgent: 'e2e-v2', ipAddress: '127.0.0.1' },
  });
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev-only-v2';
  const encodedKey = new TextEncoder().encode(jwtSecret);
  return new SignJWT({ sessionId: session.id, userId, role: 'USER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey);
}

async function shot(page, name, label) {
  const p = path.join(OUTPUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 [${label}]`);
  return p;
}
async function shotFull(page, name, label) {
  const p = path.join(OUTPUT_DIR, `${name}_full.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  📸 [${label} FULL]`);
}

// Вспомогательная функция для выбора в Radix Select
async function selectOption(page, triggerLabel, optionText) {
  // Ищем SelectTrigger рядом с label
  const triggers = page.locator('button[role="combobox"]');
  const count = await triggers.count();
  console.log(`  🔧 Radix SelectTriggers на странице: ${count}`);
  
  // Кликаем по триггеру который соответствует нашему label
  let clicked = false;
  for (let i = 0; i < count; i++) {
    const btn = triggers.nth(i);
    const text = await btn.textContent();
    console.log(`  🔧 Trigger[${i}]: "${text?.trim()}"`);
  }
  
  // Кликаем по нужному (по индексу: 0=ПЛАТФОРМА, 1=КАТЕГОРИЯ, 2=УСЛУГА)
  return triggers;
}

async function testTelegramFlow(page, prefix) {
  console.log('\n' + '─'.repeat(60));
  console.log('🔗 ПОЛНЫЙ ФЛОУ: Telegram Channel https://t.me/durov');
  console.log('─'.repeat(60));

  // ── Шаг 1: Открываем страницу нового заказа ──
  await page.goto(`${BASE_URL}/dashboard/new-order`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, `${prefix}_01_empty_form`, 'Шаг 1: Пустая форма');

  // ── Шаг 2: Вставляем ссылку ──
  const textarea = page.locator('textarea').first();
  await textarea.fill('https://t.me/durov');
  await page.waitForTimeout(500);
  await shot(page, `${prefix}_02_link_typed`, 'Шаг 2: Ссылка введена');

  // ── Шаг 3: Нажимаем "+ Добавить" ──
  const addBtn = page.locator('button').filter({ hasText: /Добавить/i }).last();
  await addBtn.click();
  console.log('  ✅ Нажали "+ Добавить"');

  // Ждём появления task-карточки
  await page.waitForSelector('text=ОЖИДАЕТ НАСТРОЙКИ', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2000);
  await shotFull(page, `${prefix}_03_task_appeared`, 'Шаг 3: Задача добавлена');

  // ── Шаг 4: Меняем категорию на "Подписчики Telegram" ──
  // Находим дропдаун КАТЕГОРИЯ (второй SelectTrigger)
  const selectTriggers = page.locator('button[role="combobox"]');
  const triggerCount = await selectTriggers.count();
  console.log(`  🔧 Найдено Select-триггеров: ${triggerCount}`);

  if (triggerCount >= 2) {
    const catTrigger = selectTriggers.nth(1); // КАТЕГОРИЯ — второй
    const catText = await catTrigger.textContent();
    console.log(`  📂 Текущая категория: "${catText?.trim()}"`);
    
    // Кликаем по дропдауну Категория
    await catTrigger.click();
    await page.waitForTimeout(800);
    await shot(page, `${prefix}_04_cat_dropdown_open`, 'Шаг 4: Категория дропдаун открыт');

    // Выбираем "Подписчики Telegram"
    const catOption = page.locator('[role="option"]').filter({ hasText: /Подписчики/i }).first();
    if (await catOption.count() > 0) {
      await catOption.click();
      console.log('  ✅ Выбрали категорию: Подписчики Telegram');
      await page.waitForTimeout(2000); // Ждём загрузки услуг
      await shot(page, `${prefix}_04b_cat_selected`, 'Шаг 4b: Категория выбрана');
    } else {
      // Пробуем кликнуть на любой вариант в списке
      const options = page.locator('[role="option"]');
      const optCount = await options.count();
      console.log(`  ℹ️  Вариантов в дропдауне: ${optCount}`);
      if (optCount > 0) {
        const firstOpt = await options.first().textContent();
        console.log(`  ℹ️  Первый вариант: "${firstOpt}"`);
        await options.first().click();
        await page.waitForTimeout(2000);
      } else {
        // Escape чтобы закрыть
        await page.keyboard.press('Escape');
      }
      await shot(page, `${prefix}_04b_cat_fallback`, 'Шаг 4b: Категория (fallback)');
    }
  }

  // ── Шаг 5: Ждём загрузки услуг и выбираем услугу ──
  await page.waitForTimeout(2000);
  
  // Проверяем наличие Loader2 (флажок isLoadingServices)
  const loader = page.locator('.animate-spin');
  if (await loader.count() > 0) {
    console.log('  ⏳ Идёт загрузка услуг...');
    await loader.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(500);
  }

  const updatedTriggers = page.locator('button[role="combobox"]');
  const updatedCount = await updatedTriggers.count();
  console.log(`  🔧 Триггеров после смены категории: ${updatedCount}`);
  
  if (updatedCount >= 3) {
    const svcTrigger = updatedTriggers.nth(2); // УСЛУГА — третий
    const svcText = await svcTrigger.textContent();
    console.log(`  🛒 Текущая услуга: "${svcText?.trim()}"`);
    
    await svcTrigger.click();
    await page.waitForTimeout(800);
    await shot(page, `${prefix}_05_svc_dropdown_open`, 'Шаг 5: Услуги дропдаун открыт');

    const svcOptions = page.locator('[role="option"]');
    const svcCount = await svcOptions.count();
    console.log(`  🛒 Доступно услуг: ${svcCount}`);
    
    for (let i = 0; i < Math.min(svcCount, 5); i++) {
      const optTxt = await svcOptions.nth(i).textContent();
      console.log(`  🛒   [${i}] ${optTxt?.trim()}`);
    }
    
    if (svcCount > 0) {
      // Выбираем первую услугу
      await svcOptions.first().click();
      console.log('  ✅ Выбрали услугу!');
      await page.waitForTimeout(1500);
      await shot(page, `${prefix}_05b_svc_selected`, 'Шаг 5b: Услуга выбрана');
    } else {
      console.log('  ⚠️  Нет услуг в дропдауне!');
      await page.keyboard.press('Escape');
      await shotFull(page, `${prefix}_05_WARN_no_services`, 'WARN: Нет услуг');
    }
  }

  // ── Шаг 6: Устанавливаем количество ──
  await page.waitForTimeout(500);
  const qtyInput = page.locator('input[type="number"]').first();
  if (await qtyInput.count() > 0) {
    await qtyInput.fill('500');
    await page.waitForTimeout(600);
    console.log('  ✅ Количество: 500');
    await shot(page, `${prefix}_06_qty_set`, 'Шаг 6: Количество 500');
  }

  // ── Шаг 7: Итоговая сумма ──
  await page.waitForTimeout(1000);
  await shotFull(page, `${prefix}_07_summary`, 'Шаг 7: Сводка заказа');
  
  const totalText = await page.locator('text=/\\d+\\.\\d+ ₽/').first().textContent().catch(() => 'не найдено');
  console.log(`  💰 Итоговая сумма: ${totalText}`);

  // ── Шаг 8: Нажимаем "Готово" (confirm task) ──
  const readyBtn = page.locator('button').filter({ hasText: /Готово/i }).first();
  if (await readyBtn.count() > 0) {
    const isDisabled = await readyBtn.getAttribute('disabled');
    console.log(`  🔘 Кнопка "Готово" disabled: ${isDisabled !== null}`);
    if (isDisabled === null) {
      await readyBtn.click();
      await page.waitForTimeout(1000);
      console.log('  ✅ Нажали "Готово"');
      await shot(page, `${prefix}_08_task_ready`, 'Шаг 8: Задача подтверждена');
    }
  }

  // ── Шаг 9: Выбираем способ оплаты и нажимаем Оплатить ──
  await page.waitForTimeout(500);
  
  // Ищем selector способа оплаты
  const paymentTriggers = page.locator('button[role="combobox"]');
  const payCount = await paymentTriggers.count();
  console.log(`  💳 Select-триггеров (оплата): ${payCount}`);
  
  // Ищем кнопку Оплатить
  const payBtn = page.locator('button').filter({ hasText: /Оплатить/i }).first();
  const payBtnCount = await payBtn.count();
  console.log(`  💳 Кнопок "Оплатить": ${payBtnCount}`);
  
  if (payBtnCount > 0) {
    const payBtnDisabled = await payBtn.getAttribute('disabled');
    console.log(`  💳 Кнопка "Оплатить" disabled: ${payBtnDisabled !== null}`);
    await shot(page, `${prefix}_09_before_pay`, 'Шаг 9: Перед оплатой');
    
    if (payBtnDisabled === null) {
      // Сначала выбираем оплату с баланса, если есть такой вариант
      const balanceOption = page.getByRole('button', { name: /баланс/i });
      if (await balanceOption.count() > 0) {
        await balanceOption.click();
        await page.waitForTimeout(300);
        console.log('  💳 Выбран способ: баланс');
      }
      
      await payBtn.click();
      console.log('  ✅ Нажали "Оплатить"!');
      await page.waitForTimeout(4000); // Ждём ответа сервера
      await shotFull(page, `${prefix}_10_after_payment`, 'Шаг 10: После оплаты');
      
      const currentUrl = page.url();
      console.log(`  🌐 URL после оплаты: ${currentUrl}`);
      
      // Проверяем уведомления
      const toasts = page.locator('[role="alert"], [data-sonner-toast], [data-radix-toast-viewport] *');
      const toastCount = await toasts.count();
      if (toastCount > 0) {
        const toastText = await toasts.first().textContent();
        console.log(`  🔔 Toast: ${toastText?.trim()}`);
      }
    } else {
      await shotFull(page, `${prefix}_09_pay_btn_disabled`, 'Шаг 9: Оплата заблокирована');
    }
  }

  // Финальный скриншот
  await page.waitForTimeout(1000);
  await shotFull(page, `${prefix}_FINAL`, 'ФИНАЛ');
  console.log('\n  ✅ Тест Telegram завершён!');
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('\n🧪 E2E Order Flow v2 — Полный флоу с Radix Select');
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  const user = await setupUser();
  const sessionToken = await createSession(user.id);
  console.log(`✅ Пользователь: ${user.email}`);
  console.log(`💰 Баланс установлен: 500,000.00 ₽`);

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  
  try {
    // Desktop 1280px
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    await ctx.addCookies([{
      name: 'session_token', value: sessionToken,
      domain: '127.0.0.1', path: '/', httpOnly: true, secure: false, sameSite: 'Lax'
    }]);
    const page = await ctx.newPage();

    // Лог консоли для отладки
    page.on('console', msg => {
      if (msg.type() === 'error') console.log(`  🖥️  JS ERROR: ${msg.text()}`);
    });

    await testTelegramFlow(page, 'tg_desktop');
    await ctx.close();

    // Mobile 375px
    console.log('\n📱 Mobile (375px) тест...');
    const mCtx = await browser.newContext({
      viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    await mCtx.addCookies([{
      name: 'session_token', value: sessionToken,
      domain: '127.0.0.1', path: '/', httpOnly: true, secure: false, sameSite: 'Lax'
    }]);
    const mPage = await mCtx.newPage();
    mPage.on('console', msg => { if (msg.type() === 'error') console.log(`  📱 JS ERROR: ${msg.text()}`); });
    await testTelegramFlow(mPage, 'tg_mobile');
    await mCtx.close();

  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ E2E v2 завершён! Скриншотов: ${files.length}`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
