/**
 * e2e-order-flow.js
 * Полный E2E тест флоу создания заказа:
 *   1. Вставка тестовой ссылки (Telegram канал / YouTube видео / Instagram пост)
 *   2. Распознавание платформы и загрузка услуг
 *   3. Выбор услуги и ввод количества
 *   4. Проверка итоговой суммы
 *   5. Оформление заказа (checkout через баланс)
 *   6. Скриншоты каждого шага
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

// Тестовые ссылки для разных платформ
const TEST_LINKS = [
  {
    label: 'Telegram Channel',
    url: 'https://t.me/durov',
    expectedPlatform: 'Telegram',
    type: 'channel',
  },
  {
    label: 'YouTube Video',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    expectedPlatform: 'YouTube',
    type: 'video',
  },
  {
    label: 'Instagram Post',
    url: 'https://www.instagram.com/p/CxamplePostId123/',
    expectedPlatform: 'Instagram',
    type: 'post',
  },
];

async function setupUser() {
  const email = 'e2e-dashboard-tester@test.com';
  const user = await prisma.user.upsert({
    where: { email },
    update: { balance: 100000_00n, isActive: true }, // 100,000 руб для тестов
    create: { email, role: 'USER', isActive: true, balance: 100000_00n },
  });
  return user;
}

async function createSession(userId) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await prisma.session.create({
    data: { userId, expiresAt, userAgent: 'e2e-order-flow', ipAddress: '127.0.0.1' },
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
  await page.screenshot({ path: p, fullPage: false }); // viewport screenshot для наглядности
  console.log(`  📸 [${label}] → ${path.basename(p)}`);
  return p;
}

async function shotFull(page, name, label) {
  const p = path.join(OUTPUT_DIR, `${name}_full.png`);
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  📸 [${label} FULL] → ${path.basename(p)}`);
  return p;
}

async function testOrderFlow(page, testLink, index) {
  const prefix = `step${index}_${testLink.label.replace(/\s+/g, '_').toLowerCase()}`;
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔗 Тест ${index}: ${testLink.label}`);
  console.log(`   URL: ${testLink.url}`);
  console.log('─'.repeat(60));

  // ── Шаг 1: Перейти на страницу нового заказа ──
  await page.goto(`${BASE_URL}/dashboard/new-order`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(800);
  await shot(page, `${prefix}_01_empty_form`, 'Шаг 1: Пустая форма');

  // ── Шаг 2: Вставить ссылку ──
  // Форма может использовать textarea или div[contenteditable]
  const textarea = page.locator('textarea, div[contenteditable="true"]').first();
  const textareaCount = await textarea.count();
  console.log(`  🔍 Найдено textarea/contenteditable: ${textareaCount}`);
  
  if (!textareaCount) {
    // Попробуем найти любой input для ссылки
    const allInputs = await page.locator('input, textarea').count();
    console.log(`  🔍 Всего input элементов: ${allInputs}`);
    // Делаем скриншот что видим
    await shot(page, `${prefix}_02_DEBUG_no_textarea`, 'DEBUG: нет textarea');
    // Пробуем кликнуть в центр предполагаемой области
    const linkArea = page.locator('[class*="link"], [class*="url"], [class*="input"]').first();
    if (await linkArea.count()) {
      await linkArea.click();
      await page.keyboard.type(testLink.url);
    } else {
      console.log('  ❌ Не нашли поле ввода, пропускаем');
      return;
    }
  } else {
    await textarea.fill(testLink.url);
  }
  await page.waitForTimeout(300);
  await shot(page, `${prefix}_02_link_entered`, 'Шаг 2: Ссылка введена');

  // ── Шаг 3: Нажать кнопку "Добавить" ──
  const addBtn = page.getByRole('button', { name: /Добавить|добавить/i });
  if (await addBtn.count() === 0) {
    console.log('  ⚠️  Кнопка "Добавить" не найдена');
    await shot(page, `${prefix}_ERROR_no_add_btn`, 'ОШИБКА');
    return;
  }
  await addBtn.click();
  console.log('  ✅ Нажата кнопка "Добавить"');

  // Ждём парсинга ссылки и загрузки услуг
  await page.waitForTimeout(2000);

  // Ищем индикатор загрузки и ждём его исчезновения
  const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], [aria-busy="true"]');
  if (await loadingIndicator.count() > 0) {
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => null);
  }
  await page.waitForTimeout(1500);
  await shotFull(page, `${prefix}_03_after_add`, 'Шаг 3: После добавления ссылки');

  // ── Шаг 4: Проверяем что услуги появились ──
  // Ищем карточки услуг или селектор
  const serviceCards = page.locator('[class*="service"], [data-testid*="service"], .card').filter({ hasText: /₽|руб/i });
  const serviceCount = await serviceCards.count();
  console.log(`  📊 Найдено карточек услуг: ${serviceCount}`);

  if (serviceCount === 0) {
    // Пробуем альтернативный поиск — кнопки выбора
    const buttons = page.getByRole('button').filter({ hasText: /Эконом|Стандарт|Премиум/i });
    const btnCount = await buttons.count();
    console.log(`  📊 Кнопок тарифов: ${btnCount}`);

    if (btnCount === 0) {
      // Снимаем страницу ошибки
      await shot(page, `${prefix}_04_no_services_found`, 'Шаг 4: Услуги не найдены');
      // Получаем текст ошибки
      const errorText = await page.locator('[class*="error"], [class*="alert"]').first().textContent().catch(() => 'нет текста');
      console.log(`  ⚠️  Сообщение: ${errorText}`);
    } else {
      // Кликаем первую кнопку тарифа
      await buttons.first().click();
      await page.waitForTimeout(500);
      await shot(page, `${prefix}_04_service_selected`, 'Шаг 4: Тариф выбран');
    }
  } else {
    // Кликаем первую карточку
    await serviceCards.first().click();
    await page.waitForTimeout(500);
    await shot(page, `${prefix}_04_service_selected`, 'Шаг 4: Услуга выбрана');
  }

  // ── Шаг 5: Ввести количество ──
  await page.waitForTimeout(500);
  const qtyInput = page.locator('input[type="number"], input[name*="qty"], input[name*="quantity"], input[placeholder*="кол"]').first();
  if (await qtyInput.count() > 0) {
    await qtyInput.fill('1000');
    await page.waitForTimeout(800);
    console.log('  ✅ Введено количество: 1000');
    await shot(page, `${prefix}_05_qty_entered`, 'Шаг 5: Количество введено');
  } else {
    console.log('  ⚠️  Поле количества не найдено (возможно, не выбрана услуга)');
    await shot(page, `${prefix}_05_no_qty_field`, 'Шаг 5: Нет поля количества');
  }

  // ── Шаг 6: Итоговая сумма ──
  await page.waitForTimeout(1000);
  const priceEl = page.locator('[class*="total"], [class*="price"], [class*="amount"]').filter({ hasText: /₽|руб/i });
  if (await priceEl.count() > 0) {
    const priceText = await priceEl.first().textContent();
    console.log(`  💰 Итоговая сумма: ${priceText?.trim()}`);
  }
  await shotFull(page, `${prefix}_06_with_price`, 'Шаг 6: С ценой');

  // ── Шаг 7: Попытка оформить заказ ──
  const checkoutBtn = page.getByRole('button', { name: /Оформить|Заказать|Купить|Оплатить/i });
  const checkoutCount = await checkoutBtn.count();
  console.log(`  🔘 Кнопок оформления: ${checkoutCount}`);

  if (checkoutCount > 0) {
    await checkoutBtn.first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot(page, `${prefix}_07_before_checkout`, 'Шаг 7: Перед оформлением');
    
    await checkoutBtn.first().click();
    console.log('  ✅ Нажата кнопка оформления');
    await page.waitForTimeout(3000); // Ждём ответа сервера
    
    // Проверяем результат
    const successMsg = page.locator('[class*="success"], [class*="toast"]').filter({ hasText: /успешно|заказ|создан/i });
    const errorMsg = page.locator('[class*="error"], [class*="alert"], [class*="toast"]').filter({ hasText: /ошибка|недостаточно|неверн/i });
    
    if (await successMsg.count() > 0) {
      console.log('  ✅ Заказ успешно оформлен!');
    } else if (await errorMsg.count() > 0) {
      const errText = await errorMsg.first().textContent();
      console.log(`  ⚠️  Ошибка оформления: ${errText?.trim()}`);
    }
    
    await page.waitForTimeout(1000);
    await shotFull(page, `${prefix}_08_after_checkout`, 'Шаг 8: После оформления');
    
    // Если редирект на страницу оплаты
    const newUrl = page.url();
    if (newUrl !== `${BASE_URL}/dashboard/new-order` && newUrl.includes('dashboard')) {
      console.log(`  🔄 Редирект на: ${newUrl}`);
      await shot(page, `${prefix}_09_redirect_page`, 'Шаг 9: Страница после редиректа');
    }
  } else {
    await shotFull(page, `${prefix}_07_no_checkout_btn`, 'Шаг 7: Кнопка оформления не найдена');
    console.log('  ⚠️  Кнопка оформления не найдена — возможно форма ещё не полностью заполнена');
  }

  console.log(`\n  ✅ Тест "${testLink.label}" завершён`);
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log('\n🧪 E2E Order Flow Test — вставка ссылки + выбор услуги + чекаут');
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);

  const user = await setupUser();
  const sessionToken = await createSession(user.id);
  console.log(`✅ Тестовый пользователь: ${user.email}`);
  console.log(`💰 Баланс: 100,000.00 ₽\n`);

  const browser = await chromium.launch({ headless: true });
  
  try {
    // Desktop viewport (основной)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    });

    await context.addCookies([{
      name: 'session_token',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    const page = await context.newPage();
    
    // Отключаем анимации
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '*, *::before, *::after { transition: none !important; animation-duration: 0.01ms !important; }';
      document.head.appendChild(style);
    });

    // Тестируем флоу для Telegram (основной тест)
    await testOrderFlow(page, TEST_LINKS[0], 1);
    
    // Сбрасываем страницу перед следующим тестом
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    
    // YouTube тест
    await testOrderFlow(page, TEST_LINKS[1], 2);

    // Mobile viewport — Telegram
    console.log('\n\n📱 Повтор теста на Mobile (375px)');
    await context.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    await mobileContext.addCookies([{
      name: 'session_token',
      value: sessionToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    }]);

    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => {
      const style = document.createElement('style');
      style.innerHTML = '*, *::before, *::after { transition: none !important; animation-duration: 0.01ms !important; }';
      document.head.appendChild(style);
    });

    const mobileLink = { ...TEST_LINKS[0], label: 'Telegram_Mobile' };
    await testOrderFlow(mobilePage, mobileLink, 3);

    await mobileContext.close();

  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  // Итог
  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.png'));
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ E2E тест завершён!`);
  console.log(`📸 Сохранено скриншотов: ${files.length}`);
  console.log(`📁 Папка: ${OUTPUT_DIR}`);
}

main().catch(console.error);
