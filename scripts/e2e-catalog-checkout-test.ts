import { chromium } from '@playwright/test';

async function runE2ETest() {
  console.log('🚀 Starting E2E Playwright Interactive Test...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();

  const errors: string[] = [];
  const logs: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[Console Error] ${msg.text()}`);
    } else {
      logs.push(`[Console ${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    errors.push(`[Uncaught Page Error] ${err.message}\n${err.stack}`);
  });

  try {
    console.log('1. Navigating to http://127.0.0.1:3000/...');
    const response = await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    console.log(`   Page loaded with status: ${response?.status()}`);

    // Wait for hydration
    await page.waitForTimeout(2000);

    // 2. Check Networks
    console.log('2. Auditing Network Selector...');
    const networkButtons = await page.$$('button[title]');
    console.log(`   Found ${networkButtons.length} network buttons`);
    for (const btn of networkButtons) {
      const title = await btn.getAttribute('title');
      console.log(`   - Network button: "${title}"`);
    }

    // 3. Check Categories
    console.log('3. Auditing Category Sidebar...');
    const categoryButtons = await page.$$('[data-testid="category-sidebar"] button');
    console.log(`   Found ${categoryButtons.length} category buttons`);
    for (const btn of categoryButtons) {
      const text = await btn.innerText();
      console.log(`   - Category button: "${text.trim().replace(/\n/g, ' ')}"`);
    }

    // 4. Check Services
    console.log('4. Auditing Service Cards in Grid...');
    const serviceCards = await page.$$('.grid .group');
    console.log(`   Found ${serviceCards.length} service cards in grid`);

    // 5. Test clicking another network (e.g. VK or YouTube)
    const vkButton = await page.$('button[title="ВКонтакте"], button[title="VK"]');
    if (vkButton) {
      console.log('5. Clicking VK Network button...');
      await vkButton.click();
      await page.waitForTimeout(1500);

      const vkCategories = await page.$$('[data-testid="category-sidebar"] button');
      console.log(`   Categories after VK click: ${vkCategories.length}`);
      for (const btn of vkCategories) {
        const text = await btn.innerText();
        console.log(`     - VK Category: "${text.trim().replace(/\n/g, ' ')}"`);
      }

      const vkServices = await page.$$('.grid .group');
      console.log(`   Services loaded for VK: ${vkServices.length}`);
    } else {
      console.log('⚠️ VK button not found by title');
    }

    // 6. Test clicking back to Telegram
    const tgButton = await page.$('button[title="Telegram"]');
    if (tgButton) {
      console.log('6. Clicking Telegram Network button...');
      await tgButton.click();
      await page.waitForTimeout(1500);

      const tgCategories = await page.$$('[data-testid="category-sidebar"] button');
      console.log(`   Categories after Telegram click: ${tgCategories.length}`);
      for (const btn of tgCategories) {
        const text = await btn.innerText();
        console.log(`     - Telegram Category: "${text.trim().replace(/\n/g, ' ')}"`);
      }
    }

    // 7. Test clicking on a Service Card
    console.log('7. Testing Service Card click...');
    const cards = await page.$$('.grid .group');
    if (cards.length > 0) {
      console.log('   Clicking first service card...');
      await cards[0].click();
      await page.waitForTimeout(1500);

      // Check if modal or checkout opened
      const modal = await page.$('[aria-label="Оформление заказа"], .fixed.inset-0.z-\\[200\\], [data-testid="checkout-modal"]');
      const dialog = await page.$('h3:has-text("Оформление заказа")');
      console.log(`   Checkout Modal Dialog visible: ${!!dialog || !!modal}`);

      // Check form inputs
      const emailInput = await page.$('input[type="email"]');
      console.log(`   Email Input visible in checkout: ${!!emailInput}`);

      const payButton = await page.$('button:has-text("Оплатить")');
      console.log(`   Pay Button visible in checkout: ${!!payButton}`);
    } else {
      console.log('⚠️ No service cards available to click');
    }

    // 8. Test Variant 2 (In-Card Accordion)
    console.log('8. Testing Variant 2 (In-Card Accordion: ?checkout=card)...');
    await page.goto('http://127.0.0.1:3000/?checkout=card', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    const cardGridCards = await page.$$('.grid .group');
    if (cardGridCards.length > 0) {
      console.log('   Clicking first service card in Variant 2...');
      await cardGridCards[0].click();
      await page.waitForTimeout(1500);

      const accordionHeader = await page.$('span:has-text("Параметры заказа")');
      console.log(`   In-Card Accordion expanded: ${!!accordionHeader}`);
    }

    console.log('\n=============================================');
    console.log(`📊 E2E Test Completed. Errors caught: ${errors.length}`);
    if (errors.length > 0) {
      console.log('🚨 Errors list:');
      errors.forEach(e => console.log('  ', e));
    } else {
      console.log('✅ 0 JavaScript/Console errors detected!');
    }
    console.log('=============================================\n');

  } catch (err: any) {
    console.error('❌ E2E Test execution failed:', err);
  } finally {
    await browser.close();
  }
}

runE2ETest();
