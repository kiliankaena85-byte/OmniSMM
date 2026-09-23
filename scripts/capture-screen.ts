import { chromium } from 'playwright';
import path from 'path';

async function main() {
  const artifactDir = 'C:\\Users\\Артём\\.gemini\\antigravity\\brain\\4a19462e-2e0b-4dd0-b414-cba6359e5ded';
  const url = 'http://localhost:3000/?tenant=boost';

  console.log('Launching browser to capture visual screens...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop Screenshot
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
  });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(url, { waitUntil: 'networkidle' });
  await desktopPage.waitForTimeout(1000);

  const desktopPath = path.join(artifactDir, 'boost-desktop.png');
  await desktopPage.screenshot({ path: desktopPath, fullPage: false });
  console.log('Saved desktop screenshot to:', desktopPath);

  // 2. Mobile Screenshot (iPhone 14 Pro)
  const mobileContext = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(url, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1000);

  const mobilePath = path.join(artifactDir, 'boost-mobile.png');
  await mobilePage.screenshot({ path: mobilePath, fullPage: false });
  console.log('Saved mobile screenshot to:', mobilePath);

  await browser.close();
  console.log('Done capturing visual screens!');
}

main().catch((err) => {
  console.error('Error capturing screen:', err);
  process.exit(1);
});
