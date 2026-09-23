import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

  const email = 'admin@smmplan.test';
  const ticketId = 'cmszayifv000is9cgibvxyvh9';

  console.log(`Navigating to /admin/tickets?ticketId=${ticketId} via login-direct...`);
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent(`/admin/tickets?ticketId=${ticketId}`)}`);
  await page.waitForTimeout(2500);

  const ticketsDeskPath = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/admin_tickets_active_chat.png');
  await page.screenshot({ path: ticketsDeskPath, fullPage: true });
  console.log(`Saved: ${ticketsDeskPath}`);

  await browser.close();
  console.log('Active ticket chat captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
