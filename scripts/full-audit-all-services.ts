import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  const networks = await db.network.findMany({
    include: {
      categories: {
        include: {
          services: true
        }
      }
    }
  });

  console.log('=== FULL AUDIT OF ALL SERVICES IN DATABASE ===\n');
  for (const net of networks) {
    const totalSvcs = net.categories.reduce((sum, c) => sum + c.services.length, 0);
    if (totalSvcs === 0) continue;

    console.log(`\n=============================================================`);
    console.log(`🌐 ${net.name} (${net.slug}) — ${net.categories.length} categories, ${totalSvcs} services`);
    console.log(`=============================================================`);

    for (const cat of net.categories) {
      console.log(`\n📁 Category: "${cat.name}" (${cat.slug}) — ${cat.services.length} services:`);
      for (const s of cat.services) {
        console.log(`   - [${s.id}] "${s.name}" (rate: ${s.rate} RUB/1k, min: ${s.minQty}, max: ${s.maxQty}, extId: ${s.externalId})`);
      }
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
