import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";

async function main() {
  const vkSubs = await db.service.findMany({
    where: {
      category: { name: { contains: "Подписчики в группу" } }
    },
    select: { id: true, name: true, targetType: true }
  });

  console.log("VK subscribers services:");
  for (const s of vkSubs) {
    console.log(`- ${s.name}: targetType=${s.targetType}`);
  }

  const tgSubs = await db.service.findMany({
    where: {
      category: { name: { contains: "Подписчики на канал" } }
    },
    select: { id: true, name: true, targetType: true }
  });

  console.log("\nTG subscribers services:");
  for (const s of tgSubs) {
    console.log(`- ${s.name}: targetType=${s.targetType}`);
  }
}
main().catch(console.error);