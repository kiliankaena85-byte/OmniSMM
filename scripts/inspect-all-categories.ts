import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  const networks = await db.network.findMany({
    include: {
      categories: {
        include: {
          services: { select: { id: true, name: true, isActive: true } }
        }
      }
    }
  });

  console.log('=== ALL NETWORKS AND THEIR CATEGORIES ===');
  for (const net of networks) {
    console.log(`\n🌐 Network: ${net.name} (${net.slug}) - ${net.categories.length} categories`);
    for (const c of net.categories) {
      const activeCount = c.services.filter(s => s.isActive).length;
      console.log(`   📁 [${c.id}] "${c.name}" (active: ${activeCount}/${c.services.length})`);
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
