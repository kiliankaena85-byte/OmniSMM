import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

  const email = 'admin@smmplan.test';

  console.log(`Navigating to /admin/clients via login-direct...`);
  await page.goto(`http://127.0.0.1:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan&redirect=${encodeURIComponent('/admin/clients')}`);
  await page.waitForTimeout(2500);

  const clientsTablePath = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/admin_clients_current.png');
  await page.screenshot({ path: clientsTablePath, fullPage: true });
  console.log(`Saved: ${clientsTablePath}`);

  // Let's also click the first client or open detail
  const clientLink = await page.$('tbody tr a, [data-client-id]');
  if (clientLink) {
    console.log('Clicking client...');
    await clientLink.click();
    await page.waitForTimeout(2000);
    const detailPath = path.resolve('C:/Users/Артём/.gemini/antigravity/brain/6fe070bd-15c2-4d78-b2e2-88e29f93053c/admin_clients_selected.png');
    await page.screenshot({ path: detailPath, fullPage: true });
    console.log(`Saved: ${detailPath}`);
  }

  await browser.close();
  console.log('Clients captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
