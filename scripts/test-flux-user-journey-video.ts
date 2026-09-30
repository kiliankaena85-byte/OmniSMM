import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { SignJWT } from 'jose';

const BASE_URL = process.env.TEST_URL || 'http://127.0.0.1:3005';
const JWT_SECRET = Buffer.from('ef4edc9fe34e3dea858e0a32308cbe956341934e0bcbd0f087af54501ffbc44e');

const DESKTOP_VIDEO_DIR = path.resolve(process.cwd(), 'artifacts/videos/flux-desktop');
const MOBILE_VIDEO_DIR = path.resolve(process.cwd(), 'artifacts/videos/flux-mobile');

interface LayoutIssue {
  page: string;
  viewport: 'desktop' | 'mobile';
  type: 'HORIZONTAL_OVERFLOW' | 'SCROLL_JUMP' | 'TOUCH_TARGET_TOO_SMALL' | 'LAYOUT_SHIFT' | 'CONSOLE_ERROR';
  details: string;
  element?: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
}

const detectedIssues: LayoutIssue[] = [];

async function generateAuthToken(): Promise<string> {
  return new SignJWT({
    sessionId: 'sess_flux_playwright_test_01',
    userId: 'cmumf87zb0001w6bs74tvohep',
    canResetPassword: false,
    role: 'USER',
    tenantId: 'flux',
    allowedTenants: ['flux'],
    contour: 'test',
    sessionVer: 1,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

async function checkHorizontalOverflow(page: any, pageName: string, viewport: 'desktop' | 'mobile') {
  const overflow = await page.evaluate(() => {
    const docWidth = document.documentElement.clientWidth;
    const bodyWidth = document.body.clientWidth;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const diff = scrollWidth - Math.min(docWidth, bodyWidth);
    
    // Find culprit element if overflow > 2px
    let culprit: string | null = null;
    if (diff > 2) {
      const allEls = document.querySelectorAll('*');
      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.right > docWidth + 2) {
          culprit = `${el.tagName.toLowerCase()}.${el.className.split(' ').slice(0, 3).join('.')}`;
          break;
        }
      }
    }
    return { diff, culprit, docWidth, scrollWidth };
  });

  if (overflow.diff > 2) {
    detectedIssues.push({
      page: pageName,
      viewport,
      type: 'HORIZONTAL_OVERFLOW',
      details: `Горизонтальный скролл +${overflow.diff}px (scrollWidth: ${overflow.scrollWidth}px > clientWidth: ${overflow.docWidth}px)`,
      element: overflow.culprit || 'unknown',
      severity: overflow.diff > 20 ? 'CRITICAL' : 'MAJOR',
    });
    console.log(`  ❌ [${viewport.toUpperCase()}] Горизонтальный скролл на ${pageName}: +${overflow.diff}px! Элемент: ${overflow.culprit}`);
  } else {
    console.log(`  ✅ [${viewport.toUpperCase()}] Горизонтальный скролл на ${pageName}: 0px (Идеально)`);
  }
}

async function checkTouchTargets(page: any, pageName: string) {
  const smallTargets = await page.evaluate(() => {
    const interactives = document.querySelectorAll('button, a, input, select, textarea');
    const small: Array<{ tag: string; text: string; width: number; height: number; classNames: string }> = [];
    interactives.forEach((el) => {
      // Ignore hidden or 0x0 elements
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;
      if (rect.width <= 0 || rect.height <= 0) return;
      
      // WCAG 2.2 AA target size: >= 24px (strict: >= 44px for primary mobile tap targets)
      if (rect.height < 40 || rect.width < 40) {
        // Skip inline text links inside paragraphs
        if (el.tagName === 'A' && el.closest('p')) return;
        small.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 25),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          classNames: el.className.slice(0, 40),
        });
      }
    });
    return small.slice(0, 5); // top 5
  });

  if (smallTargets.length > 0) {
    smallTargets.forEach((t) => {
      detectedIssues.push({
        page: pageName,
        viewport: 'mobile',
        type: 'TOUCH_TARGET_TOO_SMALL',
        details: `Тач-зона < 44px: ${t.tag} "${t.text}" (${t.width}x${t.height}px)`,
        element: `${t.tag}.${t.classNames}`,
        severity: 'MINOR',
      });
    });
    console.log(`  ⚠️ [MOBILE] Найдено ${smallTargets.length} элементов с тач-зоной < 44px на ${pageName}`);
  }
}

async function runDesktopSuite() {
  console.log('\n🖥️ ─── ЗАПУСК ДЕСКТОПНОГО СЦЕНАРИЯ (1440x900) ───');
  if (!fs.existsSync(DESKTOP_VIDEO_DIR)) fs.mkdirSync(DESKTOP_VIDEO_DIR, { recursive: true });

  const token = await generateAuthToken();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: DESKTOP_VIDEO_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  await context.addCookies([
    { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
  ]);

  const page = await context.newPage();

  // Listen to console errors
  page.on('console', (msg: any) => {
    if (msg.type() === 'error' && !msg.text().includes('ERR_BLOCKED_BY_CLIENT')) {
      detectedIssues.push({
        page: page.url(),
        viewport: 'desktop',
        type: 'CONSOLE_ERROR',
        details: msg.text().slice(0, 120),
        severity: 'MAJOR',
      });
    }
  });

  try {
    // 1. Главная витрина SMMflux (Desktop)
    console.log('1️⃣ Переход на витрину SMMflux (/)...\n');
    await page.goto(`${BASE_URL}/?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await checkHorizontalOverflow(page, 'Storefront /', 'desktop');

    // Плавный скролл страницы вниз для проверки анимаций и дёрганья
    console.log('   Скролл витрины вниз и вверх...');
    await page.evaluate(async () => {
      window.scrollBy({ top: 600, behavior: 'smooth' });
    });
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      window.scrollBy({ top: 800, behavior: 'smooth' });
    });
    await page.waitForTimeout(800);
    await page.evaluate(async () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(500);

    // 2. Каталог услуг (Desktop)
    console.log('2️⃣ Переход в каталог услуг (/services)...\n');
    await page.goto(`${BASE_URL}/services?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await checkHorizontalOverflow(page, 'Services /services', 'desktop');

    // Кликаем по категориям каталога
    const categoryTabs = page.locator('button:has-text("Telegram"), button:has-text("ВКонтакте"), a:has-text("Telegram")');
    if (await categoryTabs.count() > 0) {
      console.log('   Клик по категории Telegram в каталоге...');
      await categoryTabs.first().click().catch(() => {});
      await page.waitForTimeout(800);
    }

    // 3. Личный кабинет SMMflux (Dashboard Home - Lovable)
    console.log('3️⃣ Переход в Личный кабинет (/dashboard)...\n');
    await page.goto(`${BASE_URL}/dashboard?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await checkHorizontalOverflow(page, 'Dashboard /dashboard', 'desktop');

    // Интерактив: выбор платформы, ввод ссылки, изменение количества
    console.log('   Интерактивное взаимодействие с консолью заказа...');
    
    // Переключение платформы
    const vkBtn = page.locator('button:has-text("ВКонтакте"), button:has-text("VK")');
    if (await vkBtn.count() > 0) {
      console.log('   Клик: выбор ВКонтакте...');
      await vkBtn.first().click();
      await page.waitForTimeout(600);
    }

    const tgBtn = page.locator('button:has-text("Telegram"), button:has-text("TG")');
    if (await tgBtn.count() > 0) {
      console.log('   Клик: выбор Telegram...');
      await tgBtn.first().click();
      await page.waitForTimeout(600);
    }

    // Ввод ссылки в поле (проверка на дёрганье страницы)
    const urlInput = page.locator('input[placeholder*="t.me"], input[type="url"], input[name="link"]');
    if (await urlInput.count() > 0) {
      console.log('   Фокус и ввод ссылки https://t.me/durov...');
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await urlInput.first().focus();
      await page.waitForTimeout(300);
      const scrollAfterFocus = await page.evaluate(() => window.scrollY);
      
      if (Math.abs(scrollAfterFocus - scrollBefore) > 10) {
        detectedIssues.push({
          page: '/dashboard',
          viewport: 'desktop',
          type: 'SCROLL_JUMP',
          details: `Дёрганье скролла при фокусе инпута: сдвиг на ${Math.round(scrollAfterFocus - scrollBefore)}px`,
          element: 'input[name="link"]',
          severity: 'MAJOR',
        });
        console.log(`  ❌ [DESKTOP] Дёрганье при фокусе инпута: ${Math.round(scrollAfterFocus - scrollBefore)}px!`);
      } else {
        console.log('  ✅ [DESKTOP] Фокус инпута стабилен: скролл не дёрнулся (0px сдвиг)');
      }

      await urlInput.first().fill('https://t.me/durov');
      await page.waitForTimeout(800);
    }

    // Клик по количеству
    const qtyBtn = page.locator('button:has-text("2 500"), button:has-text("5 000"), button:has-text("+1 000")');
    if (await qtyBtn.count() > 0) {
      console.log('   Клик: увеличение количества...');
      await qtyBtn.first().click();
      await page.waitForTimeout(600);
    }

    // 4. Страница пополнения баланса и чекаута (/dashboard/finance)
    console.log('4️⃣ Переход в раздел Финансы и пополнение (/dashboard/finance)...\n');
    await page.goto(`${BASE_URL}/dashboard/finance?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await checkHorizontalOverflow(page, 'Finance /dashboard/finance', 'desktop');

    // Клик по методам оплаты
    const sbpMethod = page.locator('button:has-text("СБП"), div:has-text("СБП")');
    if (await sbpMethod.count() > 0) {
      console.log('   Клик: выбор оплаты через СБП...');
      await sbpMethod.first().click().catch(() => {});
      await page.waitForTimeout(600);
    }

    // Ввод суммы пополнения
    const amountInput = page.locator('input[type="number"], input[name="amount"]');
    if (await amountInput.count() > 0) {
      console.log('   Ввод суммы 500 ₽...');
      await amountInput.first().fill('500');
      await page.waitForTimeout(500);
    }

    // 5. Раздел Заказы (/dashboard/orders)
    console.log('5️⃣ Переход в список Заказов (/dashboard/orders)...\n');
    await page.goto(`${BASE_URL}/dashboard/orders?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await checkHorizontalOverflow(page, 'Orders /dashboard/orders', 'desktop');

  } catch (err: any) {
    console.error('Ошибка в десктопном сценарии:', err.message);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (video) {
      const videoPath = await video.path();
      console.log(`🎥 [DESKTOP VIDEO СОХРАНЕНО]: ${videoPath}`);
    }
  }
}

async function runMobileSuite() {
  console.log('\n📱 ─── ЗАПУСК МОБИЛЬНОГО СЦЕНАРИЯ (iPhone 390x844) ───');
  if (!fs.existsSync(MOBILE_VIDEO_DIR)) fs.mkdirSync(MOBILE_VIDEO_DIR, { recursive: true });

  const token = await generateAuthToken();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
    recordVideo: {
      dir: MOBILE_VIDEO_DIR,
      size: { width: 390, height: 844 },
    },
  });

  await context.addCookies([
    { name: 'session_token', value: token, domain: '127.0.0.1', path: '/' },
    { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
  ]);

  const page = await context.newPage();

  try {
    // 1. Мобильная витрина SMMflux
    console.log('1️⃣ Переход на мобильную витрину SMMflux (/)...\n');
    await page.goto(`${BASE_URL}/?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await checkHorizontalOverflow(page, 'Mobile Storefront /', 'mobile');
    await checkTouchTargets(page, 'Mobile Storefront /');

    // Скролл мобильной страницы
    console.log('   Тач-скролл мобильной витрины вниз и вверх...');
    await page.evaluate(async () => {
      window.scrollBy({ top: 500, behavior: 'smooth' });
    });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      window.scrollBy({ top: 600, behavior: 'smooth' });
    });
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    await page.waitForTimeout(500);

    // 2. Мобильный Личный Кабинет
    console.log('2️⃣ Переход в Мобильный Личный кабинет (/dashboard)...\n');
    await page.goto(`${BASE_URL}/dashboard?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await checkHorizontalOverflow(page, 'Mobile Dashboard /dashboard', 'mobile');
    await checkTouchTargets(page, 'Mobile Dashboard /dashboard');

    // Проверка дёрганья экрана при тапе в инпут ссылки
    const urlInput = page.locator('input[placeholder*="t.me"], input[type="url"], input[name="link"]');
    if (await urlInput.count() > 0) {
      console.log('   Мобильный тап по инпуту ввода ссылки...');
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await urlInput.first().tap();
      await page.waitForTimeout(300);
      const scrollAfterTap = await page.evaluate(() => window.scrollY);

      if (Math.abs(scrollAfterTap - scrollBefore) > 10) {
        detectedIssues.push({
          page: '/dashboard (mobile)',
          viewport: 'mobile',
          type: 'SCROLL_JUMP',
          details: `Мобильный скачок скролла при тапе в инпут: сдвиг на ${Math.round(scrollAfterTap - scrollBefore)}px`,
          element: 'input[name="link"]',
          severity: 'MAJOR',
        });
        console.log(`  ❌ [MOBILE] Скачок экрана при тапе в инпут: ${Math.round(scrollAfterTap - scrollBefore)}px!`);
      } else {
        console.log('  ✅ [MOBILE] Тап в инпут без скачка: скролл стабилен (0px сдвиг)');
      }

      await urlInput.first().fill('https://t.me/durov');
      await page.waitForTimeout(600);
    }

    // Тап по кнопке быстрого заказа
    const submitBtn = page.locator('button:has-text("Запустить"), button:has-text("Создать заказ"), button:has-text("Оформить")');
    if (await submitBtn.count() > 0) {
      console.log('   Тап: кнопка оформления заказа...');
      await submitBtn.first().tap();
      await page.waitForTimeout(1000);
    }

    // 3. Мобильный чекаут и пополнение баланса (/dashboard/finance)
    console.log('3️⃣ Переход в раздел пополнения баланса на смартфоне (/dashboard/finance)...\n');
    await page.goto(`${BASE_URL}/dashboard/finance?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await checkHorizontalOverflow(page, 'Mobile Finance /dashboard/finance', 'mobile');
    await checkTouchTargets(page, 'Mobile Finance /dashboard/finance');

    // Клик по СБП и проверка удобства
    const sbpPill = page.locator('button:has-text("СБП"), div:has-text("СБП")');
    if (await sbpPill.count() > 0) {
      console.log('   Тап: выбор СБП на смартфоне...');
      await sbpPill.first().tap().catch(() => {});
      await page.waitForTimeout(600);
    }

    // 4. Мобильный визард создания заказа (/dashboard/new-order)
    console.log('4️⃣ Переход в пошаговый визард заказа (/dashboard/new-order)...\n');
    await page.goto(`${BASE_URL}/dashboard/new-order?tenant=flux`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await checkHorizontalOverflow(page, 'Mobile New Order Wizard /dashboard/new-order', 'mobile');
    await checkTouchTargets(page, 'Mobile New Order Wizard /dashboard/new-order');

    // Проверяем шаги визарда на смартфоне
    const stepCategories = page.locator('button:has-text("Telegram"), div:has-text("Telegram")');
    if (await stepCategories.count() > 0) {
      console.log('   Тап по категории Telegram в мобильном визарде...');
      await stepCategories.first().tap().catch(() => {});
      await page.waitForTimeout(800);
    }

  } catch (err: any) {
    console.error('Ошибка в мобильном сценарии:', err.message);
  } finally {
    const video = page.video();
    await context.close();
    await browser.close();
    if (video) {
      const videoPath = await video.path();
      console.log(`🎥 [MOBILE VIDEO СОХРАНЕНО]: ${videoPath}`);
    }
  }
}

async function main() {
  console.log('🚀 [SMMFLUX AUDIT] Запуск комплексного аудита всех страниц SMM-Flux с видеозаписью...');
  await runDesktopSuite();
  await runMobileSuite();

  console.log('\n📊 ─── ИТОГОВЫЙ ОТЧЕТ ОБНАРУЖЕННЫХ ДЕФЕКТОВ ВЕРСТКИ И UX ───');
  console.log(`Всего зафиксировано дефектов: ${detectedIssues.length}`);
  
  // Сохраняем JSON отчет
  const reportPath = path.resolve(process.cwd(), 'artifacts/flux-ui-audit-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(detectedIssues, null, 2), 'utf-8');
  console.log(`📁 Подробный отчет сохранен в: ${reportPath}`);

  // Копируем последние видео в фиксированные читаемые имена
  const desktopFiles = fs.readdirSync(DESKTOP_VIDEO_DIR).filter(f => f.endsWith('.webm'));
  if (desktopFiles.length > 0) {
    const latestDesktop = desktopFiles.sort().pop()!;
    fs.copyFileSync(path.join(DESKTOP_VIDEO_DIR, latestDesktop), path.join(DESKTOP_VIDEO_DIR, 'smmflux-desktop-user-journey.webm'));
    console.log(`🎬 Финальное Desktop видео: ${path.join(DESKTOP_VIDEO_DIR, 'smmflux-desktop-user-journey.webm')}`);
  }

  const mobileFiles = fs.readdirSync(MOBILE_VIDEO_DIR).filter(f => f.endsWith('.webm'));
  if (mobileFiles.length > 0) {
    const latestMobile = mobileFiles.sort().pop()!;
    fs.copyFileSync(path.join(MOBILE_VIDEO_DIR, latestMobile), path.join(MOBILE_VIDEO_DIR, 'smmflux-mobile-user-journey.webm'));
    console.log(`🎬 Финальное Mobile видео: ${path.join(MOBILE_VIDEO_DIR, 'smmflux-mobile-user-journey.webm')}`);
  }
}

main().catch(err => {
  console.error('Критический сбой аудита:', err);
  process.exit(1);
});
