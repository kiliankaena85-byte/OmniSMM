import { chromium } from 'playwright';
import * as path from 'path';

async function main() {
  console.log('🚀 Запуск живого визуального аудита Главного Дашборда (Headless: FALSE)...');
  console.log('🖥️ Браузер открывается на вашем экране для интерактивной проверки.');

  const artifactDir = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c');
  const email = 'admin@smmplan.test';

  // Launch VISIBLE browser window on user desktop
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });

  const context = await browser.newContext({
    viewport: null, // use full maximized window
  });

  const page = await context.newPage();

  console.log('1️⃣ Авторизация под Администратором (admin@smmplan.test)...');
  await page.goto(
    `http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/dashboard')}`,
    { waitUntil: 'domcontentloaded', timeout: 30000 }
  );

  await page.waitForTimeout(2000);

  console.log('2️⃣ Проверка критерия №1: Измерение горизонтального скролла...');
  const scrollMetrics = await page.evaluate(() => {
    const mainEl = document.getElementById('main-content') || document.body;
    return {
      windowWidth: window.innerWidth,
      bodyScrollWidth: document.body.scrollWidth,
      mainScrollWidth: mainEl.scrollWidth,
      mainClientWidth: mainEl.clientWidth,
      hasHorizontalScroll: document.body.scrollWidth > window.innerWidth || mainEl.scrollWidth > mainEl.clientWidth,
    };
  });
  console.log('📊 Результат проверки скролла:', scrollMetrics);

  console.log('3️⃣ Проверка критерия №2: Интерактивность чипсов слоев Волновой Диаграммы...');
  // Click layer toggle chips one by one
  const chips = page.locator('button[title*="слой"]');
  const count = await chips.count();
  console.log(`Найдено ${count} интерактивных чипсов фильтрации слоев.`);

  for (let i = 0; i < count; i++) {
    const chip = chips.nth(i);
    const text = await chip.innerText();
    console.log(`Клик по чипсу: ${text.trim()}`);
    await chip.hover();
    await page.waitForTimeout(400);
    await chip.click();
    await page.waitForTimeout(600);
    // Click back to enable
    await chip.click();
    await page.waitForTimeout(400);
  }

  console.log('4️⃣ Проверка критерия №3: Наведение на волновую диаграмму (Интерактивный тултип)...');
  const chartArea = page.locator('.recharts-responsive-container').first();
  if (await chartArea.isVisible()) {
    const box = await chartArea.boundingBox();
    if (box) {
      // Hover across different points of the chart
      for (let xOffset = 0.2; xOffset <= 0.8; xOffset += 0.2) {
        await page.mouse.move(box.x + box.width * xOffset, box.y + box.height * 0.5);
        await page.waitForTimeout(600);
      }
    }
  }

  console.log('5️⃣ Проверка критерия №4: Тестирование переключателя периодов...');
  const periodTrigger = page.locator('button:has-text("Все время"), button:has-text("Период"), button:has-text("Сегодня")').first();
  if (await periodTrigger.isVisible()) {
    await periodTrigger.click();
    await page.waitForTimeout(1000);
    // Click 7d if available
    const option7d = page.locator('button:has-text("7 дней"), a:has-text("7 дней")').first();
    if (await option7d.isVisible()) {
      await option7d.click();
      await page.waitForTimeout(1500);
    }
  }

  console.log('6️⃣ Фиксация итогового эталонного скриншота...');
  const finalScreenshotPath = path.join(artifactDir, 'dashboard_live_audit_final.png');
  await page.screenshot({ path: finalScreenshotPath, fullPage: false });
  console.log(`📸 Снимок сохранен: ${finalScreenshotPath}`);

  console.log('⏳ Оставляем браузер открытым на 5 секунд для вашего визуального осмотра...');
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('🎉 Аудит вкладки 1.1 «Главный Дашборд» успешно завершен!');
}

main().catch(console.error);
