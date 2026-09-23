import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  const net = await db.network.findFirst({
    where: { slug: 'likee' },
    include: {
      categories: {
        include: { services: true }
      }
    }
  });

  if (!net) return;
  for (const cat of net.categories) {
    console.log(`📁 Category: "${cat.name}"`);
    for (const s of cat.services) {
      console.log(`- [${s.id}] Name: "${s.name}", Desc: "${s.description}"`);
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
