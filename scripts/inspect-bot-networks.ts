import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import { BotCatalogService } from "@/bot/services/bot-catalog.service";

async function main() {
  const networks = await BotCatalogService.getVisibleNetworks("smmplan");
  console.log(`BotCatalogService returned ${networks.length} networks:`);

  for (const n of networks) {
    const categories = await db.category.findMany({
      where: { networkId: n.id },
      include: {
        services: {
          where: { isActive: true, isQuarantined: false }
        }
      }
    });

    const activeServicesCount = categories.reduce((sum, c) => sum + c.services.length, 0);
    console.log(`- ${n.name} (id: ${n.id}, slug: ${n.slug}): ${categories.length} categories, ${activeServicesCount} active services`);
  }

  process.exit(0);
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });