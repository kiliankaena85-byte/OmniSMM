import { chromium, devices } from "@playwright/test";
import * as path from "path";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const iPhone = devices["iPhone 12"];
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  console.log("1. Navigating to homepage...");
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Dismiss cookie
  const cookieBtn = await page.$('button:has-text("Принять и продолжить")');
  if (cookieBtn) await cookieBtn.click();

  // 1. Screenshot Step 1 Empty with Quick Shortcuts
  await page.screenshot({ path: "scripts/smart_step1_empty.png" });
  console.log("Saved scripts/smart_step1_empty.png");

  // Verify quick platform shortcuts exist
  const tgShortcut = await page.$('button:has-text("Telegram")');
  const vkShortcut = await page.$('button:has-text("ВКонтакте")');
  console.log("Quick shortcuts visible:", !!tgShortcut && !!vkShortcut);

  // 2. Type Telegram post URL
  console.log("2. Typing post link: https://t.me/durov/123 ...");
  const urlInput = await page.$("#standard-url-input");
  if (urlInput) {
    await urlInput.fill("https://t.me/durov/123");
  }
  await page.waitForTimeout(2000);

  // Screenshot Step 1 with Live Badge
  await page.screenshot({ path: "scripts/smart_step1_detected.png" });
  console.log("Saved scripts/smart_step1_detected.png");

  // Verify live badge
  const liveBadge = await page.$('text=Публикация / Пост');
  console.log("Live post detection badge visible:", !!liveBadge);

  // Check Step 2 (Categories for post)
  const step2Text = await page.innerText("body");
  const hasCompatibleCatNotice = step2Text.includes("Подобрано для поста");
  console.log("Step 2 auto-adapted for post link:", hasCompatibleCatNotice);

  await page.screenshot({ path: "scripts/smart_step2_categories.png" });
  console.log("Saved scripts/smart_step2_categories.png");

  // Select a category (e.g. Просмотры or Реакции)
  const catBtn = await page.$('button:has-text("Просмотры"), button:has-text("Реакции")');
  if (catBtn) {
    await catBtn.click();
    await page.waitForTimeout(1500);
  }

  // Screenshot Step 3 with Rule of 3 Tariffs
  await page.screenshot({ path: "scripts/smart_step3_tariffs.png" });
  console.log("Saved scripts/smart_step3_tariffs.png");

  // Select first tariff
  const tariffBtn = await page.$('button:has-text("Telegram Просмотры на пост"), button:has-text("Просмотры - Живые")');
  if (tariffBtn) {
    console.log("Clicking tariff card...");
    await tariffBtn.click();
    await page.waitForTimeout(2000);
  }

  // Screenshot Step 4 Checkout
  await page.screenshot({ path: "scripts/smart_step4_checkout.png" });
  console.log("Saved scripts/smart_step4_checkout.png");

  await browser.close();
  console.log("SUCCESS: Smart Adaptive Flow E2E test finished!");
}

main().catch(err => {
  console.error("E2E Test Error:", err);
  process.exit(1);
});
