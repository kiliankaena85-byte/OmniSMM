import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: 'x_tenant',
      value: 'flux',
      domain: '127.0.0.1',
      path: '/'
    }
  ]);

  const page = await context.newPage();
  console.log('Navigating to http://127.0.0.1:3001/knowledge?tenant=flux...');
  await page.goto('http://127.0.0.1:3001/knowledge?tenant=flux', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const outputPath = path.join('C:\\Users\\Артём\\.gemini\\antigravity\\brain\\6224d023-9600-45e9-bdba-d0f3fbeb4e3b', 'flux_knowledge_hub_desktop.png');
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`Saved screenshot to: ${outputPath}`);

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
