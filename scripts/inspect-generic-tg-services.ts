import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  const genericCat = await db.category.findUnique({
    where: { id: 'cmtcr2gg30004ss7y99soxqz7' },
    include: {
      services: {
        include: { provider: true }
      }
    }
  });

  if (!genericCat) {
    console.log('Category not found');
    return;
  }

  console.log(`Total services in Telegram generic category: ${genericCat.services.length}`);
  for (const s of genericCat.services) {
    console.log(`[${s.id}] "${s.name}" (provider: ${s.provider?.name || 'NULL'}, providerServiceId: ${s.providerServiceId})`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
