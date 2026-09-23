import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  console.log('=== ALL TELEGRAM CATEGORIES & SERVICES ===');
  const tgNetwork = await db.network.findFirst({
    where: { slug: 'telegram' },
    include: {
      categories: {
        include: {
          services: {
            include: { provider: true }
          }
        }
      }
    }
  });

  if (!tgNetwork) {
    console.log('Telegram network not found!');
    return;
  }

  console.log(`Telegram Network ID: ${tgNetwork.id}, Total Categories: ${tgNetwork.categories.length}`);
  for (const cat of tgNetwork.categories) {
    console.log(`\n📁 Category: [${cat.id}] "${cat.name}" (slug: ${cat.slug}, order: ${cat.displayOrder})`);
    console.log(`   Services count: ${cat.services.length}`);
    for (const s of cat.services) {
      console.log(`   - [${s.id}] "${s.name}" (active: ${s.isActive}, provider: ${s.provider?.name || 'NULL'}, pricePerUnitRub: ${s.pricePerUnitRub}, pricePer1000: ${s.pricePer1000Rub}, min: ${s.minQty}, max: ${s.maxQty})`);
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
