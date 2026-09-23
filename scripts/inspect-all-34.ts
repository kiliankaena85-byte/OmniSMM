import * as dotenv from "dotenv";
dotenv.config();
import { db } from "@/lib/db";

async function main() {
  const allNetworks = await db.network.findMany({
    orderBy: { name: 'asc' },
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

  console.log(`TOTAL NETWORKS IN DB: ${allNetworks.length}`);
  for (const n of allNetworks) {
    const totalActiveServices = n.categories.reduce((acc, c) => acc + c.services.length, 0);
    console.log(`${n.isActive ? '🟢 [ACTIVE]' : '🔴 [DISABLED]'} ${n.name} (slug: ${n.slug}): ${n.categories.length} categories, ${totalActiveServices} active services`);
  }
}
main().catch(console.error);