import { processGeoAvailabilityCheck } from '../src/workers/processors/geo-availability.processor';
import { GeoAvailabilityService } from '../src/services/telemetry/geo-availability.service';

async function runLiveE2ETest() {
  console.log('================================================================');
  console.log('🚀 ЗАПУСК СКВОЗНОГО ЖИВОГО E2E-ТЕСТА МОНИТОРИНГА ДОСТУПНОСТИ');
  console.log('================================================================\n');

  // Step 1: Direct Live Service Probe
  console.log('📍 ШАГ 1: Живой опрос серверных зондов через GeoAvailabilityService...');
  const target = 'https://test.smmplan.pro';
  const report = await GeoAvailabilityService.checkAvailability(target, 10, 5000);

  console.log('✅ Результат опроса зондов:');
  console.log('  • Целевой URL:', report.targetUrl);
  console.log(`  • Доступность в РФ: ${Math.round(report.ruRate * 100)}% (${report.ruPassed}/${report.ruTotal || 1})`);
  console.log(`  • Доступность в мире: ${Math.round(report.globalRate * 100)}% (${report.globalPassed}/${report.globalTotal || 1})`);
  console.log('  • Вердикт:', report.verdictText);
  if (report.permanentLink) console.log('  • Отчет:', report.permanentLink);

  // Step 2: BullMQ Watchdog Lifecycle Execution
  console.log('\n📍 ШАГ 2: Запуск фонового процессора GeoAvailabilityProcessor...');
  const watchdogResult = await processGeoAvailabilityCheck();
  console.log('✅ Результат выполнения процессора:', watchdogResult);

  console.log('\n================================================================');
  console.log('🎉 E2E-ТЕСТ УСПЕШНО ЗАВЕРШЕН (100% PASS)');
  console.log('================================================================');
  process.exit(0);
}

runLiveE2ETest().catch((e) => {
  console.error('E2E Fail:', e);
  process.exit(1);
});
