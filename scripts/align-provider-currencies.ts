import 'dotenv/config';
import { db } from '../src/lib/db';
import { ProviderCurrencyEngine } from '../src/services/providers/currency-detector.service';

async function main() {
  console.log('=== Starting Provider Currency Alignment ===');
  
  const settings = await db.systemSettings.findFirst({ select: { exchangeRateUSD: true } });
  const usdRate = settings?.exchangeRateUSD || 95.0;
  console.log(`Current USD/RUB exchange rate: ${usdRate}`);

  const providers = await db.provider.findMany({
    select: { id: true, name: true, balanceCurrency: true }
  });

  for (const provider of providers) {
    const targetCurrency = (provider.balanceCurrency || 'USD').toUpperCase() as 'USD' | 'RUB';
    console.log(`\nReconciling provider: "${provider.name}" (ID: ${provider.id}) -> Target Currency: ${targetCurrency}`);

    const result = await ProviderCurrencyEngine.autoHealProviderServices(
      provider.id,
      targetCurrency,
      usdRate,
      { id: 'SYSTEM_ALIGNER', email: 'system@omnismm' }
    );

    console.log(`Result: Healed ${result.updatedCount} services (previous provider balanceCurrency: ${result.previousCurrency})`);
  }

  console.log('\n=== Post-Alignment Verification ===');
  const serviceStats = await db.service.groupBy({
    by: ['providerId', 'providerCurrency', 'isQuarantined'],
    _count: { id: true }
  });
  console.log('Service counts by provider, currency & isQuarantined:');
  console.log(JSON.stringify(serviceStats, null, 2));

  const totalQuarantined = await db.service.count({
    where: { isQuarantined: true }
  });
  console.log(`\nTotal quarantined services remaining: ${totalQuarantined}`);
}

main()
  .catch((err) => {
    console.error('Fatal error during alignment:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
