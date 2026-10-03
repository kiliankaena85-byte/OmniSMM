import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { applyBeautifulRounding } from '../src/lib/financial-constants';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://:SmmP1anR3dis2026Secure!@localhost:6379');

async function main() {
  console.log('🚀 [APPLY OPTION B] Migrating all 400 services to >= 500% markup (Option B: 6x Economy, 7x Standard, 8x Premium)...\n');

  // 1. Fetch all services
  const services = await prisma.service.findMany({
    include: {
      category: { include: { network: true } }
    }
  });

  console.log(`Fetched ${services.length} services from DB.`);

  let updatedCount = 0;
  const updateResults: Array<{
    id: string;
    numericId: number;
    name: string;
    tier: string;
    cost: number;
    oldPrice1k: number;
    newPrice1k: number;
    newPriceUnit: number;
    multiplier: number;
    marginPct: number;
  }> = [];

  for (const s of services) {
    const cost = s.costPer1kRub || s.rate || 0;
    
    let baseMult = 6.0;
    if (s.qualityTier === 'STANDARD') baseMult = 7.0;
    else if (s.qualityTier === 'PREMIUM') baseMult = 8.0;

    const rawPrice = cost * baseMult;
    const finalPrice1k = applyBeautifulRounding(rawPrice);
    const finalMult = cost > 0 ? Number((finalPrice1k / cost).toFixed(2)) : baseMult;
    const finalMarginPct = cost > 0 ? Number((((finalPrice1k - cost) / cost) * 100).toFixed(1)) : (baseMult - 1) * 100;
    const priceCents = Math.round(finalPrice1k * 100);

    await prisma.service.update({
      where: { id: s.id },
      data: {
        pricePer1000Cents: priceCents,
        markup: finalMult,
        rate: cost,
        costPer1kRub: cost
      }
    });

    updatedCount++;
    updateResults.push({
      id: s.id,
      numericId: s.numericId,
      name: s.name,
      tier: s.qualityTier,
      cost,
      oldPrice1k: (s.pricePer1000Cents || 0) / 100,
      newPrice1k: finalPrice1k,
      newPriceUnit: finalPrice1k / 1000,
      multiplier: finalMult,
      marginPct: finalMarginPct
    });
  }

  console.log(`✅ Successfully updated ${updatedCount} services in PostgreSQL.`);

  // 2. Synchronize master docs/CURATED_SERVICES_400.json
  const jsonPath = 'docs/CURATED_SERVICES_400.json';
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const items = JSON.parse(raw);
    let jsonUpdated = 0;

    for (const item of items) {
      const match = updateResults.find(r => r.numericId === item.numericId || r.name === item.name);
      if (match) {
        item.recommendedPriceRub = match.newPrice1k;
        item.markupMultiplier = match.multiplier;
        jsonUpdated++;
      } else {
        const cost = Number(item.costPer1kRub) || 0;
        let baseMult = 6.0;
        if (item.tier === 'Стандарт') baseMult = 7.0;
        else if (item.tier === 'Премиум') baseMult = 8.0;
        const finalPrice1k = applyBeautifulRounding(cost * baseMult);
        item.recommendedPriceRub = finalPrice1k;
        item.markupMultiplier = cost > 0 ? Number((finalPrice1k / cost).toFixed(2)) : baseMult;
        jsonUpdated++;
      }
    }

    fs.writeFileSync(jsonPath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`✅ Synchronized ${jsonUpdated} items in docs/CURATED_SERVICES_400.json.`);
  }

  // 3. Flush Redis cache keys
  const keys = await redis.keys('*catalog*');
  const servicesKeys = await redis.keys('*service*');
  const allKeys = [...new Set([...keys, ...servicesKeys])];
  if (allKeys.length > 0) {
    await redis.del(...allKeys);
    console.log(`🧹 Flushed ${allKeys.length} Redis cache keys for storefront.`);
  }

  // 4. Output verification of screenshot services
  console.log('\n--- VERIFICATION: SCREENSHOT SERVICES (#8, #9, #10, #69) ---');
  const screenshotSample = updateResults.filter(r => [8, 9, 10, 69].includes(r.numericId));
  console.table(screenshotSample.map(r => ({
    id: r.numericId,
    name: r.name.slice(0, 40),
    tier: r.tier,
    cost1k: r.cost,
    oldPriceUnit: r.oldPrice1k / 1000,
    newPriceUnit: r.newPriceUnit,
    newPrice1k: r.newPrice1k,
    multiplier: `${r.multiplier}x`,
    margin: `+${r.marginPct}%`
  })));

  console.log('\n🎉 Option B Migration Complete!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
