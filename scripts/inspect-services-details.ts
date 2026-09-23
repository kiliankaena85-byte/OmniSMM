import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";

async function main() {
  const networks = await db.network.findMany({
    where: { isActive: true },
    include: {
      categories: {
        include: {
          services: {
            where: { isActive: true, isQuarantined: false }
          }
        }
      }
    }
  });

  for (const n of networks) {
    console.log(`=== ${n.name} (${n.slug}) ===`);
    for (const c of n.categories) {
      console.log(`  Category: ${c.name} (${c.services.length} services)`);
      for (const s of c.services.slice(0, 3)) {
        console.log(`    - ${s.name} [rate: ${s.rate}, provider: ${s.providerId}]`);
      }
    }
  }
}
main().catch(console.error);