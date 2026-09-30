import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const STAGE_URL = "http://127.0.0.1:3005";
const OUTPUT_DIR = path.resolve(process.cwd(), ".planning", "stage_visuals");

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

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
    await page.waitForTimeout(1000);

    // 1. Full page screenshot
    const fullPagePath = path.join(OUTPUT_DIR, "flux-fullpage-current.png");
    await page.screenshot({ path: fullPagePath, fullPage: true });
    console.log(`📸 Saved fullpage screenshot: ${fullPagePath}`);

    // 2. Scroll to Why Us section
    const whyUsSection = page.locator("#why-us-heading");
    if (await whyUsSection.isVisible()) {
      await whyUsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const whyUsPath = path.join(OUTPUT_DIR, "flux-why-us-section.png");
      await page.screenshot({ path: whyUsPath });
      console.log(`📸 Saved Why Us screenshot: ${whyUsPath}`);
    }

    // 3. Scroll to Reviews and FAQ
    const faqSection = page.locator("#faq");
    if (await faqSection.isVisible()) {
      await faqSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const faqPath = path.join(OUTPUT_DIR, "flux-faq-section.png");
      await page.screenshot({ path: faqPath });
      console.log(`📸 Saved FAQ screenshot: ${faqPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
