import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const artifactDir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\4a19462e-2e0b-4dd0-b414-cba6359e5ded';
  const url = 'https://primelike.ru';

  console.log('Capturing original primelike.ru screenshots...');
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 1200 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  } catch {
    console.log('Network idle timed out, proceeding with screenshot...');
  }
  await page.waitForTimeout(2000);

  const originalPath = path.join(artifactDir, 'primelike-original.png');
  await page.screenshot({ path: originalPath, fullPage: false });
  console.log('Saved original primelike screenshot to:', originalPath);

  await browser.close();
}

main().catch(err => {
  console.error('Error:', err);
});
