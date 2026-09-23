/**
 * Fix numericId autoincrement sequence & retry failed imports
 */
import * as fs from 'fs';
import { db } from '../src/lib/db';

interface CuratedService {
  rank: number;
  platform: string;
  category: string;
  tier: string;
  providerName: string;
  extId: string;
  name: string;
  priceRUB_per1000: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  drip: boolean;
  qualityScore: number;
  reason: string;
}

async function main() {
  console.log('=== Fix & Retry Import ===\n');

  // 1. Reset numericId sequence
  console.log('--- Fixing numericId sequence ---');
  const maxId = await db.service.aggregate({ _max: { numericId: true } });
  const nextVal = (maxId._max.numericId || 0) + 1;
  await db.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Service"', 'numericId'), ${nextVal}, false)`
  );
  console.log(`  Sequence reset to ${nextVal}`);

  // 2. Load curated and find missing ones
  const curated: CuratedService[] = JSON.parse(
    fs.readFileSync('scripts/curated-catalog.json', 'utf-8')
  );

  const providers = await db.provider.findMany();
  const providerMap = new Map<string, string>();
  for (const p of providers) providerMap.set(p.name, p.id);

  const categories = await db.category.findMany({ include: { network: true } });
  const categoryMap = new Map<string, string>();
  for (const c of categories) {
    categoryMap.set(`${c.network?.name || ''}::${c.name}`, c.id);
  }

  // 3. Find services not yet imported
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const cs of curated) {
    const providerId = providerMap.get(cs.providerName);
    if (!providerId) continue;

    const existing = await db.service.findFirst({
      where: { externalId: cs.extId, providerId }
    });

    if (existing) {
      // Ensure active
      if (!existing.isActive) {
        await db.service.update({
          where: { id: existing.id },
          data: { isActive: true }
        });
      }
      skipped++;
      continue;
    }

    const categoryKey = `${cs.platform}::${cs.category}`;
    const categoryId = categoryMap.get(categoryKey);
    if (!categoryId) {
      errors++;
      continue;
    }

    try {
      const rateUSD = cs.priceRUB_per1000 / 83;
      await db.service.create({
        data: {
          name: cs.name,
          categoryId,
          providerId,
          externalId: cs.extId,
          rate: rateUSD,
          markup: 3.0,
          minQty: cs.min,
          maxQty: Math.min(cs.max, 10000000),
          isRefillEnabled: cs.refill,
          isCancelEnabled: cs.cancel,
          isDripFeedEnabled: cs.drip,
          isActive: true,
          lastSeenAt: new Date(),
        }
      });
      imported++;
    } catch (err: any) {
      console.error(`  ❌ ${cs.name.substring(0, 40)}: ${err.message.substring(0, 60)}`);
      errors++;
      // Reset sequence on each error
      const max2 = await db.service.aggregate({ _max: { numericId: true } });
      await db.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"Service"', 'numericId'), ${(max2._max.numericId || 0) + 1}, false)`
      );
    }
  }

  console.log(`\n✅ Дозагрузка завершена!`);
  console.log(`  Новых: ${imported}`);
  console.log(`  Пропущено (уже есть): ${skipped}`);
  console.log(`  Ошибок: ${errors}`);

  // 4. Final stats
  const totalActive = await db.service.count({ where: { isActive: true } });
  const totalInactive = await db.service.count({ where: { isActive: false } });

  console.log(`\n📊 Итого:`);
  console.log(`  Активных: ${totalActive}`);
  console.log(`  Деактивированных (старые): ${totalInactive}`);
}

main().catch(console.error).finally(() => process.exit(0));
