import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";
import { BotCatalogService } from "@/bot/services/bot-catalog.service";

async function main() {
  console.log("--- 1. Testing getVisibleNetworks('smmplan') ---");
  const networks = await BotCatalogService.getVisibleNetworks("smmplan");
  console.log(`Visible networks count: ${networks.length}`);

  for (const net of networks) {
    const categories = await BotCatalogService.getVisibleCategories(net.id, "smmplan");
    let totalServices = 0;
    for (const cat of categories) {
      const services = await BotCatalogService.getVisibleServices(cat.id, "smmplan");
      totalServices += services.length;
    }
    console.log(`Network: ${net.name} -> ${categories.length} categories, ${totalServices} total active services`);
    if (totalServices === 0) {
      throw new Error(`CRITICAL INVARIANT VIOLATION: Network ${net.name} has 0 services but was returned by getVisibleNetworks!`);
    }
  }

  console.log("\n--- 2. Verifying disabled/empty networks are NOT returned ---");
  const allDbNetworks = await db.network.findMany({ select: { id: true, name: true, slug: true } });
  const returnedIds = new Set(networks.map(n => n.id));
  const hiddenNetworks = allDbNetworks.filter(n => !returnedIds.has(n.id));

  console.log(`Total DB networks: ${allDbNetworks.length}`);
  console.log(`Visible in Bot: ${networks.length}`);
  console.log(`Hidden from Bot (0 services or inactive): ${hiddenNetworks.length}`);

  for (const h of hiddenNetworks) {
    const cats = await BotCatalogService.getVisibleCategories(h.id, "smmplan");
    let svcs = 0;
    for (const c of cats) {
      const s = await BotCatalogService.getVisibleServices(c.id, "smmplan");
      svcs += s.length;
    }
    if (svcs > 0) {
      console.warn(`WARNING: Network ${h.name} has ${svcs} services but is hidden (isActive might be false)`);
    }
  }

  console.log("\n✅ ALL INVARIANTS PASS: Only networks with active services are shown in bot!");
  process.exit(0);
}

main().catch(err => {
  console.error("FAILED:", err);
  process.exit(1);
});