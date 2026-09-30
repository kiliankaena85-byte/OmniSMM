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

    // 1. Updated Hero (No duplicate subtitle, vibrant aurora)
    const heroPath = path.join(OUTPUT_DIR, "flux-hero-updated-vibrant.png");
    await page.screenshot({ path: heroPath });
    console.log(`📸 Saved updated hero: ${heroPath}`);

    // 2. Updated Why Us (Bento Grid with dark API card and contrast)
    const whyUsSection = page.locator("#why-us-heading");
    if (await whyUsSection.isVisible()) {
      await whyUsSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const whyUsPath = path.join(OUTPUT_DIR, "flux-why-us-updated-contrast.png");
      await page.screenshot({ path: whyUsPath });
      console.log(`📸 Saved updated Why Us: ${whyUsPath}`);
    }

    // 3. Updated FAQ & Reviews
    const faqSection = page.locator("#faq");
    if (await faqSection.isVisible()) {
      await faqSection.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const faqPath = path.join(OUTPUT_DIR, "flux-faq-updated-contrast.png");
      await page.screenshot({ path: faqPath });
      console.log(`📸 Saved updated FAQ: ${faqPath}`);
    }

    // 4. Test Checkout Button
    console.log("Navigating to checkout step to verify button...");
    await page.goto(`${STAGE_URL}/?tenant=flux`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const catalogBtn = page.locator("button:has-text('Выбрать из каталога')");
    if (await catalogBtn.isVisible()) {
      await catalogBtn.click();
      await page.waitForTimeout(600);
      const tgCard = page.locator("button:has-text('Telegram')").first();
      if (await tgCard.isVisible()) {
        await tgCard.click();
        await page.waitForTimeout(600);
        // Click first service
        const serviceCard = page.locator("button:has-text('Выбрать')").first();
        if (await serviceCard.isVisible()) {
          await serviceCard.click();
          await page.waitForTimeout(800);
          const checkoutBtn = page.locator("button:has-text('Перейти к оплате')");
          if (await checkoutBtn.isVisible()) {
            await checkoutBtn.scrollIntoViewIfNeeded();
            const checkoutPath = path.join(OUTPUT_DIR, "flux-checkout-button-fixed.png");
            await page.screenshot({ path: checkoutPath });
            console.log(`📸 Saved fixed checkout button screenshot: ${checkoutPath}`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
