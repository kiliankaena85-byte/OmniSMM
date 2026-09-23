import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  const categories = await db.category.findMany({
    where: { network: { slug: 'telegram' } },
    include: {
      services: { select: { id: true, name: true, isActive: true, providerId: true } }
    },
    orderBy: { sort: 'asc' }
  });

  console.log(`Total Telegram Categories in DB: ${categories.length}\n`);
  for (const c of categories) {
    console.log(`- [${c.id}] "${c.name}" (slug: ${c.slug}, sort: ${c.sort}, activeServices: ${c.services.filter(s => s.isActive).length}, totalServices: ${c.services.length})`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
