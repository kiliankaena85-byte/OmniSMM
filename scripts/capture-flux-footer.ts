import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  console.log("Navigating to SMMflux page on port 3001...");
  await page.goto("http://127.0.0.1:3001/ab-lovable", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(1500);

  const footer = page.locator("footer");
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  const screenshotPath = "C:\\Users\\Артём\\.gemini\\antigravity\\brain\\6224d023-9600-45e9-bdba-d0f3fbeb4e3b\\smmflux_cyber_footer.png";
  await footer.screenshot({ path: screenshotPath });
  console.log(`Saved screenshot to: ${screenshotPath}`);

  await browser.close();
}

main().catch(console.error);
