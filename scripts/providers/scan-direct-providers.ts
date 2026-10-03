import { DirectProviderScannerService } from '../../src/services/providers/direct-provider-scanner';
import { ExactMath } from '../../src/lib/financial/exact-math';

async function main() {
  console.log('========================================================================');
  console.log('   OmniSMM 1.0 — Прямые оптовые SMM-поставщики & Shadow Catalog Сканер   ');
  console.log('========================================================================\n');

  const providers = DirectProviderScannerService.getKnownDirectProviders();
  console.log(`[INFO] Загружено проверенных первоисточников: ${providers.length}\n`);

  console.log(
    '------------------------------------------------------------------------------------------------------------------------'
  );
  console.log(
    '| Провайдер                | Валюта | Сети                     | Специализация                      | Рейтинг | Пинг (мс) |'
  );
  console.log(
    '------------------------------------------------------------------------------------------------------------------------'
  );

  for (const p of providers) {
    const networks = p.primaryNetworks.slice(0, 3).join(', ') + (p.primaryNetworks.length > 3 ? '...' : '');
    const name = p.name.padEnd(24).slice(0, 24);
    const curr = p.currency.padEnd(6);
    const net = networks.padEnd(24).slice(0, 24);
    const spec = (p.features.channelBoosts ? 'TG Boosts, ' : '') + (p.features.refill ? 'Refill, ' : '') + 'API v2';
    const specCol = spec.padEnd(34).slice(0, 34);
    const rating = `${p.rating}/10`.padEnd(7);
    const ping = `${p.avgResponseMs}ms`.padEnd(9);

    console.log(`| ${name} | ${curr} | ${net} | ${specCol} | ${rating} | ${ping} |`);
  }

  console.log(
    '------------------------------------------------------------------------------------------------------------------------\n'
  );

  console.log('[INFO] Бенчмарк оптовых цен и маржинальности по ключевым позициям:\n');

  for (const p of providers) {
    const report = await DirectProviderScannerService.generateReportForProfile(p);
    console.log(`▶ [${report.providerName}] (API: ${report.apiUrl})`);
    console.log(`  • Каталог хэш: ${report.catalogHash.slice(0, 16)}...`);
    console.log(`  • Сети: ${Object.entries(report.networkBreakdown).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    console.log('  • Топ позиции по маржинальности:');

    for (const svc of report.topMarginServices) {
      const wholesaleRub = ExactMath.kopecksToRublesString(svc.wholesaleRateRubKopecks);
      console.log(
        `    - [${svc.networkCode}] ${svc.name}: Опт = ${wholesaleRub} ₽ / Розничный бенчмарк = ${svc.retailBenchmarkPer1000Rub} ₽ -> Маржа: +${svc.potentialMarginPercent}%`
      );
    }
    console.log('');
  }

  console.log('========================================================================');
  console.log('   Сканирование и буферизация в Shadow Catalog успешно завершены!        ');
  console.log('========================================================================');

  try {
    const { redis } = await import('../../src/lib/redis');
    redis.disconnect();
  } catch {
    // ignore
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[FATAL] Ошибка запуска сканера:', err);
  process.exit(1);
});
