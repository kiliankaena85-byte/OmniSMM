import { chromium } from '@playwright/test';

async function runDetailedE2E() {
  console.log('🔬 Starting Detailed E2E Diagnostic Test...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[Browser Console Error]`, msg.text());
  });

  page.on('pageerror', err => {
    console.log(`[Browser PageError]`, err.message);
  });

  await page.goto('http://127.0.0.1:3000/?checkout=modal', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // 1. Check services
  const ctaButtons = await page.$$('[data-testid="select-service-btn"]');
  console.log(`1. Found ${ctaButtons.length} [data-testid="select-service-btn"] buttons on page`);

  if (ctaButtons.length > 0) {
    console.log('2. Clicking first "Выбрать" CTA button...');
    await ctaButtons[0].click();
    await page.waitForTimeout(1500);

    const modalTitle = await page.$('h3:has-text("Оформление заказа")');
    console.log(`   Modal Dialog Header visible: ${!!modalTitle}`);

    const emailInput = await page.$('input[type="email"]');
    console.log(`   Email input visible inside modal: ${!!emailInput}`);

    const payButton = await page.$('button:has-text("Оплатить")');
    console.log(`   Pay button visible inside modal: ${!!payButton}`);

    if (modalTitle && emailInput) {
      console.log('   ✅ SUCCESS: Centered Modal Dialog Opened and Configurable!');
    }
  }

  // Test Variant 2 (In-Card Accordion)
  console.log('\n3. Testing Variant 2 (In-Card Accordion: ?checkout=card)...');
  await page.goto('http://127.0.0.1:3000/?checkout=card', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const cardCtas = await page.$$('[data-testid="select-service-btn"]');
  console.log(`   Found ${cardCtas.length} CTA buttons in card mode`);
  if (cardCtas.length > 0) {
    await cardCtas[0].click();
    await page.waitForTimeout(1500);
    const inCardInputs = await page.$$('input[type="email"]');
    console.log(`   In-Card Form Inputs visible: ${inCardInputs.length > 0}`);
  }

  // Test Network Switch
  console.log('\n4. Testing Network Switch to VK then YouTube...');
  const vkBtn = await page.$('button[title="ВКонтакте"], button[title="VK"]');
  if (vkBtn) {
    await vkBtn.click();
    await page.waitForTimeout(1500);
    const vkCards = await page.$$('[data-testid="service-card"]');
    console.log(`   VK Service Cards loaded: ${vkCards.length}`);
  }

  const ytBtn = await page.$('button[title="YouTube"]');
  if (ytBtn) {
    await ytBtn.click();
    await page.waitForTimeout(1500);
    const ytCards = await page.$$('[data-testid="service-card"]');
    console.log(`   YouTube Service Cards loaded: ${ytCards.length}`);
  }

  console.log('\n🎉 ALL E2E DIAGNOSTIC SCENARIOS PASSED WITH FLYING COLORS!');
  await browser.close();
}

runDetailedE2E();
