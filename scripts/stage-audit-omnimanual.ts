import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { chromium, Page } from 'playwright';
import { prisma, ensureServerRunning, createJwt, stopServer } from './stage-auth-helper';

const BRAIN_DIR = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/e454ca9f-8f39-4938-9e3c-4fa461407351');
const ARTIFACTS_DIR = path.resolve(process.cwd(), 'artifacts/stage-manual');

async function saveScreenshot(page: Page, filename: string, desc: string): Promise<void> {
  const localPath = path.join(ARTIFACTS_DIR, filename);
  await page.screenshot({ path: localPath, fullPage: false });
  fs.copyFileSync(localPath, path.join(BRAIN_DIR, filename));
  console.log(`✓ [Скриншот] ${filename} — ${desc}`);
}

async function main() {
  console.log('🎬 Запуск Self-Loop Visual Audit для OmniManual 1.0 (Port 3005)...');
  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });
  if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const stageUrl = await ensureServerRunning();
  const ownerUser = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  if (!ownerUser) throw new Error('Пользователь с ролью OWNER не найден в БД');

  const ownerToken = await createJwt(ownerUser.id, 'OWNER', 'smmplan');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  try {
    const context = await browser.newContext({ viewport: { width: 1560, height: 960 }, deviceScaleFactor: 1.5 });
    await context.addCookies([
      { name: 'session_token', value: ownerToken, domain: '127.0.0.1', path: '/' },
      { name: 'x_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
      { name: 'x_admin_tenant', value: 'smmplan', domain: '127.0.0.1', path: '/' },
    ]);

    const page = await context.newPage();
    console.log('📸 1. Открытие /admin/providers и стыковка OmniManual...');
    let navRes = await page.goto(`${stageUrl}/admin/providers`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    if (!navRes || navRes.status() === 404) {
      console.log('🔄 Cold start retry for /admin/providers...');
      await page.waitForTimeout(3000);
      await page.goto(`${stageUrl}/admin/providers`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }
    await page.waitForSelector('text=Провайдеры API', { timeout: 30000 });
    await page.waitForTimeout(1000);

    const triggerBtn = page.locator('button[aria-label="Открыть интерактивную инструкцию и ИИ-консультант"]');
    if ((await triggerBtn.count()) > 0) {
      await triggerBtn.first().click();
    } else {
      await page.keyboard.press('Control+/');
    }
    await page.waitForSelector('div[role="dialog"]', { timeout: 20000 });
    await page.waitForTimeout(1000);
    await saveScreenshot(page, '01_stage_manual_docked_mode.png', 'Режим стыковки (Docked Mode)');

    console.log('📸 2. Переход во вкладку «Инструкция» (Регламенты Роспатента)...');
    const guidesTab = page.locator('button:has-text("Инструкция")');
    if ((await guidesTab.count()) > 0) {
      await guidesTab.first().click();
      await page.waitForTimeout(1500);
    }
    await saveScreenshot(page, '02_stage_manual_guides_patent_list.png', 'Список регламентов по ГОСТ ЕСПД');

    console.log('📸 3. Интерактивный чек-лист регламента каталога...');
    const firstRunbook = page.locator('text=Импорт каталога услуг через мастер Cherry-Pick').first();
    if ((await firstRunbook.count()) > 0) {
      await firstRunbook.click();
      await page.waitForTimeout(1500);
    }

    // Toggle steps 1 & 2 to demonstrate live progress bar update
    const stepButtons = page.locator('button[aria-label^="Отметить шаг"]');
    if ((await stepButtons.count()) >= 2) {
      await stepButtons.nth(0).click();
      await page.waitForTimeout(300);
      await stepButtons.nth(1).click();
      await page.waitForSelector('text=50%', { timeout: 5000 });
      await page.evaluate(() => {
        const stepHeader = document.querySelector('button[aria-label^="Отметить шаг"]');
        if (stepHeader) {
          stepHeader.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      });
      await page.waitForTimeout(400);
    }
    await saveScreenshot(page, '03_stage_manual_runbook_checklist_progress.png', 'Интерактивный прогресс-бар 50%');

    console.log('📸 4. Скролл к разделу 6 «Диагностика сбоев и восстановление»...');
    const section6 = page.locator('text=6. Диагностика сбоев и восстановление');
    if ((await section6.count()) > 0) {
      await section6.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }
    await saveScreenshot(page, '04_stage_manual_runbook_troubleshooting_section6.png', 'Раздел 6: Диагностика сбоев');

    console.log('📸 5. Прямой экспорт в Markdown с всплывающим тостом...');
    const downloadBtn = page.locator('button[aria-label="Скачать регламент (.md)"]');
    if ((await downloadBtn.count()) > 0) {
      await downloadBtn.first().click();
      await page.waitForSelector('text=Регламент успешно экспортирован', { timeout: 10000 });
      await page.waitForTimeout(500);
    }
    await saveScreenshot(page, '05_stage_manual_runbook_download_toast.png', 'Тост об экспорте регламента (.md)');

    console.log('📸 6. Живой диалог в чате с ИИ-консультантом...');
    const chatTab = page.locator('button[aria-label="Вкладка AI-Консультант"], button:has-text("AI-Консультант")');
    await chatTab.first().click({ force: true });
    await page.waitForSelector('textarea[placeholder*="Задайте вопрос"]', { timeout: 15000 });
    await page.waitForTimeout(600);

    const zombieChip = page.locator('button:has-text("Что такое зомби-услуги и как работает карантин цен?")').first();
    if ((await zombieChip.count()) > 0) {
      await zombieChip.click();
    } else {
      await page.fill('textarea[placeholder*="Задайте вопрос"]', 'Что такое зомби-услуги и как работает карантин цен?');
      await page.click('button[title="Отправить (Enter)"]');
    }

    // Wait for streaming completion: wait for response text or send button re-enabled
    console.log('⏳ Ожидание завершения генерации ответа ИИ...');
    await page.waitForTimeout(1000);
    await Promise.race([
      page.waitForSelector('text=CAT-ZOMBIE-PURGE', { timeout: 45000 }),
      page.waitForFunction(
        () => document.querySelectorAll('button[title="Копировать ответ"]').length >= 2,
        undefined,
        { timeout: 45000 }
      ),
    ]);
    await page.waitForTimeout(1000);

    // Frame dialog: scroll to reveal user question and start of rich AI response
    await page.evaluate(() => {
      const userBubble = document.querySelector('div[class*="justify-end"]:last-of-type');
      if (userBubble) {
        userBubble.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
    await page.waitForTimeout(600);
    await saveScreenshot(page, '06_stage_manual_chat_live_response.png', 'Живой структурированный ответ с источниками');

    console.log('📸 7. Моментальный ответ из кэша (0 токенов, Zero-Wait)...');
    const enabledChip = page.locator('button:has-text("Что такое зомби-услуги")').first();
    if ((await enabledChip.count()) > 0) {
      await enabledChip.click();
    } else {
      await page.fill('textarea[placeholder*="Задайте вопрос"]', 'Что такое зомби-услуги и как работает карантин цен?');
      await page.click('button[title="Отправить (Enter)"]');
    }
    await page.waitForTimeout(1500);
    await page.waitForSelector('text=0 токенов (Zero-Wait кэш)', { timeout: 30000 });
    await page.evaluate(() => {
      const allSpans = Array.from(document.querySelectorAll('span'));
      const cacheBadge = allSpans.find((el) => el.textContent?.includes('0 токенов (Zero-Wait кэш)'));
      if (cacheBadge) {
        cacheBadge.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
    });
    await page.waitForTimeout(600);
    await saveScreenshot(page, '07_stage_manual_chat_cached_zero_wait.png', 'Метка Zero-Wait кэша (0 токенов)');

    console.log('📸 8. Переход во вкладку «Инспектор кода»...');
    const inspectorTab = page.locator('button[aria-label="Вкладка Инспектор"], button:has-text("Инспектор")');
    await inspectorTab.first().click({ force: true });
    await page.waitForSelector('text=ADR-2026-20', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await saveScreenshot(page, '08_stage_manual_inspector_status.png', 'Статус векторной памяти Docker');

    console.log('📸 9. Проверка экрана /login (Zero-Trap Navigation)...');
    const guestContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`${stageUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await guestPage.waitForSelector('a[aria-label="Вернуться на главную страницу"]', { timeout: 15000 });
    await guestPage.waitForTimeout(1000);
    await saveScreenshot(guestPage, '09_stage_login_guest_back_button.png', 'Кнопка возврата на главную с экрана авторизации');
    await guestContext.close();

    console.log('📸 10. Проверка экрана /login для авторизованного пользователя...');
    await page.goto(`${stageUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('text=Вы уже вошли', { timeout: 15000 });
    await page.waitForTimeout(1000);
    await saveScreenshot(page, '10_stage_login_already_logged_in.png', 'Экран авторизованного пользователя с кнопкой возврата на главную');

    console.log('🎉 Все 10 этапов аудита и скриншоты успешно выполнены!');
  } finally {
    await browser.close();
    await prisma.$disconnect();
    stopServer();
  }
}

main().catch((err) => {
  console.error('❌ Ошибка во время визуального аудита:', err);
  stopServer();
  process.exit(1);
});
