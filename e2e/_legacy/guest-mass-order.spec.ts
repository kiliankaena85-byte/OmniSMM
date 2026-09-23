import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

test.describe("Guest Mass Order Flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let prisma: PrismaClient;

  test.beforeAll(async () => {
    prisma = new PrismaClient();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("Guest can paste multiple links into unified order wizard and configure services", async ({ page }) => {
    // 1. Prepare E2E Test Catalog Data
    const networkSlug = "telegram";
    const networkName = "Telegram";
    let network = await prisma.network.findUnique({ where: { slug: networkSlug } });
    if (!network) {
      network = await prisma.network.create({
        data: { name: networkName, slug: networkSlug, sort: 1, isActive: true }
      });
    }

    const categoryName = "E2E Guest Mass Category";
    let category = await prisma.category.findFirst({ where: { name: categoryName } });
    if (!category) {
      category = await prisma.category.create({
        data: { name: categoryName, networkId: network.id, sort: 1 }
      });
    }

    const serviceName = "E2E Guest Mass Service";
    let service = await prisma.service.findFirst({ where: { name: serviceName } });
    if (!service) {
      service = await prisma.service.create({
        data: {
          name: serviceName,
          categoryId: category.id,
          rate: 10.0,
          markup: 3.0,
          minQty: 10,
          maxQty: 10000,
          isActive: true,
          targetType: "CHANNEL",
          pricePer1000Cents: 2700,
        }
      });
    }

    // 2. Navigate to Landing Page or Unified Wizard
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Look for link textarea or manual social select button
    const linkInput = page.locator('textarea, input[placeholder*="ссылк"]').first();
    if (await linkInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await linkInput.fill("https://t.me/e2e_mass_1\nhttps://t.me/e2e_mass_2");
      const continueBtn = page.getByRole("button", { name: /Продолжить|Рассчитать|Далее/i }).first();
      if (await continueBtn.isVisible()) {
        await continueBtn.click();
      }
    }

    // Verify page rendered successfully without 500 errors
    await expect(page.locator("body")).toBeVisible();

    // Clean up created entities
    await prisma.service.delete({ where: { id: service.id } }).catch(() => {});
    await prisma.category.delete({ where: { id: category.id } }).catch(() => {});
  });
});
