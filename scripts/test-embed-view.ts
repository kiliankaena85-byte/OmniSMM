import { chromium } from 'playwright';

async function main() {
  console.log('🚀 [TEST] Launching Chrome to view post 16...');
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    viewport: { width: 400, height: 300 },
  });

  const page = await context.newPage();

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('smmMarket69') || url.includes('widget') || url.includes('telegram.org')) {
      console.log(`[NET] Response: ${response.status()} ${url.substring(0, 80)}`);
    }
  });

  console.log('🌐 [TEST] Navigating to https://t.me/smmMarket69/16?embed=1');
  await page.goto('https://t.me/smmMarket69/16?embed=1', { waitUntil: 'networkidle' });

  console.log('⏱️ [TEST] Dwell time: waiting 6 seconds for Telegram view ping...');
  await page.waitForTimeout(6000);

  const viewsText = await page.textContent('.tgme_widget_message_views');
  console.log(`📊 [TEST] Current views on page: "${viewsText}"`);

  await browser.close();
  console.log('✅ [TEST] Done!');
}

main().catch(console.error);
