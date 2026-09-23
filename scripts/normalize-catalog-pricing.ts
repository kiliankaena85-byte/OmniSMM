import { db } from '@/lib/db';
import { applyBeautifulRounding, SAFETY_FLOOR_MARKUP } from '@/lib/financial-constants';
import { getCostRub } from '@/lib/pricing/currency-invariant';
import { applyAntiNegativeMargin } from '@/lib/pricing/anti-negative-margin';
import { SettingsProvider } from '@/lib/settings';

async function main() {
  console.log('🔄 Starting catalog-wide beautiful pricing normalization...');
  const usdToRub = await SettingsProvider.getExchangeRateUSD();
  const services = await db.service.findMany({
    include: { category: { include: { network: true } } }
  });

  console.log(`Found ${services.length} services across all networks.`);

  let updatedCount = 0;
  for (const s of services) {
    const costRub = s.costPer1kRub ?? getCostRub(s.rate, s.providerCurrency || 'RUB', usdToRub);
    const effectiveMarkup = s.markup > 0 ? s.markup : SAFETY_FLOOR_MARKUP;
    const rawRetailRub = costRub * effectiveMarkup;
    
    // Apply Beautiful Rounding + Anti-Negative Margin
    const marginGuard = applyAntiNegativeMargin(costRub, rawRetailRub);
    const newPricePer1000Cents = marginGuard.finalRetailPer1kCents;

    if (s.pricePer1000Cents !== newPricePer1000Cents) {
      console.log(`[${s.category?.network?.slug || 'other'}] ${s.name}:`);
      console.log(`  OLD: ${s.pricePer1000Cents} коп (${s.pricePer1000Cents / 100} ₽/1k) -> ${s.pricePer1000Cents / 100000} ₽/шт`);
      console.log(`  NEW: ${newPricePer1000Cents} коп (${newPricePer1000Cents / 100} ₽/1k) -> ${newPricePer1000Cents / 100000} ₽/шт`);
      
      await db.service.update({
        where: { id: s.id },
        data: {
          pricePer1000Cents: newPricePer1000Cents,
          costPer1kRub: costRub
        }
      });
      updatedCount++;
    }
  }

  console.log(`✅ Beautiful pricing normalization completed! Updated ${updatedCount} / ${services.length} services.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error during normalization:', err);
    process.exit(1);
  });
