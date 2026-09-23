import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting 10-Pass Deep Catalog Audit...');
  
  const services = await prisma.service.findMany({
    include: {
      category: {
        include: {
          network: true
        }
      }
    }
  });

  const orders = await prisma.order.groupBy({
    by: ['serviceId', 'status'],
    _count: {
      id: true
    }
  });

  console.log(`Loaded ${services.length} services and ${orders.length} order groups.`);

  // Prepare results
  const results = {
    duplicates: [] as any[],
    garbage: [] as any[],
    classification: [] as any[],
    dead: [] as any[],
    language: [] as any[],
    priceAnomalies: [] as any[],
    structure: [] as any[],
    popularityRisk: [] as any[],
    coverage: [] as any[],
    legalRisks: [] as any[]
  };

  // --- PASS 1: Duplicates ---
  const normalizedMap = new Map<string, any[]>();
  for (const s of services) {
    if (!s.category || !s.category.network) continue;
    
    let normName = s.name.toLowerCase()
      .replace(/[^\w\sа-яё]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Remove typical prefixes like "123. "
    normName = normName.replace(/^\d+\s*/, '');
    
    const key = `${s.category.network.id}_${normName}`;
    if (!normalizedMap.has(key)) normalizedMap.set(key, []);
    normalizedMap.get(key)!.push(s);
  }

  for (const [key, list] of normalizedMap.entries()) {
    if (list.length > 1) {
      results.duplicates.push({
        normalizedName: key,
        count: list.length,
        services: list.map(s => ({ id: s.id, extId: s.externalId, name: s.name, rate: s.rate }))
      });
    }
  }

  // --- PASS 2: Garbage Services ---
  for (const s of services) {
    const rateNum = Number(s.rate);
    const issues = [];
    if (rateNum > 50000) issues.push('Запредельная цена (>50000)');
    if (s.minQty === s.maxQty && s.maxQty < 10) issues.push('Бесполезный диапазон (min=max<10)');
    if (s.maxQty === 2147483647) issues.push('INT_MAX лимит (не задан)');
    if (rateNum < 0.1 && !s.name.toLowerCase().includes('refill') && !s.name.toLowerCase().includes('cancel')) issues.push('Подозрительно дешево (<0.1) без гарантий');
    if (s.category?.network?.slug === 'other' && rateNum > 1000) issues.push('Дорого для OTHER (>1000)');

    if (issues.length > 0) {
      results.garbage.push({ id: s.id, name: s.name, rate: rateNum, issues });
    }
  }

  // --- PASS 3: Classification Errors ---
  for (const s of services) {
    const nameL = s.name.toLowerCase();
    const catL = s.category?.name?.toLowerCase() || '';
    
    if (nameL.includes('сохранени') && catL.includes('лайк')) results.classification.push({ s, issue: 'Сохранения в лайках' });
    if (nameL.includes('просмотр') && catL.includes('стрим') && !nameL.includes('зрител')) results.classification.push({ s, issue: 'Просмотры в стримах' });
    if (nameL.includes('зрител') && !catL.includes('стрим') && !catL.includes('автопросмотр')) results.classification.push({ s, issue: 'Зрители не в стримах/автопросмотрах' });
    if (nameL.includes('бот') && !catL.includes('робот') && !catL.includes('bot') && catL.includes('живые')) results.classification.push({ s, issue: 'Боты в живых категориях' });
  }

  // --- PASS 4: Dead Services ---
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  for (const s of services) {
    if (s.isActive && s.lastSeenAt && s.lastSeenAt < sevenDaysAgo) {
      results.dead.push({ s, status: 'DEAD' });
    } else if (s.isActive && s.lastSeenAt && s.lastSeenAt < threeDaysAgo) {
      results.dead.push({ s, status: 'STALE' });
    } else if (!s.lastSeenAt && s.externalId) {
      results.dead.push({ s, status: 'NEVER_SYNCED' });
    }
  }

  // --- PASS 5: Language Audit ---
  const cyrillicPattern = /[А-Яа-яЁё]/;
  for (const s of services) {
    if (s.name.length > 5 && !cyrillicPattern.test(s.name)) {
      results.language.push(s);
    }
  }

  // --- PASS 6: Price Anomalies ---
  const rateGroups = new Map<string, number[]>();
  for (const s of services) {
    if (!s.category || !s.category.network) continue;
    const key = `${s.category.network.slug}_${s.category.name}`;
    if (!rateGroups.has(key)) rateGroups.set(key, []);
    rateGroups.get(key)!.push(Number(s.rate));
  }

  const medians = new Map<string, number>();
  for (const [key, rates] of rateGroups.entries()) {
    rates.sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    const median = rates.length % 2 !== 0 ? rates[mid] : (rates[mid - 1] + rates[mid]) / 2;
    medians.set(key, median);
  }

  for (const s of services) {
    if (!s.category || !s.category.network) continue;
    const key = `${s.category.network.slug}_${s.category.name}`;
    const median = medians.get(key) || 0;
    const rate = Number(s.rate);
    
    if (rate > median * 10 && rate > 100) {
      results.priceAnomalies.push({ s, median, type: 'HIGH_OUTLIER' });
    } else if (rate < median / 10 && median > 10) {
      results.priceAnomalies.push({ s, median, type: 'LOW_OUTLIER' });
    }
  }

  // --- PASS 7: Structural Analysis ---
  const catCount = new Map<string, number>();
  const networkActive = new Map<string, number>();
  
  for (const s of services) {
    if (!s.category) continue;
    const cid = s.category.id;
    catCount.set(cid, (catCount.get(cid) || 0) + 1);
    
    if (s.isActive && s.category.network) {
      const nid = s.category.network.id;
      networkActive.set(nid, (networkActive.get(nid) || 0) + 1);
    }
  }

  for (const [cid, count] of catCount.entries()) {
    if (count === 1) {
      const c = services.find(x => x.category?.id === cid)?.category;
      if (c) results.structure.push({ type: 'LONELY_CATEGORY', category: c.name, network: c.network?.name });
    }
  }

  // --- PASS 8: Popularity vs Availability ---
  const serviceOrders = new Map<string, { total: number, errors: number }>();
  for (const o of orders) {
    if (!serviceOrders.has(o.serviceId)) serviceOrders.set(o.serviceId, { total: 0, errors: 0 });
    serviceOrders.get(o.serviceId)!.total += o._count.id;
    if (o.status === 'ERROR') serviceOrders.get(o.serviceId)!.errors += o._count.id;
  }

  const popArray = Array.from(serviceOrders.entries()).map(([id, stats]) => {
    const s = services.find(x => x.id === id);
    const errorRate = stats.total > 0 ? stats.errors / stats.total : 0;
    const riskScore = stats.total * errorRate;
    return { id, s, total: stats.total, errorRate, riskScore };
  });
  
  popArray.sort((a, b) => b.total - a.total);
  const top20 = popArray.slice(0, 20);

  for (const item of top20) {
    if (!item.s) continue;
    if (!item.s.isActive || item.s.isQuarantined || item.errorRate > 0.1) {
      results.popularityRisk.push(item);
    }
  }

  // --- PASS 9: Coverage Map ---
  // A simple representation of missing basic categories (Likes, Views, Subs) in major networks
  const majorNetworks = ['instagram', 'telegram', 'vk', 'youtube', 'tiktok'];
  const basicTypes = ['подписчики', 'лайки', 'просмотры', 'комментарии'];
  
  const coverage = new Set<string>();
  for (const s of services) {
    if (!s.category || !s.category.network) continue;
    const net = s.category.network.slug.toLowerCase();
    const cat = s.category.name.toLowerCase();
    for (const bt of basicTypes) {
      if (cat.includes(bt)) coverage.add(`${net}_${bt}`);
    }
  }

  for (const net of majorNetworks) {
    for (const bt of basicTypes) {
      if (!coverage.has(`${net}_${bt}`)) {
        results.coverage.push({ network: net, missingCategory: bt });
      }
    }
  }

  // --- PASS 10: Legal Risks ---
  const riskKeywords = ['жалоб', 'report', 'complaint', 'спам', 'фейк', 'накрутк'];
  for (const s of services) {
    const nameL = s.name.toLowerCase();
    for (const kw of riskKeywords) {
      if (nameL.includes(kw)) {
        results.legalRisks.push({ s, keyword: kw });
        break;
      }
    }
  }

  // --- GENERATE REPORT ---
  const dateStr = new Date().toISOString().split('T')[0];
  const reportDir = path.join(process.cwd(), '.planning', 'analytics', dateStr);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  let md = `# 🏷️ Catalog Health Report — Smmplan\n`;
  md += `**Дата:** ${new Date().toISOString()}\n`;
  md += `**Услуг проанализировано:** ${services.length}\n`;
  md += `**Проходов:** 10\n\n`;

  const getIcon = (count: number, thresholdYellow: number, thresholdRed: number) => {
    if (count === 0) return '🟢';
    if (count >= thresholdRed) return '🔴';
    return '🟡';
  };

  md += `## Scoreboard\n`;
  md += `| Проход | Статус | Найдено проблем |\n`;
  md += `|--------|--------|-----------------|\n`;
  md += `| Дубликаты | ${getIcon(results.duplicates.length, 1, 10)} | ${results.duplicates.length} групп |\n`;
  md += `| Мусор | ${getIcon(results.garbage.length, 1, 5)} | ${results.garbage.length} услуг |\n`;
  md += `| Классификация | ${getIcon(results.classification.length, 1, 10)} | ${results.classification.length} ошибок |\n`;
  md += `| Мёртвые | ${getIcon(results.dead.length, 1, 10)} | ${results.dead.length} |\n`;
  md += `| Язык | ${getIcon(results.language.length, 1, 20)} | ${results.language.length} без русского |\n`;
  md += `| Цены | ${getIcon(results.priceAnomalies.length, 1, 5)} | ${results.priceAnomalies.length} аномалий |\n`;
  md += `| Структура | ${getIcon(results.structure.length, 1, 5)} | ${results.structure.length} одиноких кат. |\n`;
  md += `| Популярность | ${getIcon(results.popularityRisk.length, 1, 3)} | ${results.popularityRisk.length} рисковых |\n`;
  md += `| Покрытие | ${getIcon(results.coverage.length, 1, 5)} | ${results.coverage.length} пробелов |\n`;
  md += `| Юр. риски | ${getIcon(results.legalRisks.length, 1, 3)} | ${results.legalRisks.length} услуг |\n\n`;

  const totalErrors = results.duplicates.length + results.garbage.length + results.classification.length + 
                      results.dead.length + results.language.length + results.priceAnomalies.length + 
                      results.structure.length + results.popularityRisk.length + results.coverage.length + 
                      results.legalRisks.length;

  // Simplistic score
  const score = Math.max(0, 100 - (totalErrors / services.length) * 100).toFixed(1);
  let rating = 'F';
  if (Number(score) > 90) rating = 'A';
  else if (Number(score) > 75) rating = 'B';
  else if (Number(score) > 60) rating = 'C';
  else if (Number(score) > 40) rating = 'D';

  md += `## Catalog Health Score\n`;
  md += `**Score:** ${score} / 100\n`;
  md += `**Rating:** ${rating}\n\n`;

  md += `## Детальные результаты\n\n`;

  // Duplicates
  if (results.duplicates.length > 0) {
    md += `### 1. Дубликаты (Top 5)\n`;
    results.duplicates.slice(0, 5).forEach(d => {
      md += `- **${d.normalizedName}** (${d.count} шт):\n`;
      d.services.forEach((s: any) => md += `  - [${s.extId}] ${s.name} (Rate: ${s.rate})\n`);
    });
    md += `\n`;
  }

  // Garbage
  if (results.garbage.length > 0) {
    md += `### 2. Мусорные услуги (Top 10)\n`;
    results.garbage.slice(0, 10).forEach(g => {
      md += `- **[${g.id}] ${g.name}**\n  - Issues: ${g.issues.join(', ')} (Rate: ${g.rate})\n`;
    });
    md += `\n`;
  }

  // Classification
  if (results.classification.length > 0) {
    md += `### 3. Ошибки классификации (Top 10)\n`;
    results.classification.slice(0, 10).forEach(c => {
      md += `- **[${c.s.id}] ${c.s.name}**\n  - Issue: ${c.issue}\n`;
    });
    md += `\n`;
  }

  // Dead
  if (results.dead.length > 0) {
    md += `### 4. Мёртвые/Устаревшие услуги (Top 10)\n`;
    results.dead.slice(0, 10).forEach(d => {
      md += `- **[${d.s.id}] ${d.s.name}** - ${d.status} (Last seen: ${d.s.lastSeenAt})\n`;
    });
    md += `\n`;
  }

  // Language
  if (results.language.length > 0) {
    md += `### 5. Услуги без кириллицы (Top 10)\n`;
    results.language.slice(0, 10).forEach(l => {
      md += `- **[${l.id}] ${l.name}**\n`;
    });
    md += `\n`;
  }

  // Price Anomalies
  if (results.priceAnomalies.length > 0) {
    md += `### 6. Ценовые аномалии\n`;
    results.priceAnomalies.slice(0, 10).forEach(p => {
      md += `- **[${p.s.id}] ${p.s.name}**\n  - ${p.type} (Rate: ${p.s.rate}, Median: ${p.median})\n`;
    });
    md += `\n`;
  }

  // Structure
  if (results.structure.length > 0) {
    md += `### 7. Одинокие категории (Top 10)\n`;
    results.structure.slice(0, 10).forEach(st => {
      md += `- **${st.network} -> ${st.category}** (Всего 1 услуга)\n`;
    });
    md += `\n`;
  }

  // Risk
  if (results.popularityRisk.length > 0) {
    md += `### 8. Рисковые популярные услуги\n`;
    results.popularityRisk.slice(0, 10).forEach(r => {
      md += `- **[${r.s?.id}] ${r.s?.name}**\n  - Total Orders: ${r.total}, Error Rate: ${(r.errorRate * 100).toFixed(1)}%\n`;
    });
    md += `\n`;
  }

  // Coverage
  if (results.coverage.length > 0) {
    md += `### 9. Пробелы в покрытии\n`;
    results.coverage.forEach(c => {
      md += `- **${c.network}** отсутствует базовая категория: **${c.missingCategory}**\n`;
    });
    md += `\n`;
  }

  // Legal
  if (results.legalRisks.length > 0) {
    md += `### 10. Юридические риски (ст.272 УК РФ и TOS)\n`;
    results.legalRisks.forEach(l => {
      md += `- **[${l.s.id}] ${l.s.name}** (Ключ: ${l.keyword})\n`;
    });
    md += `\n`;
  }

  const reportPath = path.join(reportDir, 'catalog-report.md');
  fs.writeFileSync(reportPath, md, 'utf-8');
  console.log(`\nAudit complete! Report generated at: ${reportPath}`);

}

main().catch(console.error).finally(() => prisma.$disconnect());
