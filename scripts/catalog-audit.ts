/**
 * DEEP CATALOG AUDIT — Expert-Level Multi-Pass Analysis
 * 
 * Pass 1: Duplicate Detection (same network + near-identical names)
 * Pass 2: Garbage Detection (extremely high price, zero utility, suspicious min/max)
 * Pass 3: Misclassified Services (name doesn't match category)
 * Pass 4: Services with Special Requirements (non-standard link formats, conditions)
 * Pass 5: Language Audit (English-only or untranslated categories)
 * Pass 6: Price Anomaly Detection (outliers per category)
 * Pass 7: Structural Quality (categories with only 1 service, orphaned items)
 */

import * as fs from 'fs';

interface Service {
  id: string;
  extId: string;
  network: string;
  category: string;
  name: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  drip: boolean;
  desc: string;
}

const data: Service[] = JSON.parse(fs.readFileSync('scripts/catalog-dump.json', 'utf-8'));

const report: string[] = [];
const addSection = (title: string) => report.push(`\n## ${title}\n`);
const addLine = (line: string) => report.push(line);

// ============ PASS 1: DUPLICATE DETECTION ============
addSection('🔍 PASS 1: Обнаружение дубликатов');

function normalize(name: string): string {
  return name
    .toLowerCase()
    // eslint-disable-next-line no-useless-escape, no-misleading-character-class
    .replace(/[\[\](){}⚡🔥♻️🌟⭐💎🇷🇺🇺🇸🇹🇷🇮🇳🇨🇳🇮🇹🇺🇿🇪🇺🇮🇩🇹🇭🇸🇦]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zа-яё0-9 ]/g, '')
    .trim();
}

const dupGroups: Record<string, Service[]> = {};
for (const s of data) {
  const key = `${s.network}::${normalize(s.name)}`;
  if (!dupGroups[key]) dupGroups[key] = [];
  dupGroups[key].push(s);
}

let dupCount = 0;
for (const [key, group] of Object.entries(dupGroups)) {
  if (group.length > 1) {
    dupCount++;
    addLine(`**Дублирующая группа** (${group.length} шт): ${key}`);
    for (const s of group) {
      addLine(`  - \`${s.extId}\` ${s.name} — ${s.rate.toFixed(2)} руб/1000, мин=${s.min}, макс=${s.max}`);
    }
  }
}
addLine(`\n**ИТОГО дубликатов:** ${dupCount} групп`);

// ============ PASS 2: GARBAGE / JUNK DETECTION ============
addSection('🗑️ PASS 2: Мусорные услуги');

const garbage: Service[] = [];
const garbageReasons: Map<string, string[]> = new Map();

for (const s of data) {
  const reasons: string[] = [];
  
  // 2a: Экстремально высокая цена (> 50000 руб/1000)
  if (s.rate > 50000) reasons.push(`Цена ${s.rate.toFixed(0)} руб/1000 — запредельная`);
  
  // 2b: Подозрительные min/max (min === max, или max < 10)
  if (s.min === s.max && s.max < 10) reasons.push(`min=max=${s.min} — бесполезный диапазон`);
  if (s.max < 5) reasons.push(`max=${s.max} — слишком маленький максимум`);
  
  // 2c: MAX = 2147483647 (Integer overflow — провайдер не задал лимит)
  if (s.max === 2147483647) reasons.push('max=2^31-1 (INT_MAX) — провайдер не задал лимит, нужно вручную ограничить');
  
  // 2d: Services for niche/dead platforms in OTHER
  if (s.network === 'OTHER' && s.rate > 1000) reasons.push('В "Другое" с высокой ценой — вероятно мусор');
  
  // 2e: Услуги "Онлайн/Офлайн участники" (фейковый онлайн) — спорные услуги
  const nameLower = s.name.toLowerCase();
  if (nameLower.includes('онлайн участник') || nameLower.includes('офлайн участник')) {
    if (s.network === 'DISCORD') reasons.push('Фейковый онлайн в Discord — спорная услуга');
  }
  
  // 2f: Extremely cheap + no refill + no cancel — likely very low quality
  if (s.rate < 0.1 && !s.refill && !s.cancel) reasons.push('Цена < 0.1 руб/1000, без гарантий — крайне низкое качество');
  
  if (reasons.length > 0) {
    garbage.push(s);
    garbageReasons.set(s.extId, reasons);
  }
}

addLine(`**Обнаружено проблемных услуг:** ${garbage.length}\n`);
for (const s of garbage) {
  const reasons = garbageReasons.get(s.extId)!;
  addLine(`- \`${s.extId}\` **${s.network}** > ${s.category} > "${s.name}"`);
  addLine(`  Цена: ${s.rate.toFixed(2)}, Мин: ${s.min}, Макс: ${s.max}`);
  for (const r of reasons) addLine(`  ⚠️ ${r}`);
}

// ============ PASS 3: MISCLASSIFIED SERVICES ============
addSection('🏷️ PASS 3: Ошибки классификации');

const misclassified: Service[] = [];

for (const s of data) {
  const n = s.name.toLowerCase();
  const cat = s.category.toLowerCase();
  
  // "Сохранения" in "Лайки" category
  if (n.includes('сохранен') && cat.includes('лайк')) {
    misclassified.push(s);
    addLine(`- \`${s.extId}\` **"${s.name}"** → в категории "${s.category}" но это **Сохранения**, нужна отдельная или своя категория`);
  }
  
  // "Просмотры" in "Стримы" or vice versa
  if ((n.includes('просмотр') || n.includes('клип')) && cat.includes('стрим') && !n.includes('трансляц')) {
    misclassified.push(s);
    addLine(`- \`${s.extId}\` **"${s.name}"** → в "${s.category}" но это **Просмотры**, а не стримы`);
  }
  
  // "Зрители" not in Стримы
  if (n.includes('зрител') && !cat.includes('стрим')) {
    misclassified.push(s);
    addLine(`- \`${s.extId}\` **"${s.name}"** → в "${s.category}" но "Зрители" должны быть в **Стримах**`);
  }
  
  // "Подписчики" in non-subscriber category
  if ((n.includes('подписчик') || n.includes('участник')) && !n.includes('premium') && 
      !cat.includes('подписчик') && !cat.includes('premium') && !cat.includes('участник') && !cat.includes('друз')) {
    misclassified.push(s);
    addLine(`- \`${s.extId}\` **"${s.name}"** → в "${s.category}" но содержит слово "Подписчики/Участники"`);
  }
  
  // "Бот" in non-bot category (but not "робот" bots)
  if (n.match(/\bбот\b/) && !cat.includes('робот') && !cat.includes('бот') && !n.includes('premium')) {
    misclassified.push(s);
    addLine(`- \`${s.extId}\` **"${s.name}"** → в "${s.category}" но содержит "бот", возможно должна быть в Роботах`);
  }
  
  // "Реакции" not in reactions
  if (n.includes('реакци') && !cat.includes('реакци') && !cat.includes('эмодзи')) {
    misclassified.push(s);
    addLine(`- \`${s.extId}\` **"${s.name}"** → название содержит "реакции" но не в категории Реакций`);
  }
}

addLine(`\n**ИТОГО ошибок классификации:** ${misclassified.length}`);

// ============ PASS 4: SPECIAL REQUIREMENTS ============
addSection('⚙️ PASS 4: Услуги с особыми требованиями');

const specialReqs: { service: Service, reqs: string[] }[] = [];

for (const s of data) {
  const n = s.name.toLowerCase();
  const reqs: string[] = [];
  
  // Time-based services (streams with specific durations)
  const hourMatch = s.name.match(/(\d+)\s*(час|hour)/i);
  if (hourMatch) reqs.push(`Временная услуга: ${hourMatch[0]} — нужен активный стрим/трансляция`);
  
  // Geo-targeted
  if (s.name.match(/🇷🇺|🇺🇸|🇹🇷|🇮🇳|🇨🇳|🇮🇹|🇺🇿|🇪🇺|🇮🇩|🇹🇭|россия|сша|турция|индия|китай|италия|арабы|европа|узбекистан|азия/i)) {
    reqs.push('Геотаргетинг — ограниченная аудитория');
  }
  
  // Services requiring specific link formats
  if (n.includes('клип') || n.includes('reels') || n.includes('shorts')) {
    reqs.push('Требуется ссылка на конкретный формат контента (клип/reels/shorts)');
  }
  
  // Services with "сервер" mentions (specific backend)
  if (n.includes('сервер')) reqs.push('Указан конкретный сервер — может влиять на скорость и качество');
  
  // Services requiring open profile
  if (n.includes('открытый') || n.includes('публичн')) reqs.push('Требуется открытый/публичный профиль');
  
  // Services with drip-feed implications
  if (n.includes('подписк') && (n.includes('авто') || n.includes('будущ') || n.includes('последних'))) {
    reqs.push('Автоматическая подписка на будущие посты — клиент должен понимать что это подписка');
  }
  
  // Voice channel services (Discord)
  if (n.includes('голосовой')) reqs.push('Требуется голосовой канал — нестандартная услуга');
  
  // Warranty/refill button services
  if (n.includes('докрут по кнопке')) reqs.push('Гарантия активируется вручную (по кнопке), а не автоматически');
  
  // Complaints/Reports — very sensitive
  if (n.includes('жалоб') || n.includes('report')) reqs.push('⚠️ ЧУВСТВИТЕЛЬНАЯ УСЛУГА: Жалобы/Репорты — юридический риск');
  
  // Monetizable content
  if (n.includes('монетизируемый') || n.includes('monetiz')) reqs.push('Для монетизируемого контента — клиентам важно');
  
  if (reqs.length > 0) {
    specialReqs.push({ service: s, reqs });
  }
}

addLine(`**Услуг с особыми требованиями:** ${specialReqs.length}\n`);

// Group special requirements by type
const reqTypes: Record<string, { service: Service, reqs: string[] }[]> = {};
for (const item of specialReqs) {
  for (const r of item.reqs) {
    const type = r.split(' — ')[0].split(':')[0].trim();
    if (!reqTypes[type]) reqTypes[type] = [];
    reqTypes[type].push(item);
  }
}

for (const [type, items] of Object.entries(reqTypes)) {
  addLine(`### ${type} (${items.length} услуг)`);
  for (const item of items.slice(0, 5)) {  // Show max 5 examples per type
    addLine(`- \`${item.service.extId}\` ${item.service.network} > "${item.service.name}"`);
  }
  if (items.length > 5) addLine(`  ... и ещё ${items.length - 5} услуг`);
  addLine('');
}

// ============ PASS 5: LANGUAGE AUDIT ============
addSection('🌐 PASS 5: Языковой аудит');

const englishOnly: Service[] = [];
for (const s of data) {
  // Check if name has NO cyrillic characters at all
  if (!/[а-яА-ЯёЁ]/.test(s.name) && s.name.length > 5) {
    // Skip emojis-only names
    if (/[a-zA-Z]{3,}/.test(s.name)) {
      englishOnly.push(s);
    }
  }
}

addLine(`**Услуг без русского языка в названии:** ${englishOnly.length}\n`);
for (const s of englishOnly) {
  addLine(`- \`${s.extId}\` ${s.network} > ${s.category} > **"${s.name}"**`);
}

// ============ PASS 6: PRICE ANOMALIES ============
addSection('💰 PASS 6: Ценовые аномалии');

// Group by network+category, find outliers
const priceGroups: Record<string, Service[]> = {};
for (const s of data) {
  const key = `${s.network} > ${s.category}`;
  if (!priceGroups[key]) priceGroups[key] = [];
  priceGroups[key].push(s);
}

let anomalyCount = 0;
for (const [group, services] of Object.entries(priceGroups)) {
  if (services.length < 3) continue;  // Need at least 3 for statistical analysis
  
  const rates = services.map(s => s.rate).sort((a, b) => a - b);
  const median = rates[Math.floor(rates.length / 2)];
  
  for (const s of services) {
    // If price is 10x above median or 10x below — it's an anomaly
    if (s.rate > median * 10 && s.rate > 100) {
      anomalyCount++;
      addLine(`- \`${s.extId}\` ${group} > **"${s.name}"** — ${s.rate.toFixed(0)} руб/1000 (медиана группы: ${median.toFixed(0)})`);
      addLine(`  ⚠️ Цена в ${(s.rate / median).toFixed(1)}x выше медианы — возможно другой тип услуги или ошибка`);
    }
    if (s.rate < median / 10 && median > 10) {
      anomalyCount++;
      addLine(`- \`${s.extId}\` ${group} > **"${s.name}"** — ${s.rate.toFixed(2)} руб/1000 (медиана группы: ${median.toFixed(0)})`);
      addLine(`  ⚠️ Цена в ${(median / s.rate).toFixed(1)}x ниже медианы — может быть низкое качество`);
    }
  }
}
addLine(`\n**ИТОГО ценовых аномалий:** ${anomalyCount}`);

// ============ PASS 7: STRUCTURAL QUALITY ============
addSection('📊 PASS 7: Структурный анализ');

// Categories with only 1 service
addLine('### Категории с 1 услугой (потенциально неоправданные)');
for (const [group, services] of Object.entries(priceGroups)) {
  if (services.length === 1) {
    addLine(`- ${group}: "${services[0].name}"`);
  }
}

// Networks summary
addLine('\n### Сводная таблица по соцсетям');
addLine('| Соц.сеть | Категорий | Услуг | Мин.цена | Макс.цена | Медиана |');
addLine('|----------|-----------|-------|----------|-----------|---------|');

const networkStats: Record<string, { cats: Set<string>, services: number, rates: number[] }> = {};
for (const s of data) {
  if (!networkStats[s.network]) networkStats[s.network] = { cats: new Set(), services: 0, rates: [] };
  networkStats[s.network].cats.add(s.category);
  networkStats[s.network].services++;
  networkStats[s.network].rates.push(s.rate);
}

for (const [net, stats] of Object.entries(networkStats).sort((a, b) => b[1].services - a[1].services)) {
  const sorted = stats.rates.sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  addLine(`| ${net} | ${stats.cats.size} | ${stats.services} | ${sorted[0].toFixed(2)} | ${sorted[sorted.length - 1].toFixed(0)} | ${med.toFixed(2)} |`);
}

// ============ PASS 8: SENSITIVE / RISKY SERVICES ============
addSection('⚠️ PASS 8: Юридически рисковые услуги');

const risky: Service[] = [];
for (const s of data) {
  const n = s.name.toLowerCase();
  if (n.includes('жалоб') || n.includes('report') || n.includes('complaint') || n.includes('спам') || n.includes('фейк')) {
    risky.push(s);
  }
}

addLine(`**Юридически чувствительных услуг:** ${risky.length}\n`);
for (const s of risky) {
  addLine(`- \`${s.extId}\` ${s.network} > "${s.name}" — **${s.rate.toFixed(2)} руб/1000**`);
}
addLine('\n> ⚠️ **РЕКОМЕНДАЦИЯ:** Услуги по подаче жалоб/репортов несут юридический риск (ст.272 УК РФ, мошенничество). Рекомендуется скрыть или пометить как "только для опытных пользователей" с дополнительным дисклеймером.');

// ============ SUMMARY ============
addSection('📋 ИТОГОВЫЕ РЕКОМЕНДАЦИИ');

addLine(`
### Статистика каталога
- **Всего услуг:** ${data.length}
- **Соцсетей:** ${Object.keys(networkStats).length}
- **Категорий:** ${new Set(data.map(s => s.category)).size}
- **Дубликатов:** ${dupCount} групп
- **Мусорных/проблемных:** ${garbage.length}
- **Ошибок классификации:** ${misclassified.length}
- **Без русского языка:** ${englishOnly.length}
- **Ценовых аномалий:** ${anomalyCount}
- **Юридически рисковых:** ${risky.length}

### Приоритетные действия
1. **Исправить классификацию** — "Instagram Сохранения" лежит в "Лайках", нужно перенести в "Сохранения" или создать новую категорию
2. **Ограничить INT_MAX** — Услуги с max=2147483647 нужно ограничить разумным числом (10M)
3. **Перевести на русский** — Все англоязычные названия перевести
4. **Скрыть жалобы** — Услуги "Жалобы/Reports" требуют юридического дисклеймера
5. **Удалить чистые дубликаты** — Группы с одинаковым нормализованным названием
6. **Проверить ценовые аномалии** — Услуги с ценой в 10x от медианы группы
`);

// Write report
const fullReport = `# 🔬 Глубокий Аудит Каталога Smmplan\n\n**Дата:** ${new Date().toISOString()}\n**Услуг проанализировано:** ${data.length}\n**Проходов анализа:** 8\n\n` + report.join('\n');

fs.writeFileSync('scripts/catalog-audit-report.md', fullReport, 'utf-8');
console.log(`Report written to scripts/catalog-audit-report.md (${report.length} lines)`);
