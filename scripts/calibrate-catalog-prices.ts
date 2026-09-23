import { db } from '../src/lib/db';

async function calibratePrices() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('  🛠️ CALIBRATING CATALOG SERVICE PRICES & MARKUPS');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Find all services with rate > 1000 or markup > 5
  const allServices = await db.service.findMany({
    include: {
      category: {
        include: { network: true }
      }
    }
  });

  let fixedCount = 0;

  for (const s of allServices) {
    const netSlug = s.category?.network?.slug || '';
    const catName = s.category?.name || '';
    let newRate = s.rate;
    let newMarkup = s.markup;
    let newCurrency = s.providerCurrency;

    // Detect if rate was stored in kopecks (e.g. 195937.5 -> 195.93 RUB)
    // or if rate is unrealistically high for social media services
    if (s.rate > 5000) {
      // Rates like 195937.5 are in tenths of kopecks or raw micro-cents
      if (s.rate > 50000) {
        newRate = Number((s.rate / 1000).toFixed(2));
      } else {
        newRate = Number((s.rate / 100).toFixed(2));
      }
      newMarkup = 1.5; // Set healthy 50% margin
      console.log(`  🔧 Fixing extreme rate: [${netSlug} -> ${catName}] "${s.name}"`);
      console.log(`     Old rate: ${s.rate} -> New rate: ${newRate} (markup: ${s.markup} -> ${newMarkup})`);
    } else if (s.markup > 3) {
      // Standardize markup to healthy 1.5x - 2.0x instead of 10x
      newMarkup = 1.6;
      console.log(`  🔧 Normalizing markup: [${netSlug} -> ${catName}] "${s.name}" (markup: ${s.markup} -> ${newMarkup})`);
    }

    if (newRate !== s.rate || newMarkup !== s.markup) {
      await db.service.update({
        where: { id: s.id },
        data: {
          rate: newRate,
          markup: newMarkup,
          pricePer1000Cents: Math.round(newRate * newMarkup * 100)
        }
      });
      fixedCount++;
    }
  }

  console.log(`\n🎉 Calibrated ${fixedCount} services.`);
}

calibratePrices()
  .catch(console.error)
  .finally(() => db.$disconnect());
