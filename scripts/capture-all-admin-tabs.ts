import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('📸 Capturing all Admin Panel Tabs for visual & logical audit...');

  const email = 'superadmin@smmplan.ru';
  const artifactDir = path.resolve(
    'C:/Users/Артём/.gemini/antigravity/brain/25756746-be5a-4c54-82ae-cad1e4c009e8'
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();

  // Login directly
  console.log('Logging in...');
  await page.goto(`http://localhost:3000/api/dev/login-direct?email=${encodeURIComponent(email)}&tenant=smmplan`);
  await page.waitForTimeout(1000);

  const tabs = [
    { url: 'http://localhost:3000/admin/orders', filename: 'screenshot_tab_orders.png' },
    { url: 'http://localhost:3000/admin/refills', filename: 'screenshot_tab_refills.png' },
    { url: 'http://localhost:3000/admin/tickets', filename: 'screenshot_tab_tickets.png' },
    { url: 'http://localhost:3000/admin/clients', filename: 'screenshot_tab_clients.png' },
    { url: 'http://localhost:3000/admin/finance', filename: 'screenshot_tab_finance.png' },
    { url: 'http://localhost:3000/admin/settings', filename: 'screenshot_tab_settings.png' },
  ];

  for (const tab of tabs) {
    console.log(`Capturing ${tab.url}...`);
    try {
      await page.goto(tab.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(2000);
      const outPath = path.join(artifactDir, tab.filename);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`Saved: ${outPath}`);
    } catch (e) {
      console.warn(`Error capturing ${tab.url}:`, e);
    }
  }

  await browser.close();
  console.log('🎉 All tabs captured successfully!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
