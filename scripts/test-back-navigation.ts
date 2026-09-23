import { chromium, devices } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const iPhone = devices["iPhone 12"];
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Dismiss cookie
  const cookieBtn = await page.$('button:has-text("Принять и продолжить")');
  if (cookieBtn) await cookieBtn.click();

  // Enter link
  const urlInput = await page.$("#standard-url-input") || await page.$('input[placeholder*="t.me"]');
  if (urlInput) {
    await urlInput.fill("https://t.me/durov");
    await page.waitForTimeout(1500);
  }

  // Click service
  const serviceCard = await page.$('div:has-text("Telegram Подписчики")');
  if (serviceCard) {
    await serviceCard.click();
    await page.waitForTimeout(1500);
  }

  console.log("Currently on Step 4. Looking for 'Назад к тарифам' button...");
  const backBtn = await page.$('button:has-text("Назад к тарифам")');
  if (backBtn) {
    console.log("Found back button, clicking it...");
    await backBtn.click();
    await page.waitForTimeout(1000);

    // Check if we are on Step 3 or back on Step 4!
    const step4Visible = await page.$('button:has-text("Заказать")');
    const step3Visible = await page.$('span:has-text("3. Выберите тариф")');
    console.log("Result after clicking 'Назад к тарифам':");
    console.log("  Is Step 3 visible?", !!step3Visible);
    console.log("  Is Step 4 still visible?", !!step4Visible);
  } else {
    console.log("Back button NOT found!");
  }

  await browser.close();
}

main().catch(console.error);
