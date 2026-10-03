import { chromium } from 'playwright';
import path from 'path';

async function main() {
  console.log('🚀 Verifying Telegram Mini App (/depin) on Stage :3005...');

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Emulate Telegram WebApp viewport (mobile smartphone screen inside Telegram)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // iPhone 14 / modern smartphone
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.9 (iPhone; iOS 17.4; Scale/3.00)'
  });

  const page = await context.newPage();
  const artifactsDir = path.resolve('C:/Users/Артем/.gemini/antigravity/brain/c1f1ef9d-4c5f-42fb-82fb-98201bbbd1a8');

  await page.addInitScript(() => {
    (window as unknown as { Telegram: unknown }).Telegram = {
      WebApp: {
        ready: () => console.log('Telegram.WebApp.ready() called'),
        expand: () => console.log('Telegram.WebApp.expand() called'),
        disableVerticalSwipes: () => {},
        enableClosingConfirmation: () => {},
        initData: 'query_id=AAHdF6IQAAAAAN0XohC_dev&user=%7B%22id%22%3A268747191%2C%22first_name%22%3A%22Artem%22%2C%22username%22%3A%22artem_smm%22%7D&auth_date=1790853000&hash=dev_hash_verified',
        initDataUnsafe: {
          user: { id: 268747191, first_name: 'Artem', username: 'artem_smm' }
        },
        HapticFeedback: {
          impactOccurred: () => {},
          notificationOccurred: () => {},
          selectionChanged: () => {}
        },
        openTelegramLink: (url: string) => window.open(url, '_blank')
      }
    };
  });

  console.log('1. Navigating to http://127.0.0.1:3005/depin ...');
  await page.goto('http://127.0.0.1:3005/depin', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Take screenshot of Mini App
  const miniAppScreenshot = path.join(artifactsDir, 'stage_telegram_mini_app.png');
  await page.screenshot({ path: miniAppScreenshot, fullPage: false });
  console.log('   Saved Telegram Mini App screenshot to:', miniAppScreenshot);

  await browser.close();
  console.log('✅ Telegram Mini App Verification Successful!');
}

main().catch(err => {
  console.error('❌ Mini App Verification Failed:', err);
  process.exit(1);
});
