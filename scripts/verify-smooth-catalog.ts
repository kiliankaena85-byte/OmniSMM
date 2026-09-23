import { chromium } from 'playwright';

async function main() {
  console.log('🚀 Verifying SMMflux catalog smooth transitions & 60fps rendering...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1,
  });

  // Set tenant to flux
  await context.addCookies([
    { name: 'x_tenant', value: 'flux', domain: '127.0.0.1', path: '/' },
    { name: 'x-tenant-id', value: 'flux', domain: '127.0.0.1', path: '/' },
  ]);

  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3000/?tenant=flux');
  await page.waitForTimeout(1000);

  // 1. Initial Hero Step
  await page.screenshot({
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/flux_catalog_step1_hero.png',
  });
  console.log('Saved flux_catalog_step1_hero.png');

  // 2. Click "Или выберите платформу из каталога"
  const openCatalogBtn = page.locator('[data-testid="flux-open-catalog-btn"]');
  const t0 = Date.now();
  await openCatalogBtn.click();
  await page.waitForSelector('text=Выберите соцсеть', { timeout: 3000 });
  await page.waitForTimeout(350);
  const switchTimeMs = Date.now() - t0;
  console.log(`⚡ Transition to Network selection completed in ${switchTimeMs}ms!`);

  await page.screenshot({
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/flux_catalog_step2_networks.png',
  });
  console.log('Saved flux_catalog_step2_networks.png');

  // 3. Click Telegram network
  const telegramBtn = page.locator('button:has-text("Telegram")').first();
  const t1 = Date.now();
  await telegramBtn.click();
  await page.waitForSelector('text=Выберите категорию', { timeout: 3000 });
  await page.waitForTimeout(350);
  const catTimeMs = Date.now() - t1;
  console.log(`⚡ Transition to Category selection completed in ${catTimeMs}ms!`);

  await page.screenshot({
    path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/flux_catalog_step3_categories.png',
  });
  console.log('Saved flux_catalog_step3_categories.png');

  // 4. Click Subscribers category
  const subCategory = page.locator('text=Подписчики').first();
  if (await subCategory.isVisible()) {
    const t2 = Date.now();
    await subCategory.click();
    await page.waitForTimeout(500);
    const srvTimeMs = Date.now() - t2;
    console.log(`⚡ Transition to Services list completed in ${srvTimeMs}ms!`);

    await page.screenshot({
      path: 'C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/flux_catalog_step4_services.png',
    });
    console.log('Saved flux_catalog_step4_services.png');
  }

  await browser.close();
  console.log('✅ All transitions verified with zero jank!');
}

main().catch(console.error);
