/**
 * SMM CATALOG CURATOR — "Коммерческий Директор"
 * ==============================================
 * Роль: Опытный специалист по продажам SMM-услуг в РФ.
 * Задача: Из 11,000+ услуг выбрать 400-800 проверенных для витрины.
 * 
 * Принципы отбора:
 * 1. Российский рынок — Telegram, VK, Instagram, YouTube, TikTok приоритет
 * 2. Цена-качество — для каждого типа 2-3 ценовых тира
 * 3. Стабильность — refill + cancel = надёжные
 * 4. Адекватные лимиты — min не слишком высокий, max не INT_MAX
 * 5. Понятное название — клиент должен понимать что покупает
 * 6. Легальность — никаких жалоб/reports
 */

import * as fs from 'fs';
import { SmartAnalyzerLogic, CATEGORY_LABELS } from '../src/services/providers/smart-analyzer.logic';

interface RawService {
  providerName: string;
  extId: string;
  originalName: string;
  platform: string;
  category: string;
  rate: number;
  currency: string;
  rateUSD: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  drip: boolean;
  desc: string;
  fingerprint: string;
}

interface CuratedService {
  rank: number;
  platform: string;
  category: string;
  tier: 'Бюджет' | 'Стандарт' | 'Премиум';
  providerName: string;
  extId: string;
  name: string;
  description: string; // custom description from provider
  priceRUB_per1000: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  drip: boolean;
  qualityScore: number;
  reason: string;
}

// === MARKET KNOWLEDGE ===

// Priority platforms for Russian SMM startup (order matters)
const PLATFORM_PRIORITY: Record<string, number> = {
  // === ТОП-5: Основные платформы РФ (80-100) ===
  'TELEGRAM':  100,  // #1 в России
  'VK':         95,  // #2 для бизнеса в РФ
  'INSTAGRAM':  90,  // Всё ещё топ для визуала
  'YOUTUBE':    85,  // Видео-маркетинг
  'TIKTOK':     80,  // Растущий рынок
  // === ВАЖНЫЕ: Стриминг + Бизнес (50-79) ===
  'TWITCH':     75,  // 🔴 Стримеры — ГЛАВНАЯ стрим-платформа
  'KICK':       60,  // Альтернативный стриминг, растёт
  'TWITTER':    55,  // X — хайп, крипто, западная аудитория
  'WEBSITE':    50,  // 🌐 WEB-трафик — важно для SEO/бизнеса
  'OK':         45,  // Одноклассники — 40+ аудитория
  'FACEBOOK':   40,  // Бизнес-страницы, таргет
  'RUTUBE':     40,  // Русский YouTube, растёт
  // === СРЕДНИЕ: Нишевые (20-39) ===
  'DISCORD':    30,  // Геймеры, крипто-сообщества
  'SPOTIFY':    25,  // Музыканты, подкастеры
  'DZEN':       25,  // Яндекс Дзен, контент-маркетинг
  'LIKEE':      20,  // Маленький, но есть спрос
  'WHATSAPP':   20,  // Каналы WhatsApp
  'YANDEX':     20,  // Яндекс сервисы
  'STEAM':      20,  // Геймеры — Steam Workshop
  'MAX':        40,  // 🔴 Мессенджер MAX — важная платформа
  'SOUNDCLOUD': 15,  // Музыканты
  'TROVO':      15,  // Стриминг, нишевый
  'LINKEDIN':   15,  // API маркетинг
  // === ДОПОЛНИТЕЛЬНЫЕ: Западные (5-14) ===
  'THREADS':    10,
  'PINTEREST':  10,
  'REDDIT':     10,
  'TUMBLR':      8,
  'GOOGLE':     10,  // Google Reviews
  'RUMBLE':      8,
  'MEDIUM':      8,
  'QUORA':       8,
  'SHAZAM':      8,
  'MUSIC':       8,
  'AUDIOMACK':   5,
  'OTHER':       3,
};

// Must-have categories for each priority platform
const MUST_HAVE_CATEGORIES: Record<string, string[]> = {
  'TELEGRAM': ['Подписчики', 'Просмотры', 'Реакции', 'Боты', 'Бусты', 'Premium', 'Комментарии', 'Репосты', 'Сториз'],
  'VK': ['Лайки', 'Подписчики', 'Просмотры', 'Вступление', 'Репосты', 'Голоса', 'Прослушивания', 'Стримы'],
  'INSTAGRAM': ['Лайки', 'Подписчики', 'Просмотры', 'Сохранения', 'Комментарии', 'Репосты', 'Сториз'],
  'YOUTUBE': ['Лайки', 'Подписчики', 'Просмотры', 'Комментарии', 'Репосты', 'Стримы'],
  'TIKTOK': ['Лайки', 'Подписчики', 'Просмотры', 'Сохранения', 'Репосты', 'Стримы'],
  'TWITCH': ['Подписчики', 'Стримы', 'Просмотры', 'Боты', 'Вступление', 'Лайки', 'Репосты'],
  'KICK': ['Подписчики', 'Стримы', 'Просмотры', 'Боты', 'Лайки'],
  'TWITTER': ['Лайки', 'Подписчики', 'Просмотры', 'Репосты', 'Комментарии'],
  'WEBSITE': ['Трафик', 'Просмотры'],
  'DISCORD': ['Подписчики', 'Реакции', 'Стримы'],
  'SPOTIFY': ['Прослушивания', 'Подписчики', 'Сохранения'],
  'FACEBOOK': ['Лайки', 'Подписчики', 'Просмотры', 'Стримы'],
  'RUTUBE': ['Просмотры', 'Подписчики', 'Лайки', 'Комментарии'],
  'MAX': ['Подписчики', 'Просмотры', 'Реакции', 'Комментарии', 'Репосты', 'Голоса'],
};

// Max services per platform tier
const PLATFORM_BUDGET: Record<string, number> = {
  // ТОП-5 — максимальный ассортимент
  'TELEGRAM':   120,
  'VK':          70,
  'INSTAGRAM':   70,
  'YOUTUBE':     60,
  'TIKTOK':      55,
  // ВАЖНЫЕ — расширенный ассортимент
  'TWITCH':      60,  // 🔴 Расширен! Стримы — ключевой рынок
  'KICK':        40,  // 🔴 Расширен! Растущая стрим-платформа
  'TWITTER':     35,
  'WEBSITE':     30,  // 🌐 WEB-трафик — много вариантов
  'OK':          25,
  'FACEBOOK':    30,
  'RUTUBE':      30,  // 🇷🇺 Российский YouTube
  // СРЕДНИЕ — хороший ассортимент
  'DISCORD':     20,
  'SPOTIFY':     20,
  'DZEN':        15,
  'LIKEE':       10,
  'WHATSAPP':    15,
  'YANDEX':      15,
  'STEAM':       15,
  'MAX':         25,  // 🔴 Расширен! Мессенджер MAX
  'SOUNDCLOUD':  10,
  'TROVO':       10,
  'LINKEDIN':    10,
  // ДОПОЛНИТЕЛЬНЫЕ
  'THREADS':     10,
  'PINTEREST':   10,
  'REDDIT':      10,
  'TUMBLR':       8,
  'GOOGLE':       8,
  'RUMBLE':       8,
  'MEDIUM':       8,
  'QUORA':        8,
  'SHAZAM':       5,
  'MUSIC':       10,
};

// Blacklisted terms (услуги с этими словами не попадают на витрину)
const BLACKLIST_TERMS = [
  'жалоб', 'report', 'complaint', 'claim', 'wibes', 
  'test', 'тест', 'пробн', 'demo',
  '18+', 'adult', 'порно', 'xxx',
  'hack', 'взлом', 'пароль', 'password',
  'накрутк', // мета-слово, клиент не должен его видеть
];

// === QUALITY SCORING ===

function scoreService(s: RawService): number {
  let score = 0;
  
  // Platform priority (0-100)
  score += (PLATFORM_PRIORITY[s.platform] || 0);
  
  // Refill = reliability (+20)
  if (s.refill) score += 20;
  
  // Cancel = safety net (+10)
  if (s.cancel) score += 10;
  
  // Drip feed = advanced feature (+5)
  if (s.drip) score += 5;
  
  // Reasonable min order (+15 if min <= 100, +10 if <= 500)
  if (s.min <= 100) score += 15;
  else if (s.min <= 500) score += 10;
  else if (s.min <= 1000) score += 5;
  // min > 1000 = penalty
  else score -= 10;
  
  // Reasonable max order (+10 if reasonable)
  if (s.max >= 10000 && s.max <= 10000000) score += 10;
  else if (s.max >= 1000) score += 5;
  
  // Price competitiveness (lower = better, but not suspiciously cheap)
  if (s.rateUSD >= 0.001 && s.rateUSD <= 0.1) score += 15; // Very cheap
  else if (s.rateUSD <= 1) score += 12;
  else if (s.rateUSD <= 10) score += 8;
  else if (s.rateUSD <= 50) score += 5;
  else if (s.rateUSD <= 200) score += 2;
  // > 200 USD — very expensive, penalty
  else score -= 5;

  // Suspiciously cheap penalty (likely bots / will drop)
  if (s.rateUSD > 0 && s.rateUSD < 0.005) score -= 10;
  
  // Has description = more transparent (+3)
  if (s.desc && s.desc.length > 20) score += 3;
  
  // Name quality — Russian name is better for RU market
  const hasRussian = /[а-яё]/i.test(s.originalName);
  if (hasRussian) score += 5;
  
  return score;
}

function determineTier(s: RawService, allInCategory: RawService[]): 'Бюджет' | 'Стандарт' | 'Премиум' {
  const rates = allInCategory.map(x => x.rateUSD).sort((a, b) => a - b);
  const p33 = rates[Math.floor(rates.length * 0.33)] || 0;
  const p66 = rates[Math.floor(rates.length * 0.66)] || 0;
  
  if (s.rateUSD <= p33) return 'Бюджет';
  if (s.rateUSD <= p66) return 'Стандарт';
  return 'Премиум';
}

async function main() {
  console.log('=== Коммерческий Директор: Курирование каталога ===\n');
  
  // Load raw data
  const rawData: RawService[] = JSON.parse(fs.readFileSync('scripts/all-providers-data.json', 'utf-8'));
  console.log(`Загружено ${rawData.length} услуг от всех провайдеров\n`);
  
  // Step 1: Filter out garbage
  console.log('--- Шаг 1: Фильтрация мусора ---');
  const filtered = rawData.filter(s => {
    const nameLower = s.originalName.toLowerCase();
    
    // Blacklisted terms
    if (BLACKLIST_TERMS.some(term => nameLower.includes(term))) return false;
    
    // Zero or negative rate
    if (s.rateUSD <= 0) return false;
    
    // INT_MAX or absurd max
    if (s.max > 100000000) return false;
    
    // Min > max (broken service)
    if (s.min > s.max) return false;
    
    // Unknown platform
    if (!s.platform || s.platform === 'UNKNOWN') return false;
    
    // Absurdly expensive (>$5000 per 1000 in USD)
    if (s.rateUSD > 5000) return false;
    
    // min=max=1 (package deals — we handle these separately)
    // Allow them but flag
    
    return true;
  });
  console.log(`  После фильтрации: ${filtered.length} (убрано ${rawData.length - filtered.length} мусорных)\n`);
  
  // Step 2: Group by platform + category (normalized via SmartAnalyzerLogic)
  console.log('--- Шаг 2: Группировка по платформа+категория ---');
  const groups: Record<string, RawService[]> = {};
  for (const s of filtered) {
    const analyzed = SmartAnalyzerLogic.detectSync(s.originalName, s.desc, s.category);
    s.platform = analyzed.platform;
    s.category = analyzed.category;

    const key = `${s.platform}::${s.category}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  console.log(`  ${Object.keys(groups).length} уникальных каноничных групп\n`);
  
  // Step 3: For each group, score and select best services
  console.log('--- Шаг 3: Скоринг и отбор ---');
  
  const curated: CuratedService[] = [];
  
  for (const [key, services] of Object.entries(groups)) {
    const [platform, category] = key.split('::');
    const budget = PLATFORM_BUDGET[platform] || 3;
    
    // Skip very low priority platforms entirely if they'd get < 3 services
    if ((PLATFORM_PRIORITY[platform] || 0) < 2) continue;
    
    // Score all services
    const scored = services.map(s => ({
      ...s,
      score: scoreService(s),
      tier: determineTier(s, services),
    }));
    
    // Sort by score (best first)
    scored.sort((a, b) => b.score - a.score);
    
    // Берём ВСЕ провайдеры — для тестирования качества
    // Для каждого тира берём по 1-2 от КАЖДОГО провайдера
    
    const categoryBudget = Math.max(3, Math.min(10, Math.ceil(budget / 5)));
    
    // Group by tier and pick best from each
    const byTier: Record<string, typeof scored> = { 'Бюджет': [], 'Стандарт': [], 'Премиум': [] };
    for (const s of scored) {
      byTier[s.tier].push(s);
    }
    
    const selected: typeof scored = [];
    
    // === СТРАТЕГИЯ: берём от ВСЕХ провайдеров для тестирования ===
    
    // Pick бюджетные — от разных провайдеров
    const budgets = byTier['Бюджет'].filter(s => s.score > 25);
    const seenBudgetProviders = new Set<string>();
    for (const s of budgets) {
      if (selected.length >= categoryBudget) break;
      if (!seenBudgetProviders.has(s.providerName)) {
        selected.push(s);
        seenBudgetProviders.add(s.providerName);
      }
    }
    
    // Pick стандартные — от разных провайдеров
    const standards = byTier['Стандарт'].filter(s => s.score > 25);
    const seenStdProviders = new Set<string>();
    for (const s of standards) {
      if (selected.length >= categoryBudget) break;
      if (!seenStdProviders.has(s.providerName)) {
        selected.push(s);
        seenStdProviders.add(s.providerName);
      }
    }
    
    // Pick премиум — от разных провайдеров
    const premiums = byTier['Премиум']
      .filter(s => s.score > 25)
      .sort((a, b) => {
        const aBonus = (a.refill ? 50 : 0) + (a.cancel ? 20 : 0) + a.score;
        const bBonus = (b.refill ? 50 : 0) + (b.cancel ? 20 : 0) + b.score;
        return bBonus - aBonus;
      });
    const seenPremProviders = new Set<string>();
    for (const s of premiums) {
      if (selected.length >= categoryBudget) break;
      if (!seenPremProviders.has(s.providerName)) {
        if (!selected.some(x => x.extId === s.extId && x.providerName === s.providerName)) {
          selected.push(s);
          seenPremProviders.add(s.providerName);
        }
      }
    }
    
    // Дозаполнение — от провайдеров, которых ещё нет
    if (selected.length < categoryBudget) {
      for (const s of scored) {
        if (selected.length >= categoryBudget) break;
        if (selected.some(x => x.extId === s.extId && x.providerName === s.providerName)) continue;
        if (s.score > 20) selected.push(s);
      }
    }
    
    // Convert to curated format
    for (const s of selected) {
      const priceRUB = s.currency === 'RUB' ? s.rate : s.rateUSD * 83;
      
      curated.push({
        rank: 0,
        platform,
        category: CATEGORY_LABELS[category] || category,
        tier: s.tier,
        providerName: s.providerName,
        extId: s.extId,
        name: s.originalName,
        description: s.desc || '', // keep provider description
        priceRUB_per1000: Math.round(priceRUB * 100) / 100,
        min: s.min,
        max: s.max,
        refill: s.refill,
        cancel: s.cancel,
        drip: s.drip,
        qualityScore: s.score,
        reason: buildReason(s),
      });
    }
  }
  
  // Sort curated list by platform priority then score
  curated.sort((a, b) => {
    const pA = PLATFORM_PRIORITY[a.platform] || 0;
    const pB = PLATFORM_PRIORITY[b.platform] || 0;
    if (pA !== pB) return pB - pA;
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return b.qualityScore - a.qualityScore;
  });
  
  // Assign ranks
  curated.forEach((s, i) => s.rank = i + 1);
  
  console.log(`\n🎯 ИТОГО ОТОБРАНО: ${curated.length} услуг\n`);
  
  // Stats
  const byPlatform: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  const byTierTotal: Record<string, number> = {};
  for (const s of curated) {
    byPlatform[s.platform] = (byPlatform[s.platform] || 0) + 1;
    byProvider[s.providerName] = (byProvider[s.providerName] || 0) + 1;
    byTierTotal[s.tier] = (byTierTotal[s.tier] || 0) + 1;
  }
  
  console.log('По платформам:');
  for (const [p, c] of Object.entries(byPlatform).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${c} услуг`);
  }
  
  console.log('\nПо провайдерам:');
  for (const [p, c] of Object.entries(byProvider).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${p}: ${c} услуг`);
  }
  
  console.log('\nПо тирам:');
  for (const [t, c] of Object.entries(byTierTotal)) {
    console.log(`  ${t}: ${c} услуг`);
  }
  
  // Generate report
  const report: string[] = [];
  report.push('# 🛒 Курированный каталог Smmplan');
  report.push(`\n**Дата:** ${new Date().toISOString().split('T')[0]}`);
  report.push(`**Куратор:** Коммерческий Директор AI`);
  report.push(`**Из ${rawData.length} отобрано ${curated.length} услуг**`);
  report.push(`**Провайдеров задействовано:** ${Object.keys(byProvider).length}`);
  
  report.push('\n## 📊 Распределение\n');
  report.push('### По платформам\n');
  report.push('| Платформа | Услуг | Приоритет |');
  report.push('|-----------|-------|-----------|');
  for (const [p, c] of Object.entries(byPlatform).sort((a, b) => (PLATFORM_PRIORITY[b[0]]||0) - (PLATFORM_PRIORITY[a[0]]||0))) {
    const prio = PLATFORM_PRIORITY[p] || 0;
    const indicator = prio >= 80 ? '🔴 ТОП' : prio >= 40 ? '🟡 СР' : '🟢 НИЗ';
    report.push(`| ${p} | ${c} | ${indicator} (${prio}) |`);
  }
  
  report.push('\n### По провайдерам\n');
  report.push('| Провайдер | Услуг в витрине | Доля |');
  report.push('|-----------|-----------------|------|');
  for (const [p, c] of Object.entries(byProvider).sort((a, b) => b[1] - a[1])) {
    report.push(`| ${p} | ${c} | ${(c / curated.length * 100).toFixed(0)}% |`);
  }
  
  report.push('\n### По ценовым тирам\n');
  report.push('| Тир | Услуг | Описание |');
  report.push('|-----|-------|----------|');
  report.push(`| 💚 Бюджет | ${byTierTotal['Бюджет'] || 0} | Самые дешёвые, возможно боты |`);
  report.push(`| 💛 Стандарт | ${byTierTotal['Стандарт'] || 0} | Баланс цены и качества |`);
  report.push(`| ❤️ Премиум | ${byTierTotal['Премиум'] || 0} | Максимальное качество, refill |`);
  
  // Detailed catalog by platform
  let currentPlatform = '';
  for (const s of curated) {
    if (s.platform !== currentPlatform) {
      currentPlatform = s.platform;
      const prio = PLATFORM_PRIORITY[currentPlatform] || 0;
      report.push(`\n---\n\n## ${currentPlatform} (приоритет: ${prio})\n`);
      report.push('| # | Тир | Категория | Услуга | Описание | Провайдер | ExtID | ₽/1000 | Min | Max | Refill | Cancel |');
      report.push('|---|-----|-----------|--------|----------|-----------|-------|--------|-----|-----|--------|--------|');
    }
    
    const tierEmoji = s.tier === 'Бюджет' ? '💚' : s.tier === 'Стандарт' ? '💛' : '❤️';
    const fullName = s.name;
    const description = s.description.length > 80 ? s.description.substring(0, 77) + '...' : s.description;
    
    report.push(`| ${s.rank} | ${tierEmoji} | ${s.category} | ${fullName} | ${description} | ${s.providerName} | ${s.extId} | ${s.priceRUB_per1000.toFixed(2)} | ${s.min} | ${s.max} | ${s.refill ? '✅' : '—'} | ${s.cancel ? '✅' : '—'} |`);
  }
  
  fs.writeFileSync('scripts/curated-catalog.md', report.join('\n'), 'utf-8');
  console.log(`\n✅ Отчёт: scripts/curated-catalog.md`);
  
  // Save JSON for import
  fs.writeFileSync('scripts/curated-catalog.json', JSON.stringify(curated, null, 2), 'utf-8');
  console.log(`✅ JSON для импорта: scripts/curated-catalog.json`);
}

function buildReason(s: any): string {
  const reasons: string[] = [];
  if (s.refill) reasons.push('гарантия refill');
  if (s.cancel) reasons.push('отмена возможна');
  if (s.drip) reasons.push('drip-feed');
  if (s.rateUSD < 1) reasons.push('бюджетная цена');
  if (s.score > 100) reasons.push('высокий скоринг');
  return reasons.join(', ') || 'базовый отбор';
}

main().catch(console.error).finally(() => process.exit(0));
