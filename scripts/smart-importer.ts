/**
 * SMART IMPORTER SCRIPT
 * =====================
 * Анализирует услуги активных провайдеров и составляет список "качественных" услуг
 * для импорта.
 * 
 * Критерии качества (Позитивные маркеры):
 * 'guaranteed', 'refill', 'non-drop', 'instant', 'premium', 'real', 'active', 'hq'
 * 
 * Фильтры отсева (Негативные маркеры):
 * 'no refill', 'no drop' (sometimes means fake without refill), 'cheap', 'slow', 'bots', 'unstable', 'fake', 'mixed'
 */

import * as fs from 'fs';
import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';
import { UniversalProvider } from '../src/services/providers/universal.provider';

const POSITIVE_MARKERS = ['guaranteed', 'refill', 'non-drop', 'instant', 'premium', 'real', 'active', 'hq'];
const NEGATIVE_MARKERS = ['no refill', 'cheap', 'slow', 'bots', 'unstable', 'fake', 'mixed', 'drop'];

// Exceptional case: "non-drop" contains "drop", so we need to be careful with regex.
function isQualitative(name: string, desc: string): boolean {
  const text = (name + ' ' + desc).toLowerCase();
  
  // 1. Check negatives first
  for (const marker of NEGATIVE_MARKERS) {
    if (text.includes(marker)) {
      // Special exclusion: if text contains 'non-drop' but matched 'drop', don't reject immediately
      if (marker === 'drop' && text.includes('non-drop')) {
        continue;
      }
      return false; // Found negative marker, reject
    }
  }

  // 2. Check positives
  let hasPositive = false;
  for (const marker of POSITIVE_MARKERS) {
    if (text.includes(marker)) {
      hasPositive = true;
      break;
    }
  }

  return hasPositive;
}

async function main() {
  console.log('=== Запуск Smart Importer ===\n');

  const providers = await db.provider.findMany({ where: { isActive: true } });
  console.log(`Найдено активных провайдеров: ${providers.length}\n`);

  const qualitativeServices = [];

  for (const prov of providers) {
    process.stdout.write(`Анализ провайдера ${prov.name}... `);
    try {
      const decryptedKey = VaultService.decrypt(prov.apiKey);
      const instance = new UniversalProvider(prov.apiUrl, decryptedKey || prov.apiKey);
      const raw = await instance.getServices();
      
      let count = 0;
      for (const r of raw) {
        if (r.type !== 'Default') continue;
        
        // Skip already imported logic can be added here if needed
        const existing = await db.service.findFirst({ where: { externalId: String(r.service), providerId: prov.id } });
        if (existing) continue; // Skip already imported

        if (isQualitative(r.name, r.desc || '')) {
          qualitativeServices.push({
            providerId: prov.id,
            providerName: prov.name,
            extId: String(r.service),
            name: r.name,
            category: r.category,
            rate: r.rate,
            min: r.min,
            max: r.max,
            refill: !!r.refill
          });
          count++;
        }
      }
      console.log(`✅ Найдено ${count} новых качественных услуг`);
    } catch (err: any) {
      console.log(`❌ Ошибка: ${err.message}`);
    }
  }

  // Generate Report
  const reportPath = 'scripts/smart-importer-report.md';
  let report = `# 🌟 Smart Importer Report\n\n`;
  report += `**Дата:** ${new Date().toISOString()}\n`;
  report += `**Найдено качественных услуг для импорта:** ${qualitativeServices.length}\n\n`;

  report += `## 📋 Список услуг (готовы к импорту)\n\n`;
  report += `| Провайдер | ExtID | Название | Категория | Цена | Мин/Макс |\n`;
  report += `|-----------|-------|----------|-----------|------|----------|\n`;
  
  for (const s of qualitativeServices) {
    report += `| ${s.providerName} | ${s.extId} | ${s.name} | ${s.category} | ${s.rate} | ${s.min}/${s.max} |\n`;
  }

  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\n✅ Отчет сформирован и сохранен в: ${reportPath}`);
  console.log(`В отчет попали только услуги, соответствующие критериям качества (Refill, Guaranteed, Premium).`);
}

main().catch(console.error).finally(() => process.exit(0));
