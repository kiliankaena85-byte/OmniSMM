import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { applyBeautifulRounding } from '../src/lib/financial-constants';

const prisma = new PrismaClient();

async function main() {
  const services = await prisma.service.findMany({
    include: {
      category: { include: { network: true } }
    },
    orderBy: { numericId: 'asc' }
  });

  console.log(`Auditing ${services.length} services for Option B migration...`);

  let minMult = Infinity;
  let maxMult = -Infinity;
  let minMarginPct = Infinity;
  let countBelow500 = 0;

  const results = services.map(s => {
    const cost = s.costPer1kRub || s.rate || 0;
    
    let baseMult = 6.0;
    if (s.qualityTier === 'STANDARD') baseMult = 7.0;
    else if (s.qualityTier === 'PREMIUM') baseMult = 8.0;

    const rawPrice = cost * baseMult;
    const finalPrice1k = applyBeautifulRounding(rawPrice);
    const finalMult = cost > 0 ? finalPrice1k / cost : baseMult;
    const finalMarginPct = cost > 0 ? ((finalPrice1k - cost) / cost) * 100 : (baseMult - 1) * 100;

    if (finalMult < minMult) minMult = finalMult;
    if (finalMult > maxMult) maxMult = finalMult;
    if (finalMarginPct < minMarginPct) minMarginPct = finalMarginPct;
    if (finalMarginPct < 500) countBelow500++;

    return {
      numericId: s.numericId,
      name: s.name,
      tier: s.qualityTier,
      cost1k: cost,
      costUnit: cost / 1000,
      oldPrice1k: (s.pricePer1000Cents || 0) / 100,
      oldPriceUnit: ((s.pricePer1000Cents || 0) / 100) / 1000,
      newPrice1k: finalPrice1k,
      newPriceUnit: finalPrice1k / 1000,
      finalMult: Number(finalMult.toFixed(2)),
      finalMarginPct: Number(finalMarginPct.toFixed(1))
    };
  });

  console.log('--- SIMULATION STATS ---');
  console.log(`Total services: ${results.length}`);
  console.log(`Min multiplier: ${minMult.toFixed(2)}x (Min margin: ${minMarginPct.toFixed(1)}%)`);
  console.log(`Max multiplier: ${maxMult.toFixed(2)}x`);
  console.log(`Services with margin < 500%: ${countBelow500}`);

  console.log('\n--- SAMPLE SCREENSHOT SERVICES (#8, #9, #10, #69) ---');
  console.table(results.filter(r => [8, 9, 10, 69].includes(r.numericId)));

  console.log('\n--- SAMPLE 10 LOWEST MULTIPLIER SERVICES ---');
  const sorted = [...results].sort((a, b) => a.finalMult - b.finalMult);
  console.table(sorted.slice(0, 10).map(r => ({
    id: r.numericId,
    tier: r.tier,
    cost1k: r.cost1k,
    newPrice1k: r.newPrice1k,
    unitPrice: r.newPriceUnit,
    mult: r.finalMult,
    marginPct: r.finalMarginPct
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
