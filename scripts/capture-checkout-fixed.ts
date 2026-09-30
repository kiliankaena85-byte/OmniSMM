import { chromium } from "playwright";
import path from "path";

const STAGE_URL = "http://127.0.0.1:3005";
const OUTPUT_DIR = path.resolve(process.cwd(), ".planning", "stage_visuals");

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: { "x-tenant-id": "flux" },
    });

    await context.addCookies([
      { name: "smmplan_tenant", value: "flux", domain: "127.0.0.1", path: "/" },
      { name: "smmplan_theme", value: "light", domain: "127.0.0.1", path: "/" },
    ]);

    const page = await context.newPage();
    await page.goto(`${STAGE_URL}/?tenant=flux`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(500);

    // Step 1 -> Step 2: Open catalog
    console.log("Clicking 'Выбрать из каталога'...");
    await page.click("button:has-text('Выбрать из каталога')");
    await page.waitForTimeout(500);

    // Step 2 -> Step 3: Click Telegram
    console.log("Clicking 'Telegram'...");
    await page.click("button:has-text('Telegram')");
    await page.waitForTimeout(600);

    // Step 3 -> Step 4: Click first category (role="button")
    console.log("Clicking first category div[role='button']...");
    const firstCat = page.locator("div[role='button']").first();
    await firstCat.click();
    await page.waitForTimeout(600);

    // Step 4 -> Step 5: Click first service (role="button")
    console.log("Clicking first service div[role='button']...");
    const firstService = page.locator("div[role='button']").first();
    await firstService.click();
    await page.waitForTimeout(800);

    // Step 5: Checkout screen
    console.log("Scrolling to checkout button...");
    const btn = page.locator("button:has-text('Перейти к оплате')");
    await btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    console.log("Taking screenshot of checkout step...");
    const checkoutPath = path.join(OUTPUT_DIR, "flux-checkout-step-fixed.png");
    await page.screenshot({ path: checkoutPath });
    console.log(`📸 Saved checkout screenshot: ${checkoutPath}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
