const { chromium } = require('playwright');
const path = require('path');

async function verifyRealMainPrototype() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const dir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\ea3a0555-f229-4c26-9329-c26f154ae6e0';

  await page.goto('file:///d:/SMM_plan_2/public/flux-main-page-prototype.html', { waitUntil: 'load' });
  await page.screenshot({ path: path.join(dir, 'real_main_step1.png') });

  // Click Далее -> jumps to step 3 categories
  await page.click('button:has-text("Далее ↗")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'real_main_step3.png') });

  // Click Category -> jumps to step 4 tariffs
  await page.click('button:has-text("Подписчики / Участники")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'real_main_step4.png') });

  // Click Tariff -> jumps to step 5 checkout
  await page.click('h4:has-text("Telegram Подписчики (Быстрый старт)")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'real_main_step5.png') });

  // Submit checkout -> Modal opens
  await page.click('button:has-text("Оплатить заказ ↗")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, 'real_main_success_modal.png') });

  await browser.close();
  console.log('Real Main Page HTML prototype clickability verified 100% successfully!');
}

verifyRealMainPrototype();
