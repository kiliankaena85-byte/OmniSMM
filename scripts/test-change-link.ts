import { chromium, devices } from "@playwright/test";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const iPhone = devices["iPhone 12"];
  const context = await browser.newContext({ ...iPhone });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const cookieBtn = await page.$('button:has-text("Принять и продолжить")');
  if (cookieBtn) await cookieBtn.click();

  const urlInput = await page.$("#standard-url-input") || await page.$('input[placeholder*="t.me"]');
  if (urlInput) {
    await urlInput.fill("https://t.me/durov");
    await page.waitForTimeout(1500);
  }

  const serviceCard = await page.$('div:has-text("Telegram Подписчики")');
  if (serviceCard) {
    await serviceCard.click();
    await page.waitForTimeout(1500);
  }

  console.log("Currently on Step 4. Testing 'Сменить' link button...");
  const changeLinkBtn = await page.$('button:has-text("Сменить")') || await page.$('button:has-text("Изменить")');
  if (changeLinkBtn) {
    await changeLinkBtn.click();
    await page.waitForTimeout(1000);
    const step1Visible = await page.$('#standard-url-input');
    const step4Visible = await page.$('button:has-text("Заказать")');
    console.log("Result after clicking 'Сменить' link:");
    console.log("  Is Step 1 input visible?", !!step1Visible);
    console.log("  Is Step 4 still visible?", !!step4Visible);
  } else {
    console.log("Change link button NOT found!");
  }

  await browser.close();
}

main().catch(console.error);
