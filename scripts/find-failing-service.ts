import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  const matching = await db.service.findMany({
    where: {
      name: { contains: 'Telegram Подписчики [Без гарантии]' }
    },
    include: {
      category: {
        include: { network: true }
      },
      provider: true
    }
  });

  console.log(`Found ${matching.length} matching services:`);
  for (const s of matching) {
    console.log(JSON.stringify({
      id: s.id,
      name: s.name,
      isActive: s.isActive,
      isArchived: (s as any).isArchived,
      categoryId: s.categoryId,
      categoryName: s.category?.name,
      categoryDeleted: (s.category as any)?.deletedAt,
      networkSlug: s.category?.network?.slug,
      providerId: s.providerId,
      providerName: s.provider?.name,
      providerActive: s.provider?.isActive,
      pricePerUnitRub: s.pricePerUnitRub,
      pricePer1000Rub: s.pricePer1000Rub,
      minQty: s.minQty,
      maxQty: s.maxQty
    }, null, 2));
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
