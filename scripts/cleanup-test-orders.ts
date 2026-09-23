import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import Redis from "ioredis";

async function main() {
  console.log("=== 1. Cleaning test orders from PostgreSQL ===");
  // Find orders created for tests (e.g. numericId >= 315 or test links)
  const testOrders = await db.order.findMany({
    where: {
      OR: [
        { numericId: { gte: 315 } },
        { link: { contains: "test_verified" } }
      ]
    },
    select: { id: true, numericId: true, link: true, charge: true, userId: true }
  });

  console.log(`Found ${testOrders.length} test orders to delete:`, testOrders.map(o => `#${o.numericId} (${o.id})`));

  if (testOrders.length > 0) {
    const orderIds = testOrders.map(o => o.id);

    // Delete any dependent records if any exist
    await db.refill.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
    await db.ticket.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});
    await db.orderRecoveryIncident.deleteMany({ where: { orderId: { in: orderIds } } }).catch(() => {});

    // Delete orders
    const deleted = await db.order.deleteMany({
      where: { id: { in: orderIds } }
    });
    console.log(`Deleted ${deleted.count} test orders from DB.`);
  }

  console.log("\n=== 2. Cleaning Redis BullMQ orders queue keys ===");
  const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const redis = new Redis(redisUrl);

  const orderKeys = await redis.keys("*order*");
  const testDispatchKeys = orderKeys.filter(k => 
    testOrders.some(o => k.includes(o.id))
  );

  console.log(`Found ${testDispatchKeys.length} matching Redis keys for test orders.`);
  if (testDispatchKeys.length > 0) {
    await redis.del(...testDispatchKeys);
    console.log("Deleted matching Redis keys.");
  }

  // Also clean failed/delayed lists in bullmq:ordersQueue
  const failedJobs = await redis.zrange("bullmq:ordersQueue:failed", 0, -1);
  console.log(`Failed jobs count in ordersQueue: ${failedJobs.length}`);
  if (failedJobs.length > 0) {
    await redis.del("bullmq:ordersQueue:failed");
    console.log("Cleared bullmq:ordersQueue:failed list.");
  }

  await redis.quit();
  console.log("\n✅ Test cleanup completed successfully!");
  process.exit(0);
}

main().catch(err => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});