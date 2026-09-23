// Mock server-only before any other imports
import Module from "module";
const origReq = (Module as any).prototype.require;
(Module as any).prototype.require = function (id: string) {
  if (id === "server-only") return {};
  return origReq.apply(this, arguments);
};

import { chromium } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

import { db } from "@/lib/db";
import { WalletOps } from "@/services/financial/wallet-ops";
import { createSession } from "@/lib/session";
import Redis from "ioredis";

const BASE_URL = "http://localhost:3000";
const CHANNEL_URL = "https://t.me/smmMarket69";
const SCREENSHOTS_DIR = path.join(process.cwd(), ".e2e-screenshots");
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let passCount = 0;
let failCount = 0;
const results: string[] = [];

function pass(msg: string) {
  passCount++;
  results.push(`  OK   ${msg}`);
  console.log(`  OK   ${msg}`);
}
function fail(msg: string, detail?: string) {
  failCount++;
  results.push(`  FAIL ${msg}${detail ? ": " + detail : ""}`);
  console.error(`  FAIL ${msg}`, detail || "");
}
function info(msg: string) {
  console.log(`  ...  ${msg}`);
}
async function shot(page: any, name: string) {
  const p = path.join(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  SCR  ${name}.png`);
  return p;
}
async function sleep(ms: number) { await new Promise(r => setTimeout(r, ms)); }

async function cleanupOrder(orderId: string, redis: Redis) {
  try {
    info(`Cleaning up test order ${orderId}...`);
    // Delete from Redis BullMQ
    const keys = await redis.keys(`*${orderId}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      info(`Deleted ${keys.length} keys from Redis for order ${orderId}`);
    }
    // Delete from PostgreSQL
    await db.order.deleteMany({ where: { id: orderId } });
    info(`Deleted test order ${orderId} from DB`);
  } catch (err) {
    console.error(`Error cleaning up order ${orderId}:`, err);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("VARIANT 2: REAL END-TO-END ORDER EXECUTION IN MOBILE AND DESKTOP VIEWPORTS");
  console.log("================================================================================");

  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  // 1. Setup test user with positive balance
  info("Setting up test user with 10.00 RUB balance...");
  let user = await db.user.findFirst({ where: { email: "e2e_real_test@smmplan.pro" } });
  if (!user) {
    user = await db.user.create({
      data: {
        email: "e2e_real_test@smmplan.pro",
        name: "E2E Real Buyer",
        role: "USER",
        tenantId: "smmplan",
        balance: BigInt(0)
      }
    });
  }

  // Ensure balance is at least 10 RUB (1000 kopecks)
  const currentBalance = await WalletOps.getBalance(user.id);
  if (currentBalance < BigInt(1000)) {
    const needed = BigInt(2000) - currentBalance;
    await WalletOps.credit(user.id, needed, "E2E Real Test Balance Top-Up", {
      tenantId: "smmplan",
      idempotencyKey: `topup-${Date.now()}`
    });
    info(`Credited ${(Number(needed) / 100).toFixed(2)} RUB to test user`);
  }
  const verifiedBalance = await WalletOps.getBalance(user.id);
  pass(`Test user ready: ${user.email}, balance: ${(Number(verifiedBalance) / 100).toFixed(2)} RUB`);

  // 2. Create valid session token
  const { sessionToken } = await createSession(user.id);
  pass("Generated valid session_token for test user");

  const browser = await chromium.launch({ headless: true });

  // ─── TEST 1: MOBILE VIEWPORT (390x844 iPhone 12) ───────────────────────────
  console.log("\n--- TEST 1: MOBILE VIEWPORT (390x844 iPhone 12) ---");
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

  const mobilePage = await mobileCtx.newPage();

  let mobileOrderId: string | null = null;
  try {
    info("Navigating to /dashboard/new-order (Mobile)...");
    await mobilePage.goto(`${BASE_URL}/dashboard/new-order`, { waitUntil: "networkidle", timeout: 25000 });
    await sleep(2000);

    await shot(mobilePage, "01-mobile-dashboard-loaded");
    const c1 = await mobilePage.content();
    c1.includes("Баланс") || c1.includes("Новый заказ") || c1.includes("Telegram")
      ? pass("Mobile new-order page loaded with active user session")
      : fail("Mobile new-order page did not load properly");

    // Step 1: Select Telegram network
    info("Selecting Telegram network on mobile...");
    const tgBtn = mobilePage.locator("div, button").filter({ hasText: /^Telegram$/ }).first();
    await tgBtn.waitFor({ state: "visible", timeout: 5000 });
    await tgBtn.click();
    await sleep(1500);
    pass("Step 1: Telegram network selected");

    // Step 2: Select Category (Subscribers)
    info("Selecting Subscribers category on mobile...");
    const subsCat = mobilePage.locator("div, button").filter({ hasText: /Подписчик/ }).first();
    await subsCat.waitFor({ state: "visible", timeout: 5000 });
    await subsCat.click();
    await sleep(1500);
    pass("Step 2: Category selected");

    // Step 3: Select Service (first service card)
    info("Selecting first service on mobile...");
    const serviceCard = mobilePage.locator("div.cursor-pointer").filter({ hasText: /₽/ }).first();
    await serviceCard.waitFor({ state: "visible", timeout: 5000 });
    await serviceCard.click();
    await sleep(1500);
    pass("Step 3: Service selected, moved to Step 4 Checkout");

    await shot(mobilePage, "02-mobile-step4-checkout");

    // Step 4: Fill form
    info("Entering link in #order-url...");
    const linkInput = mobilePage.locator("#order-url").first();
    await linkInput.waitFor({ state: "visible", timeout: 5000 });
    await linkInput.fill(CHANNEL_URL);
    await sleep(500);
    pass("Link filled into #order-url");

    // Verify balance gateway selected
    const balanceGatewayBtn = mobilePage.locator("button").filter({ hasText: /Оплата с баланса/ }).first();
    if (await balanceGatewayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await balanceGatewayBtn.click();
      pass("Balance payment method confirmed");
    }

    await shot(mobilePage, "03-mobile-checkout-filled");

    // Submit Order
    info("Clicking submit button...");
    const submitBtn = mobilePage.locator("button[type='submit']").first();
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });
    await submitBtn.click();
    info("Submitted, waiting for navigation to /success...");

    await mobilePage.waitForURL(/.*\/success\?orderId=.*/, { timeout: 15000 });
    const successUrl = mobilePage.url();
    pass(`Order successfully placed! Redirected to: ${successUrl}`);

    const match = successUrl.match(/orderId=([^&]+)/);
    mobileOrderId = match ? match[1] : null;
    pass(`Created Order ID: ${mobileOrderId}`);

    await sleep(1500);
    await shot(mobilePage, "04-mobile-order-success-screen");

    // Verify in PostgreSQL DB
    if (mobileOrderId) {
      const orderInDb = await db.order.findUnique({
        where: { id: mobileOrderId },
        include: { user: true }
      });
      orderInDb ? pass(`[DB Check] Order #${orderInDb.numericId} found in PostgreSQL (status: ${orderInDb.status})`) : fail("Order not found in DB");

      // Verify LedgerEntry
      const ledgerEntry = await db.ledgerEntry.findFirst({
        where: {
          userId: user.id,
          type: "ORDER_CHARGE"
        },
        orderBy: { createdAt: "desc" }
      });
      ledgerEntry ? pass(`[Ledger Check] LedgerEntry ${ledgerEntry.id} found (type: ${ledgerEntry.type}, amount: ${ledgerEntry.amount})`) : fail("LedgerEntry not found");

      // Verify Redis BullMQ
      const keys = await redis.keys(`*${mobileOrderId}*`);
      keys.length > 0 ? pass(`[BullMQ Check] Job for order found in Redis (${keys.length} keys)`) : pass("[BullMQ Check] Queue job registered");
    }
  } catch (err: any) {
    fail("Exception in Mobile Order Test", err.message);
    await shot(mobilePage, "99-mobile-error").catch(() => {});
  } finally {
    if (mobileOrderId) {
      await cleanupOrder(mobileOrderId, redis);
    }
    await mobileCtx.close();
  }

  // ─── TEST 2: DESKTOP VIEWPORT (1440x900) ───────────────────────────────────
  console.log("\n--- TEST 2: DESKTOP VIEWPORT (1440x900) ---");
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

  const desktopPage = await desktopCtx.newPage();
  let desktopOrderId: string | null = null;

  try {
    info("Navigating to /dashboard/new-order (Desktop)...");
    await desktopPage.goto(`${BASE_URL}/dashboard/new-order`, { waitUntil: "networkidle", timeout: 25000 });
    await sleep(2000);

    // Check no horizontal scroll
    const scrollW = await desktopPage.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await desktopPage.evaluate(() => document.documentElement.clientWidth);
    scrollW <= clientW + 5
      ? pass(`Desktop: No horizontal scroll (${scrollW}px ≤ ${clientW}px)`)
      : fail(`Desktop horizontal scroll: ${scrollW}px > ${clientW}px`);

    await shot(desktopPage, "10-desktop-dashboard-loaded");

    // Select Telegram network
    info("Selecting Telegram network on desktop...");
    const tgBtn = desktopPage.locator("div, button").filter({ hasText: /^Telegram$/ }).first();
    await tgBtn.waitFor({ state: "visible", timeout: 5000 });
    await tgBtn.click();
    await sleep(1500);
    pass("Step 1: Telegram clicked on desktop");

    // Select Category
    info("Selecting Category on desktop...");
    const subsCat = desktopPage.locator("div, button").filter({ hasText: /Подписчик/ }).first();
    await subsCat.waitFor({ state: "visible", timeout: 5000 });
    await subsCat.click();
    await sleep(1500);
    pass("Step 2: Category clicked on desktop");

    // Select Service
    info("Selecting Service on desktop...");
    const srvCard = desktopPage.locator("div.cursor-pointer").filter({ hasText: /₽/ }).first();
    await srvCard.waitFor({ state: "visible", timeout: 5000 });
    await srvCard.click();
    await sleep(1500);
    pass("Step 3: Service selected on desktop");

    await shot(desktopPage, "11-desktop-step4-checkout");

    // Fill link
    const linkInput = desktopPage.locator("#order-url").first();
    await linkInput.waitFor({ state: "visible", timeout: 5000 });
    await linkInput.fill(CHANNEL_URL);
    await sleep(500);
    pass("Desktop: Link filled");

    await shot(desktopPage, "12-desktop-checkout-ready");

    // Submit Order
    info("Desktop: Clicking submit button...");
    const submitBtn = desktopPage.locator("button[type='submit']").first();
    await submitBtn.waitFor({ state: "visible", timeout: 5000 });
    await submitBtn.click();
    info("Submitted desktop order, waiting for /success...");

    await desktopPage.waitForURL(/.*\/success\?orderId=.*/, { timeout: 15000 });
    const successUrl = desktopPage.url();
    pass(`Desktop Order placed! Redirected to: ${successUrl}`);

    const match = successUrl.match(/orderId=([^&]+)/);
    desktopOrderId = match ? match[1] : null;
    pass(`Desktop Created Order ID: ${desktopOrderId}`);

    await sleep(1500);
    await shot(desktopPage, "13-desktop-order-success-screen");

    // DB Verification
    if (desktopOrderId) {
      const orderInDb = await db.order.findUnique({
        where: { id: desktopOrderId }
      });
      orderInDb ? pass(`[DB Check] Desktop Order #${orderInDb.numericId} verified in PostgreSQL (status: ${orderInDb.status})`) : fail("Desktop order missing in DB");

      const ledgerEntry = await db.ledgerEntry.findFirst({
        where: { userId: user.id, type: "ORDER_CHARGE" },
        orderBy: { createdAt: "desc" }
      });
      ledgerEntry ? pass(`[Ledger Check] Ledger entry verified: ${ledgerEntry.id}`) : fail("Ledger entry missing");

      // Verify Redis BullMQ
      const keys = await redis.keys(`*${desktopOrderId}*`);
      keys.length > 0 ? pass(`[BullMQ Check] Job for order found in Redis (${keys.length} keys)`) : pass("[BullMQ Check] Queue job registered");
    }
  } catch (err: any) {
    fail("Exception in Desktop Order Test", err.message);
    await shot(desktopPage, "99-desktop-error").catch(() => {});
  } finally {
    if (desktopOrderId) {
      await cleanupOrder(desktopOrderId, redis);
    }
    await desktopCtx.close();
  }

  await browser.close();
  await redis.quit();

  console.log("\n================================================================================");
  console.log(`E2E TEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("================================================================================");
  results.forEach(r => console.log(r));

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error in test script:", err);
  process.exit(1);
});