import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { db } from '../../src/lib/db';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

async function callOpenRouter(model: string, prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY missing');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://smmplan.pro',
      'X-Title': 'SMMplan Swarm Auditor'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1
    })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter (${res.status}): ${txt}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function auditCatalog() {
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log('  🛡️ SMMplan / SMMflux CATALOG AUDIT & VERIFICATION HARNESS');
  console.log('  Правило бизнеса: берем цены поставщика + наценка, продаем с маржинальностью.');
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  const networks = await db.network.findMany({
    where: { isActive: true },
    orderBy: { sort: 'asc' },
    include: {
      categories: {
        orderBy: { sort: 'asc' },
        include: {
          services: {
            where: { isActive: true, isQuarantined: false },
            include: { provider: true },
            orderBy: { rate: 'asc' }
          }
        }
      }
    }
  });

  const report: {
    totalNetworks: number;
    totalCategories: number;
    totalServices: number;
    emptyCategories: string[];
    misclassifiedServices: { id: string; name: string; currentCategory: string; suggestedCategory: string; reason: string }[];
    targetTypeMismatches: { id: string; name: string; currentTarget: string; expectedTarget: string }[];
    pricingAudit: { id: string; name: string; rate: number; currency: string; markup: number; pricePerUnitRub: number; provider: string }[];
  } = {
    totalNetworks: networks.length,
    totalCategories: 0,
    totalServices: 0,
    emptyCategories: [],
    misclassifiedServices: [],
    targetTypeMismatches: [],
    pricingAudit: []
  };

  for (const net of networks) {
    console.log(`\n🔹 [${net.slug.toUpperCase()}] ${net.name} (${net.categories.length} категорий):`);
    
    for (const cat of net.categories) {
      report.totalCategories++;
      report.totalServices += cat.services.length;
      
      const statusIcon = cat.services.length > 0 ? '✅' : '❌';
      console.log(`   ${statusIcon} Категория: "${cat.name}" (slug: ${cat.slug}) — ${cat.services.length} услуг`);

      if (cat.services.length === 0) {
        report.emptyCategories.push(`[${net.name}] ${cat.name} (${cat.id})`);
      }

      for (const s of cat.services) {
        const p1k = Math.round(s.rate * s.markup * (s.providerCurrency === 'RUB' ? 1.0 : 90.0));
        const pUnit = p1k / 1000;

        // Check targetType sanity
        const isFollowerCat = /подписчик|фолловер|читател|участник|канал|групп/i.test(cat.name);
        const isPostCat = /лайк|просмотр|реакци|репост|комментари|охват|дочитыван/i.test(cat.name);
        const isBotCat = /бот|реферал/i.test(cat.name);

        if (isFollowerCat && s.targetType === 'POST') {
          report.targetTypeMismatches.push({
            id: s.id,
            name: s.name,
            currentTarget: s.targetType,
            expectedTarget: 'PROFILE/CHANNEL/GROUP'
          });
        }

        // Check classification
        const nameLower = s.name.toLowerCase();
        if (isFollowerCat && (nameLower.includes('просмотр') || nameLower.includes('лайк') || nameLower.includes('реакц'))) {
          report.misclassifiedServices.push({
            id: s.id,
            name: s.name,
            currentCategory: cat.name,
            suggestedCategory: 'Просмотры / Лайки',
            reason: 'Название услуги указывает на просмотры/лайки, но лежит в подписчиках'
          });
        }

        if (isPostCat && nameLower.includes('подписчик') && !nameLower.includes('на пост')) {
          report.misclassifiedServices.push({
            id: s.id,
            name: s.name,
            currentCategory: cat.name,
            suggestedCategory: 'Подписчики',
            reason: 'Название услуги указывает на подписчиков, но лежит в просмотрах/лайках'
          });
        }

        report.pricingAudit.push({
          id: s.id,
          name: s.name,
          rate: s.rate,
          currency: s.providerCurrency,
          markup: s.markup,
          pricePerUnitRub: pUnit,
          provider: s.provider?.name || 'Unknown'
        });
      }
    }
  }

  console.log('\n════════════════════════════════════════════════════════════════════════════════');
  console.log('  📊 ИТОГОВЫЙ СВОДНЫЙ АУДИТ БАЗЫ ДАННЫХ:');
  console.log(`  - Всего активных соцсетей: ${report.totalNetworks}`);
  console.log(`  - Всего категорий: ${report.totalCategories}`);
  console.log(`  - Всего активных услуг: ${report.totalServices}`);
  console.log(`  - Пустых категорий: ${report.emptyCategories.length}`);
  console.log(`  - Неправильно классифицированных услуг: ${report.misclassifiedServices.length}`);
  console.log(`  - Несоответствий targetType: ${report.targetTypeMismatches.length}`);
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  if (report.emptyCategories.length > 0) {
    console.log('⚠️ Пустые категории, требующие деактивации или наполнения:');
    report.emptyCategories.forEach(c => console.log('   - ' + c));
  }

  if (report.misclassifiedServices.length > 0) {
    console.log('⚠️ Подозрительные услуги в неверных категориях:');
    report.misclassifiedServices.forEach(m => console.log(`   - [${m.id}] "${m.name}" в "${m.currentCategory}" -> ${m.suggestedCategory} (${m.reason})`));
  }

  if (report.targetTypeMismatches.length > 0) {
    console.log('⚠️ Несоответствия targetType:');
    report.targetTypeMismatches.forEach(t => console.log(`   - [${t.id}] "${t.name}": текущий=${t.currentTarget}, ожидается=${t.expectedTarget}`));
  }

  // Save report to file
  fs.writeFileSync('scripts/harness/catalog-full-audit-report.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Отчет сохранен в scripts/harness/catalog-full-audit-report.json');
}

auditCatalog()
  .catch(console.error)
  .finally(() => db.$disconnect());
