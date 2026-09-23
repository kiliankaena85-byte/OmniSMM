import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.stack || err.message}`));
  page.on('requestfailed', req => console.log(`[REQ FAILED] ${req.url()} - ${req.failure()?.errorText}`));

  await page.goto('http://127.0.0.1:3000/api/dev/login-direct?email=admin%40smmplan.test&tenant=smmplan&redirect=%2Fadmin%2Fdashboard');
  await page.waitForTimeout(2000);

  console.log('--- Page loaded. Testing click on link ---');
  
  // Click on "Заказы" link
  const link = page.locator('aside a[href="/admin/orders"]');
  console.log('Clicking aside link /admin/orders...');
  await link.click();

  await page.waitForTimeout(3000);
  console.log('Final page URL:', page.url());

  // Also test clicking directly with JS
  console.log('Testing JS click...');
  await page.evaluate(() => {
    const a = document.querySelector('aside a[href="/admin/orders"]') as HTMLElement;
    if (a) {
      console.log('Dispatching click event on', a);
      a.click();
    } else {
      console.log('Link not found!');
    }
  });

  await page.waitForTimeout(3000);
  console.log('Final page URL after JS click:', page.url());

  await browser.close();
}

main().catch(console.error);
