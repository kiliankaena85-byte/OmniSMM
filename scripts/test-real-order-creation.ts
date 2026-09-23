// Mock server-only for standalone script execution
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {}
} as any;

import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import { orderService } from "@/services/core/order.service";
import { WalletOps } from "@/services/financial/wallet-ops.service";

async function main() {
  console.log("=== TESTING REAL ORDER CREATION FLOW (BOT CONTEXT) ===");

  // 1. Find user by telegramId
  const tgUser = await db.user.findFirst({
    where: { telegramId: "1382446520" }
  });
  if (!tgUser) {
    console.error("User 1382446520 not found");
    process.exit(1);
  }
  console.log(`User found: ${tgUser.email} (id: ${tgUser.id}), current balance: ${tgUser.balance} cents`);

  // Ensure user has at least 1000 cents (10 RUB)
  if (Number(tgUser.balance) < 1000) {
    console.log("Adding 5000 cents (50 RUB) test balance to user via WalletOps.adminAdjust...");
    await db.$transaction(async (tx) => {
      await WalletOps.adminAdjust(
        tx,
        tgUser.id,
        5000,
        "Test balance for bot order verification",
        "admin-system-test"
      );
    });
    const refreshed = await db.user.findUnique({ where: { id: tgUser.id } });
    console.log(`Refreshed balance: ${refreshed?.balance} cents (50.00 RUB)`);
  }

  // 2. Find service: "Telegram Подписчики"
  const service = await db.service.findFirst({
    where: { name: "Telegram Подписчики", isActive: true }
  });
  if (!service) {
    console.error("Service 'Telegram Подписчики' not found");
    process.exit(1);
  }
  console.log(`\nService: ${service.name} (id: ${service.id}, minQty: ${service.minQty})`);

  // 3. Call orderService.createOrder
  const testLink = "https://t.me/smmMarket69";
  const qty = service.minQty; // 100 pcs = 5.00 RUB = 500 cents
  const chargeCents = 500;
  const providerCostCents = 150;

  console.log(`\nCreating order: qty=${qty}, link=${testLink}, charge=${chargeCents} cents...`);
  const res = await orderService.createOrder(tgUser.id, {
    serviceId: service.id,
    link: testLink,
    quantity: qty,
    charge: chargeCents,
    providerCost: providerCostCents,
    runs: 1,
    interval: 0,
  });

  console.log("\n=== ORDER CREATION RESULT ===");
  console.log("Success:", res.success);
  console.log("Order ID:", res.orderId);
  console.log("Error:", res.error || "none");

  if (res.success && res.orderId) {
    const createdOrder = await db.order.findUnique({
      where: { id: res.orderId }
    });
    console.log("\nOrder in DB:", {
      id: createdOrder?.id,
      status: createdOrder?.status,
      link: createdOrder?.link,
      quantity: createdOrder?.quantity,
      charge: createdOrder?.charge,
      createdAt: createdOrder?.createdAt
    });
    console.log("\n✅ REAL ORDER CREATED SUCCESSFULLY! Zero errors!");
  } else {
    console.error("\n❌ FAILED to create order:", res.error);
    process.exit(1);
  }

  process.exit(0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });