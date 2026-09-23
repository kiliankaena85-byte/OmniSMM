import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching catalog data...');
  const services = await prisma.service.findMany({
    include: {
      category: {
        include: { network: true }
      },
      _count: {
        select: { orders: true }
      }
    }
  });

  const errorOrdersRaw = await prisma.order.groupBy({
    by: ['serviceId'],
    where: { status: 'ERROR' },
    _count: true
  });
  const errorMap = new Map<string, number>();
  for (const row of errorOrdersRaw) {
    errorMap.set(row.serviceId, row._count);
  }

  const now = new Date();
  const report: string[] = [];
  const addLine = (line: string) => report.push(line);

  // Setup scores
  let criticalIssues = 0;
  let highIssues = 0;
  let mediumIssues = 0;
  let lowIssues = 0;

  // PASS 1: Duplicates
  function normalize(n: string) {
    return n.toLowerCase().replace(/[\[\](){}⚡🔥♻️🌟⭐💎🇷🇺🇺🇸🇹🇷🇮🇳🇨🇳🇮🇹🇺🇿🇪🇺🇮🇩🇹🇭🇸🇦]/g, '').replace(/\s+/g, ' ').replace(/[^a-zа-яё0-9 ]/g, '').trim();
  }
  const dupGroups = new Map<string, any[]>();
  for (const s of services) {
    const net = s.category?.network?.name || 'UNKNOWN';
    const key = `${net}::${normalize(s.name)}`;
    if (!dupGroups.has(key)) dupGroups.set(key, []);
    dupGroups.get(key)!.push(s);
  }
  let dupCount = 0;
  for (const group of dupGroups.values()) {
    if (group.length > 1) {
      dupCount++;
      mediumIssues += group.length - 1;
    }
  }

  // PASS 2: Garbage
  const garbage = [];
  for (const s of services) {
    const net = s.category?.network?.name || 'UNKNOWN';
    const reasons = [];
    if (s.rate > 50000) reasons.push('rate > 50000');
    if (s.minQty === s.maxQty && s.maxQty < 10) reasons.push('min=max < 10');
    if (s.maxQty === 2147483647) reasons.push('INT_MAX');
    if (s.rate < 0.1 && !s.isRefillEnabled && !s.isCancelEnabled) reasons.push('rate < 0.1 and no guarantees');
    if (net === 'OTHER' && s.rate > 1000) reasons.push('OTHER net > 1000 rate');
    
    if (reasons.length > 0) {
      garbage.push({ s, reasons });
      criticalIssues++;
    }
  }

  // PASS 3: Classification
  const misclass = [];
  for (const s of services) {
    const n = s.name.toLowerCase();
    const cat = s.category?.name?.toLowerCase() || '';
    let isErr = false;
    if (n.includes('сохранен') && cat.includes('лайк')) isErr = true;
    if ((n.includes('просмотр') || n.includes('клип')) && cat.includes('стрим') && !n.includes('трансляц')) isErr = true;
    if (n.includes('зрител') && !cat.includes('стрим')) isErr = true;
    if ((n.includes('подписчик') || n.includes('участник')) && !n.includes('premium') && !cat.includes('подписчик') && !cat.includes('участник') && !cat.includes('друз')) isErr = true;
    if (n.includes('реакци') && !cat.includes('реакци') && !cat.includes('эмодзи')) isErr = true;
    if (n.match(/\bбот\b/) && !cat.includes('робот') && !cat.includes('бот') && !n.includes('premium')) isErr = true;

    if (isErr) {
      misclass.push(s);
      mediumIssues++;
    }
  }

  // PASS 4: Dead
  let deadCount = 0;
  let staleCount = 0;
  let neverSyncedCount = 0;
  const deadList = [];
  for (const s of services) {
    if (s.isActive) {
      if (s.lastSeenAt) {
        const diffDays = (now.getTime() - s.lastSeenAt.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) {
          deadCount++;
          highIssues++;
          deadList.push(s);
        } else if (diffDays > 3) {
          staleCount++;
          lowIssues++;
        }
      } else if (s.externalId) {
        neverSyncedCount++;
        mediumIssues++;
      }
    }
  }

  // PASS 5: Language
  const noCyrillic = [];
  for (const s of services) {
    if (!/[а-яА-ЯёЁ]/.test(s.name) && s.name.length > 5 && /[a-zA-Z]{3,}/.test(s.name)) {
      noCyrillic.push(s);
      mediumIssues++;
    }
  }

  // PASS 6: Price Anomalies
  const priceAnomalies = [];
  const catGroups = new Map<string, any[]>();
  for (const s of services) {
    const key = `${s.category?.network?.name} > ${s.category?.name}`;
    if (!catGroups.has(key)) catGroups.set(key, []);
    catGroups.get(key)!.push(s);
  }
  for (const [key, group] of catGroups.entries()) {
    if (group.length >= 3) {
      const rates = group.map(s => s.rate).sort((a, b) => a - b);
      const median = rates[Math.floor(rates.length / 2)];
      for (const s of group) {
        if (s.rate > median * 10 && s.rate > 100) { priceAnomalies.push(s); highIssues++; }
        else if (s.rate < median / 10 && median > 10) { priceAnomalies.push(s); highIssues++; }
      }
    }
  }

  // PASS 7: Structural
  let lonelyCatCount = 0;
  let emptyNetCount = 0;
  for (const group of catGroups.values()) {
    if (group.length === 1) lonelyCatCount++;
  }
  const netCounts = new Map<string, number>();
  for (const s of services) {
    const net = s.category?.network?.name || 'UNKNOWN';
    if (!netCounts.has(net)) netCounts.set(net, 0);
    if (s.isActive) netCounts.set(net, netCounts.get(net)! + 1);
  }
  for (const [net, count] of netCounts.entries()) {
    if (count === 0) emptyNetCount++;
  }

  // PASS 8: Popularity vs Availability
  const popular = [...services].sort((a, b) => b._count.orders - a._count.orders).slice(0, 20);
  let popularRiskCount = 0;
  for (const p of popular) {
    const errCount = errorMap.get(p.id) || 0;
    const totalCount = p._count.orders || 1;
    const errRate = errCount / totalCount;
    if (errRate > 0.1 || !p.isActive || p.isQuarantined || !p.isRefillEnabled) {
      popularRiskCount++;
      highIssues++;
    }
  }

  // PASS 9: Coverage Map
  const catTypes = ['Подписчики', 'Лайки', 'Просмотры', 'Комментарии', 'Реакции'];
  let coverageGaps = 0;
  for (const net of netCounts.keys()) {
    for (const type of catTypes) {
      const hasType = services.some(s => s.isActive && (s.category?.network?.name === net) && (s.category?.name?.includes(type) || s.name.includes(type)));
      if (!hasType) {
        coverageGaps++;
        lowIssues++;
      }
    }
  }

  // PASS 10: Legal
  const legalRisk = [];
  for (const s of services) {
    const n = s.name.toLowerCase();
    if (n.includes('жалоб') || n.includes('report') || n.includes('complaint') || n.includes('спам') || n.includes('фейк') || n.includes('накрутк')) {
      legalRisk.push(s);
      criticalIssues++;
    }
  }

  // Score
  const scoreRaw = 100 - (criticalIssues * 10 + highIssues * 5 + mediumIssues * 2 + lowIssues * 1) / (services.length || 1) * 100;
  const score = Math.max(0, Math.min(100, scoreRaw));
  let rating = 'F';
  if (score > 90) rating = 'A';
  else if (score >= 75) rating = 'B';
  else if (score >= 60) rating = 'C';
  else if (score >= 40) rating = 'D';

  addLine(`# 🏷️ Catalog Health Report — Smmplan`);
  addLine(`**Дата:** ${now.toISOString()}`);
  addLine(`**Услуг проанализировано:** ${services.length}`);
  addLine(`**Проходов:** 10`);
  
  addLine(`\n## Scoreboard`);
  addLine(`| Проход | Статус | Найдено проблем |`);
  addLine(`|--------|--------|-----------------|`);
  addLine(`| 1. Дубликаты | ${dupCount > 0 ? '🟡' : '🟢'} | ${dupCount} групп |`);
  addLine(`| 2. Мусор | ${garbage.length > 0 ? '🔴' : '🟢'} | ${garbage.length} услуг |`);
  addLine(`| 3. Классификация | ${misclass.length > 0 ? '🟡' : '🟢'} | ${misclass.length} ошибок |`);
  addLine(`| 4. Мёртвые | ${deadCount > 0 ? '🔴' : '🟢'} | ${deadCount} мертвых, ${staleCount} stale |`);
  addLine(`| 5. Язык | ${noCyrillic.length > 0 ? '🟡' : '🟢'} | ${noCyrillic.length} без русского |`);
  addLine(`| 6. Цены | ${priceAnomalies.length > 0 ? '🔴' : '🟢'} | ${priceAnomalies.length} аномалий |`);
  addLine(`| 7. Структура | ${lonelyCatCount > 0 || emptyNetCount > 0 ? '🟡' : '🟢'} | ${lonelyCatCount} lonely cats, ${emptyNetCount} empty nets |`);
  addLine(`| 8. Популярность | ${popularRiskCount > 0 ? '🟡' : '🟢'} | ${popularRiskCount} рисковых в топ-20 |`);
  addLine(`| 9. Покрытие | ${coverageGaps > 0 ? '🟡' : '🟢'} | ${coverageGaps} пробелов |`);
  addLine(`| 10. Юр. риски | ${legalRisk.length > 0 ? '🔴' : '🟢'} | ${legalRisk.length} услуг |`);

  addLine(`\n## Catalog Health Score`);
  addLine(`Score = 100 - (CRITICAL × 10 + HIGH × 5 + MEDIUM × 2 + LOW × 1) / TotalServices × 100`);
  addLine(`**Score: ${score.toFixed(1)}/100 (Rating: ${rating})**`);

  addLine(`\n## Детальные находки\n`);
  
  addLine(`### Pass 1: Дубликаты`);
  for (const [key, group] of dupGroups.entries()) {
    if (group.length > 1) {
      addLine(`- **${key}** (${group.length} шт)`);
    }
  }

  addLine(`\n### Pass 2: Мусорные услуги`);
  for (const g of garbage) {
    addLine(`- [${g.s.externalId}] ${g.s.name} (Причины: ${g.reasons.join(', ')})`);
  }

  addLine(`\n### Pass 3: Ошибки классификации`);
  for (const m of misclass) {
    addLine(`- [${m.externalId}] ${m.name} -> в категории ${m.category?.name}`);
  }

  addLine(`\n### Pass 4: Мёртвые услуги`);
  for (const d of deadList) {
    addLine(`- [${d.externalId}] ${d.name} (last seen: ${d.lastSeenAt?.toISOString()})`);
  }

  addLine(`\n### Pass 5: Языковой аудит`);
  for (const e of noCyrillic.slice(0, 20)) {
    addLine(`- [${e.externalId}] ${e.name}`);
  }
  if (noCyrillic.length > 20) addLine(`...и еще ${noCyrillic.length - 20}`);

  addLine(`\n### Pass 6: Ценовые аномалии`);
  for (const p of priceAnomalies) {
    addLine(`- [${p.externalId}] ${p.name} (${p.rate})`);
  }

  addLine(`\n### Pass 8: Риски популярных услуг`);
  for (const p of popular) {
    const errCount = errorMap.get(p.id) || 0;
    const totalCount = p._count.orders || 1;
    const errRate = errCount / totalCount;
    if (errRate > 0.1 || !p.isActive || p.isQuarantined || !p.isRefillEnabled) {
      addLine(`- [${p.externalId}] ${p.name} (Orders: ${totalCount}, ErrRate: ${(errRate*100).toFixed(1)}%, Refill: ${p.isRefillEnabled})`);
    }
  }

  addLine(`\n### Pass 10: Юридически рисковые услуги`);
  for (const l of legalRisk) {
    addLine(`- [${l.externalId}] ${l.name}`);
  }

  addLine(`\n## 📋 Priority Actions`);
  let actIdx = 1;
  if (legalRisk.length > 0) addLine(`${actIdx++}. Убрать или скрыть услуги с юридическим риском (жалобы, репорты).`);
  if (garbage.length > 0) addLine(`${actIdx++}. Удалить или отключить мусорные услуги (экстремальные цены, INT_MAX максимумы).`);
  if (deadCount > 0) addLine(`${actIdx++}. Отключить мертвые услуги (не синхронизировались более 7 дней).`);
  if (priceAnomalies.length > 0) addLine(`${actIdx++}. Проверить услуги с аномальной ценой.`);
  if (misclass.length > 0) addLine(`${actIdx++}. Исправить классификацию услуг.`);

  const outDir = path.join('d:\\SMM_plan_2\\.planning\\analytics', '2026-06-12');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'catalog-report.md'), report.join('\n'));
  console.log('Report generated successfully at ' + path.join(outDir, 'catalog-report.md'));
}

main().catch(console.error).finally(() => prisma.$disconnect());
