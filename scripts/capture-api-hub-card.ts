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

    // Scroll to API Hub card
    const apiHubHeading = page.locator("h3:has-text('Решения для Реселлеров')");
    if (await apiHubHeading.isVisible()) {
      await apiHubHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const cardPath = path.join(OUTPUT_DIR, "flux-why-us-api-hub-card.png");
      await page.screenshot({ path: cardPath });
      console.log(`📸 Saved API Hub card screenshot: ${cardPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
