import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const STAGE_URL = "http://127.0.0.1:3005";
const OUTPUT_DIR = path.resolve(process.cwd(), ".planning", "stage_visuals");

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("🚀 Launching Playwright Chromium (msedge) visual audit for SMMflux on Stage (:3005)...");
  const browser = await chromium.launch({ channel: "msedge", headless: true });

  try {
    // 1. Desktop Test (1440x900)
    console.log("\n--- [1/2] Desktop Audit (1440x900) ---");
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: {
        "x-tenant-id": "flux",
      },
    });

    await desktopContext.addCookies([
      { name: "smmplan_tenant", value: "flux", domain: "127.0.0.1", path: "/" },
      { name: "smmplan_theme", value: "light", domain: "127.0.0.1", path: "/" },
    ]);

    const page = await desktopContext.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    console.log(`Navigating to ${STAGE_URL}/?tenant=flux...`);
    await page.goto(`${STAGE_URL}/?tenant=flux`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    // Measure horizontal scroll on hero
    const desktopHeroOverflow = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      return { scrollW, innerW, overflowX: Math.max(0, scrollW - innerW) };
    });
    console.log(`Desktop Hero Scroll: scrollWidth=${desktopHeroOverflow.scrollW}, innerWidth=${desktopHeroOverflow.innerW}, overflowX=${desktopHeroOverflow.overflowX}px`);

    const heroScreenshotPath = path.join(OUTPUT_DIR, "flux-desktop-hero-elastic-gradient.png");
    await page.screenshot({ path: heroScreenshotPath });
    console.log(`📸 Saved hero screenshot: ${heroScreenshotPath}`);

    // Click "Выбрать из каталога" to open Step 2 (Network catalog)
    console.log("Navigating to Catalog step...");
    const openCatalogBtn = page.locator("button:has-text('Выбрать из каталога')");
    if (await openCatalogBtn.isVisible()) {
      await openCatalogBtn.click();
      await page.waitForTimeout(600);
    }

    // Measure horizontal scroll on catalog step
    const desktopCatalogOverflow = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      return { scrollW, innerW, overflowX: Math.max(0, scrollW - innerW) };
    });
    console.log(`Desktop Catalog Scroll: scrollWidth=${desktopCatalogOverflow.scrollW}, innerWidth=${desktopCatalogOverflow.innerW}, overflowX=${desktopCatalogOverflow.overflowX}px`);

    // Verify Tier 1 Top-6 CIS Quick Access
    const top6Title = await page.locator("text=Быстрый выбор (ТОП СНГ)").isVisible();
    const telegramVisible = await page.locator("button:has-text('Telegram')").first().isVisible();
    const vkVisible = await page.locator("button:has-text('ВКонтакте')").first().isVisible();
    const youtubeVisible = await page.locator("button:has-text('YouTube')").first().isVisible();
    console.log(`Top-6 Header visible: ${top6Title}`);
    console.log(`Top CIS platforms visible: Telegram=${telegramVisible}, VK=${vkVisible}, YouTube=${youtubeVisible}`);

    const catalogScreenshotPath = path.join(OUTPUT_DIR, "flux-desktop-catalog-high-density.png");
    await page.screenshot({ path: catalogScreenshotPath });
    console.log(`📸 Saved catalog screenshot: ${catalogScreenshotPath}`);

    // Test Search Input
    console.log("Testing search input with query 'Pikabu'...");
    const searchInput = page.locator("input[placeholder='Поиск платформы...']");
    if (await searchInput.isVisible()) {
      await searchInput.fill("Pikabu");
      await page.waitForTimeout(400);

      const foundLabel = await page.locator("text=Найдено (1)").isVisible();
      const pikabuCard = await page.locator("button:has-text('Pikabu')").isVisible();
      console.log(`Search result: 'Найдено (1)' visible=${foundLabel}, Pikabu card visible=${pikabuCard}`);

      const searchScreenshotPath = path.join(OUTPUT_DIR, "flux-desktop-catalog-search-filtered.png");
      await page.screenshot({ path: searchScreenshotPath });
      console.log(`📸 Saved search screenshot: ${searchScreenshotPath}`);

      // Clear search
      await searchInput.fill("");
      await page.waitForTimeout(300);

      // Test Russian Cyrillic search query 'ютуб'
      console.log("Testing search input with Cyrillic query 'ютуб'...");
      await searchInput.fill("ютуб");
      await page.waitForTimeout(400);
      const ytCard = await page.locator("button:has-text('YouTube')").isVisible();
      console.log(`Cyrillic search result: YouTube card visible=${ytCard}`);
      if (!ytCard) {
        throw new Error("Cyrillic search query 'ютуб' failed to find YouTube!");
      }
      await searchInput.fill("");
      await page.waitForTimeout(300);
    }

    await desktopContext.close();

    // 2. Mobile Audit (iPhone 14 - 390x844)
    console.log("\n--- [2/2] Mobile Audit (iPhone 14: 390x844, Touch) ---");
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      extraHTTPHeaders: {
        "x-tenant-id": "flux",
      },
    });

    await mobileContext.addCookies([
      { name: "smmplan_tenant", value: "flux", domain: "127.0.0.1", path: "/" },
      { name: "smmplan_theme", value: "light", domain: "127.0.0.1", path: "/" },
    ]);

    const mobilePage = await mobileContext.newPage();
    console.log(`Navigating mobile to ${STAGE_URL}/?tenant=flux...`);
    await mobilePage.goto(`${STAGE_URL}/?tenant=flux`, { waitUntil: "networkidle", timeout: 30000 });
    await mobilePage.waitForTimeout(1000);

    const mobileHeroOverflow = await mobilePage.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      return { scrollW, innerW, overflowX: Math.max(0, scrollW - innerW) };
    });
    console.log(`Mobile Hero Scroll: scrollWidth=${mobileHeroOverflow.scrollW}, innerWidth=${mobileHeroOverflow.innerW}, overflowX=${mobileHeroOverflow.overflowX}px`);

    const mobileHeroScreenshotPath = path.join(OUTPUT_DIR, "flux-mobile-zero-scroll.png");
    await mobilePage.screenshot({ path: mobileHeroScreenshotPath });
    console.log(`📸 Saved mobile hero screenshot: ${mobileHeroScreenshotPath}`);

    // Click Catalog on mobile via plus button
    const mobileCatalogBtn = mobilePage.locator("[data-testid='flux-open-catalog-btn']");
    if (await mobileCatalogBtn.isVisible()) {
      await mobileCatalogBtn.click();
      await mobilePage.waitForTimeout(600);
    }

    const mobileCatalogOverflow = await mobilePage.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      return { scrollW, innerW, overflowX: Math.max(0, scrollW - innerW) };
    });
    console.log(`Mobile Catalog Scroll: scrollWidth=${mobileCatalogOverflow.scrollW}, innerWidth=${mobileCatalogOverflow.innerW}, overflowX=${mobileCatalogOverflow.overflowX}px`);

    // Measure touch target sizes
    const touchTargetSafety = await mobilePage.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const violations: string[] = [];
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          if (rect.height < 40 && !btn.className.includes("p-0.5")) {
            violations.push(`${btn.textContent?.trim().slice(0, 20)}: ${rect.height}px`);
          }
        }
      }
      return { violationsCount: violations.length, violations };
    });
    console.log(`Touch Target Audit: violations=${touchTargetSafety.violationsCount}`);

    const mobileCatalogScreenshotPath = path.join(OUTPUT_DIR, "flux-mobile-catalog.png");
    await mobilePage.screenshot({ path: mobileCatalogScreenshotPath });
    console.log(`📸 Saved mobile catalog screenshot: ${mobileCatalogScreenshotPath}`);

    await mobileContext.close();

    console.log("\n=======================================================");
    console.log("🎉 Visual Audit Summary on Stage (:3005):");
    console.log(`- Desktop overflowX: ${desktopHeroOverflow.overflowX}px (hero), ${desktopCatalogOverflow.overflowX}px (catalog)`);
    console.log(`- Mobile overflowX: ${mobileHeroOverflow.overflowX}px (hero), ${mobileCatalogOverflow.overflowX}px (catalog)`);
    console.log(`- Console errors count: ${consoleErrors.length}`);
    console.log("=======================================================");

    if (desktopCatalogOverflow.overflowX > 0 || mobileCatalogOverflow.overflowX > 0) {
      throw new Error("Horizontal overflow detected on Stage!");
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL in verify-flux-stage-visual:", err);
  process.exit(1);
});
