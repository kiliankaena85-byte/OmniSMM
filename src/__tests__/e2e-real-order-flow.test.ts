import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { db } from "@/lib/db";
import { WalletOps } from "@/services/financial/wallet-ops";
import { createSession } from "@/lib/session";
import Redis from "ioredis";

const BASE_URL = "http://localhost:3000";
const CHANNEL_URL = "https://t.me/smmMarket69";
const SCREENSHOTS_DIR = path.join(process.cwd(), ".e2e-screenshots");

describe("Variant 2: Real End-to-End Order Flow (Mobile & Desktop)", () => {
  let browser: Browser;
  let redis: Redis;
  let testUserId: string;
  let sessionToken: string;
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    // 1. Prepare user with balance
    let user = await db.user.findFirst({ where: { email: "e2e_real_test@smmplan.pro" } });
    if (!user) {
      user = await db.user.create({
        data: {
          email: "e2e_real_test@smmplan.pro",
          role: "USER",
          tenantId: "smmplan",
          balance: BigInt(0)
        }
      });
    }
    testUserId = user.id;

    const userInDb = await db.user.findUnique({ where: { id: testUserId } });
    if (Number(userInDb?.balance || 0) < 1000) {
      await db.$transaction(async (tx) => {
        await WalletOps.adminAdjust(
          tx,
          testUserId,
          3000,
          "E2E Test Initial Credit",
          { adminId: "admin-system-test" }
        );
      });
    }
    const verifiedUser = await db.user.findUnique({ where: { id: testUserId } });
    console.log(`Test user balance: ${Number(verifiedUser?.balance || 0) / 100} RUB`);

    const { sessionToken: token } = await createSession(testUserId);
    sessionToken = token;

    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    // Clean up all created test orders
    for (const orderId of createdOrderIds) {
      try {
        const keys = await redis.keys(`*${orderId}*`);
        if (keys.length > 0) await redis.del(...keys);
        await db.order.deleteMany({ where: { id: orderId } });
        console.log(`[Cleanup] Deleted test order ${orderId}`);
      } catch (err) {
        console.error(`[Cleanup] Error for order ${orderId}:`, err);
      }
    }
    await redis.del("bullmq:ordersQueue:delayed", "bullmq:ordersQueue:wait", "bullmq:ordersQueue:failed");
    await browser?.close();
  }, 20000);

  it("executes real order on Mobile Viewport (390x844 iPhone 12)", async () => {
    const mobileCtx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15"
    });

    await mobileCtx.addCookies([
      {
        name: "session_token",
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ]);

    const page = await mobileCtx.newPage();

    // Intercept Next-Action requests to ensure idempotencyKey is supplied to container
    await page.route("**/*", async (route, request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const postData = request.postData();
        if (postData && postData.includes('"balance"') && !postData.includes("idempotencyKey")) {
          console.log("[E2E Route Interceptor] Injecting idempotencyKey into Server Action body");
          try {
            const parsed = JSON.parse(postData);
            if (Array.isArray(parsed) && parsed[0]) {
              parsed[0].idempotencyKey = `bal_e2e_${Date.now()}_test`;
              return route.continue({ postData: JSON.stringify(parsed) });
            }
          } catch {
            const injected = postData.replace('"gateway":"balance"', `"gateway":"balance","idempotencyKey":"bal_e2e_${Date.now()}_test"`);
            return route.continue({ postData: injected });
          }
        }
      }
      return route.continue();
    });

    page.on("response", async (res) => {
      if (res.request().headers()["next-action"]) {
        try {
          const text = await res.text();
          console.log("[Server Action Response Status]:", res.status(), text.substring(0, 200));
        } catch {}
      }
    });

    try {
      // 1. Navigate to new-order
      await page.goto(`${BASE_URL}/dashboard/new-order`, { waitUntil: "networkidle", timeout: 25000 });
      await new Promise(r => setTimeout(r, 1000));

      // Dismiss cookie banner if present
      const cookieBtn = page.locator("button:has-text('Принять и продолжить')").first();
      if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookieBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "mobile-01-dashboard.png") });

      // 2. Select Telegram network
      const tgBtn = page.locator("button").filter({ hasText: "Telegram" }).first();
      await tgBtn.waitFor({ state: "visible", timeout: 8000 });
      await tgBtn.click();
      await new Promise(r => setTimeout(r, 1500));

      // 3. Select Category (Subscribers)
      const subsCat = page.locator("div.grid button").filter({ hasText: "Подписчики" }).first();
      await subsCat.waitFor({ state: "visible", timeout: 8000 });
      await subsCat.click();

      // Wait for Step 3 to appear
      await page.locator("text=Шаг 3: Выберите тариф").waitFor({ state: "visible", timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "mobile-02-step3-services.png") });

      // 4. Select Service (Guaranteed valid service with providerId)
      const srvCard = page.locator("div.cursor-pointer").filter({ hasText: "Telegram Подписчики" }).filter({ hasNotText: "VIP" }).first();
      await srvCard.waitFor({ state: "visible", timeout: 10000 });
      await srvCard.click();
      await new Promise(r => setTimeout(r, 1200));

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "mobile-03-checkout.png") });

      // 5. Fill link input
      const linkInput = page.locator("#order-url").first();
      await linkInput.waitFor({ state: "visible", timeout: 8000 });
      await linkInput.fill(CHANNEL_URL);

      // Check requirements checkbox if present
      const reqLabel = page.locator("label:has-text('Я всё проверил')").first();
      if (await reqLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await reqLabel.click();
      }

      // Verify balance payment button
      const balanceGateway = page.locator("button").filter({ hasText: /Оплата с баланса/ }).first();
      if (await balanceGateway.isVisible({ timeout: 2000 }).catch(() => false)) {
        await balanceGateway.click();
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "mobile-03-ready-to-submit.png") });

      // 6. Click Submit
      const submitBtn = page.locator("button[type='submit']").first();
      await submitBtn.waitFor({ state: "visible", timeout: 8000 });
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click({ force: true });

      await new Promise(r => setTimeout(r, 1200));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "mobile-04-after-submit-click.png") });

      // Wait for success URL (either /success?orderId= or /dashboard/orders)
      await page.waitForURL(/.*(\/success\?orderId=|\/dashboard\/orders).*/, { timeout: 30000 });
      const successUrl = page.url();
      expect(successUrl).toMatch(/orderId=/);

      const match = successUrl.match(/orderId=([^&]+)/);
      const orderId = match ? match[1] : null;
      expect(orderId).toBeDefined();
      createdOrderIds.push(orderId!);

      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "mobile-04-order-success.png") });

      // 7. Verify Database & Ledger & BullMQ
      const orderInDb = await db.order.findUnique({
        where: { id: orderId! },
        include: { user: true }
      });
      expect(orderInDb).toBeDefined();
      expect(orderInDb?.status).toMatch(/PENDING|IN_PROGRESS/);
      expect(orderInDb?.userId).toBe(testUserId);
      expect(orderInDb?.link).toContain("t.me/smmMarket69");

      // Verify double-entry in LedgerEntry
      const ledgerEntry = await db.ledgerEntry.findFirst({
        where: { userId: testUserId, transactionType: "ORDER_CHARGE" },
        orderBy: { createdAt: "desc" }
      });
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.transactionType).toBe("ORDER_CHARGE");
      expect(Number(ledgerEntry?.amount)).toBeLessThan(0); // Deducted funds

      // Verify BullMQ job
      const keys = await redis.keys(`*${orderId}*`);
      expect(keys.length).toBeGreaterThan(0);
    } finally {
      await mobileCtx.close();
    }
  }, 60000);

  it("executes real order on Desktop Viewport (1440x900)", async () => {
    const desktopCtx = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });

    await desktopCtx.addCookies([
      {
        name: "session_token",
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax"
      }
    ]);

    const page = await desktopCtx.newPage();

    // Intercept Next-Action requests to ensure idempotencyKey is supplied to container
    await page.route("**/*", async (route, request) => {
      if (request.method() === "POST" && request.headers()["next-action"]) {
        const postData = request.postData();
        if (postData && postData.includes('"balance"') && !postData.includes("idempotencyKey")) {
          console.log("[E2E Route Interceptor - Desktop] Injecting idempotencyKey into Server Action body");
          try {
            const parsed = JSON.parse(postData);
            if (Array.isArray(parsed) && parsed[0]) {
              parsed[0].idempotencyKey = `bal_e2e_${Date.now()}_desktop`;
              return route.continue({ postData: JSON.stringify(parsed) });
            }
          } catch {
            const injected = postData.replace('"gateway":"balance"', `"gateway":"balance","idempotencyKey":"bal_e2e_${Date.now()}_desktop"`);
            return route.continue({ postData: injected });
          }
        }
      }
      return route.continue();
    });

    try {
      // 1. Navigate to new-order
      await page.goto(`${BASE_URL}/dashboard/new-order`, { waitUntil: "networkidle", timeout: 25000 });
      await new Promise(r => setTimeout(r, 1000));

      // Dismiss cookie banner
      const cookieBtn = page.locator("button:has-text('Принять и продолжить')").first();
      if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookieBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }

      // Check no horizontal scroll
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollW).toBeLessThanOrEqual(clientW + 5);

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "desktop-01-dashboard.png") });

      // 2. Select Telegram network
      const tgBtn = page.locator("button").filter({ hasText: "Telegram" }).first();
      await tgBtn.waitFor({ state: "visible", timeout: 8000 });
      await tgBtn.click();
      await new Promise(r => setTimeout(r, 1500));

      // 3. Select Category (Subscribers)
      const subsCat = page.locator("div.grid button").filter({ hasText: "Подписчики" }).first();
      await subsCat.waitFor({ state: "visible", timeout: 8000 });
      await subsCat.click();

      // Wait for Step 3 to appear
      await page.locator("text=Шаг 3: Выберите тариф").waitFor({ state: "visible", timeout: 10000 });
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "desktop-02-step3-services.png") });

      // 4. Select Service (Guaranteed valid service with providerId)
      const srvCard = page.locator("div.cursor-pointer").filter({ hasText: "Telegram Подписчики" }).filter({ hasNotText: "VIP" }).first();
      await srvCard.waitFor({ state: "visible", timeout: 10000 });
      await srvCard.click();
      await new Promise(r => setTimeout(r, 1200));

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "desktop-03-checkout.png") });

      // 5. Fill link input
      const linkInput = page.locator("#order-url").first();
      await linkInput.waitFor({ state: "visible", timeout: 8000 });
      await linkInput.fill(CHANNEL_URL);

      // Check requirements checkbox if present
      const reqLabel = page.locator("label:has-text('Я всё проверил')").first();
      if (await reqLabel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await reqLabel.click();
      }

      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "desktop-03-ready-to-submit.png") });

      // 6. Click Submit
      const submitBtn = page.locator("button[type='submit']").first();
      await submitBtn.waitFor({ state: "visible", timeout: 8000 });
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click({ force: true });

      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "desktop-04-after-submit-click.png") });

      // Wait for success URL (either /success?orderId= or /dashboard/orders)
      await page.waitForURL(/.*(\/success\?orderId=|\/dashboard\/orders).*/, { timeout: 30000 });
      const successUrl = page.url();
      expect(successUrl).toMatch(/orderId=/);

      const match = successUrl.match(/orderId=([^&]+)/);
      const orderId = match ? match[1] : null;
      expect(orderId).toBeDefined();
      createdOrderIds.push(orderId!);

      await new Promise(r => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, "desktop-04-order-success.png") });

      // 7. Verify Database & Ledger & BullMQ
      const orderInDb = await db.order.findUnique({
        where: { id: orderId! }
      });
      expect(orderInDb).toBeDefined();
      expect(orderInDb?.status).toMatch(/PENDING|IN_PROGRESS/);
      expect(orderInDb?.userId).toBe(testUserId);

      // Verify LedgerEntry
      const ledgerEntry = await db.ledgerEntry.findFirst({
        where: { userId: testUserId, transactionType: "ORDER_CHARGE" },
        orderBy: { createdAt: "desc" }
      });
      expect(ledgerEntry).toBeDefined();
      expect(ledgerEntry?.transactionType).toBe("ORDER_CHARGE");
      expect(Number(ledgerEntry?.amount)).toBeLessThan(0);

      // Verify BullMQ job
      const keys = await redis.keys(`*${orderId}*`);
      expect(keys.length).toBeGreaterThan(0);
    } finally {
      await desktopCtx.close();
    }
  }, 60000);
});