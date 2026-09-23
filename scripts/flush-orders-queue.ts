import * as dotenv from "dotenv";
dotenv.config();
import Redis from "ioredis";

async function main() {
  const redis = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
  const keys = await redis.keys("bullmq:ordersQueue:dispatch-*");
  console.log(`Found ${keys.length} dispatch keys in ordersQueue`);
  if (keys.length > 0) {
    await redis.del(...keys);
    console.log("Deleted all old dispatch keys.");
  }
  await redis.del("bullmq:ordersQueue:delayed");
  await redis.del("bullmq:ordersQueue:wait");
  await redis.del("bullmq:ordersQueue:active");
  await redis.del("bullmq:ordersQueue:completed");
  console.log("Cleared all queue states in ordersQueue.");
  await redis.quit();
}
main().catch(console.error);