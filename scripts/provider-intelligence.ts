/**
 * MULTI-PROVIDER INTELLIGENCE ENGINE
 * ===================================
 * Скачивает каталоги всех провайдеров, нормализует, находит:
 * 1. Похожие услуги между провайдерами (кросс-матчинг)
 * 2. Перепродавцов (resellers) — одинаковые min/max/refill + наценка
 * 3. Уникальные услуги (есть только у одного провайдера)
 * 4. Лучшие цены по каждой категории
 */

import * as fs from 'fs';
import { db } from '../src/lib/db';
import { VaultService } from '../src/lib/vault';
import { UniversalProvider } from '../src/services/providers/universal.provider';
import { SmartAnalyzerLogic, CATEGORY_LABELS } from '../src/services/providers/smart-analyzer.logic';

interface NormalizedService {
  providerId: string;
  providerName: string;
  extId: string;
  originalName: string;
  normalizedName: string;
  platform: string;
  category: string;
  rate: number;        // USD per 1000
  currency: string;
  rateUSD: number;     // Normalized to USD
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  drip: boolean;
  type: string;
  desc: string;
  // Fingerprint for reseller detection
  fingerprint: string;
}

// RUB → USD approximate rate
const RUB_TO_USD = 1 / 83;

function normalize(name: string): string {
  return name
    .toLowerCase()
    // eslint-disable-next-line no-useless-escape, no-misleading-character-class
    .replace(/[\[\](){}⚡🔥♻️🌟⭐💎🇷🇺🇺🇸🇹🇷🇮🇳🇨🇳🇮🇹🇺🇿🇪🇺🇮🇩🇹🇭🇸🇦🚫🤖📱📢📌📊📦🎵🎭❤️👁👨‍👩‍👧‍👦👥🤝💬🔗🚀⭐🔴🤬]/gu, '')
    .replace(/\s+/g, ' ')
    .replace(/[^a-zа-яё0-9 /]/g, '')
    .trim();
}

/**
 * Create a "fingerprint" from service parameters for reseller detection.
 * If two services from different providers have the same fingerprint,
 * one is likely reselling the other.
 */
function createFingerprint(s: { min: number; max: number; refill: boolean; cancel: boolean; type: string }): string {
  return `${s.min}|${s.max}|${s.refill ? 1 : 0}|${s.cancel ? 1 : 0}|${s.type}`;
}

async function main() {
  console.log('=== Multi-Provider Intelligence Engine ===\n');

  // 1. Fetch all providers from DB
  const providers = await db.provider.findMany({ where: { isActive: true } });
  console.log(`Found ${providers.length} active providers\n`);

  // 2. Fetch services from each provider
  const allServices: NormalizedService[] = [];
  
  for (const prov of providers) {
    process.stdout.write(`Fetching ${prov.name}... `);
    try {
      const decryptedKey = VaultService.decrypt(prov.apiKey);
      const instance = new UniversalProvider(prov.apiUrl, decryptedKey || prov.apiKey);
      const raw = await instance.getServices();
      
      const isRUB = prov.balanceCurrency === 'RUB' || 
                    (prov.name === 'SMMPrime') || (prov.name === 'Soc-Rocket') || (prov.name === 'Soc-Proof');
      
      for (const r of raw) {
        if (r.type !== 'Default') continue;
        
        const analysis = SmartAnalyzerLogic.detectSync(r.name, '', r.category);
        const rate = parseFloat(r.rate as any) || 0;
        const rateUSD = isRUB ? rate * RUB_TO_USD : rate;
        
        allServices.push({
          providerId: prov.id,
          providerName: prov.name,
          extId: String(r.service),
          originalName: r.name,
          normalizedName: normalize(r.name),
          platform: analysis.platform,
          category: CATEGORY_LABELS[analysis.category] || analysis.category,
          rate,
          currency: isRUB ? 'RUB' : 'USD',
          rateUSD,
          min: parseInt(r.min as any) || 0,
          max: parseInt(r.max as any) || 0,
          refill: !!r.refill,
          cancel: !!r.cancel,
          drip: !!r.dripfeed,
          type: r.type,
          desc: (r.desc || '').substring(0, 200),
          fingerprint: createFingerprint({
            min: parseInt(r.min as any) || 0,
            max: parseInt(r.max as any) || 0,
            refill: !!r.refill,
            cancel: !!r.cancel,
            type: r.type,
          }),
        });
      }
      
      console.log(`✅ ${raw.filter(r => r.type === 'Default').length} services`);
    } catch (err: any) {
      console.log(`❌ ${err.message}`);
    }
  }
  
  console.log(`\nTotal normalized services: ${allServices.length}\n`);

  // 3. Group by platform + normalized name → find cross-provider matches
  console.log('=== Cross-Provider Matching ===');
  
  const matchGroups: Record<string, NormalizedService[]> = {};
  for (const s of allServices) {
    const key = `${s.platform}::${s.normalizedName}`;
    if (!matchGroups[key]) matchGroups[key] = [];
    matchGroups[key].push(s);
  }

  // Only keep groups with services from 2+ providers
  const crossMatches: { key: string; services: NormalizedService[] }[] = [];
  for (const [key, group] of Object.entries(matchGroups)) {
    const uniqueProviders = new Set(group.map(s => s.providerName));
    if (uniqueProviders.size >= 2) {
      crossMatches.push({ key, services: group });
    }
  }

  console.log(`Found ${crossMatches.length} cross-provider service matches\n`);

  // 4. RESELLER DETECTION — same fingerprint (min/max/refill/cancel) + price markup
  console.log('=== Reseller Detection ===');
  
  // Group by platform + category + fingerprint
  const fpGroups: Record<string, NormalizedService[]> = {};
  for (const s of allServices) {
    // Use a broader matching — same platform, similar name words, same fingerprint
    const nameWords = s.normalizedName.split(' ').filter(w => w.length > 3).sort().join('_');
    const key = `${s.platform}::${nameWords}::${s.fingerprint}`;
    if (!fpGroups[key]) fpGroups[key] = [];
    fpGroups[key].push(s);
  }

  const resellerCandidates: { key: string; services: NormalizedService[], markupPct: number }[] = [];
  for (const [key, group] of Object.entries(fpGroups)) {
    const uniqueProviders = new Set(group.map(s => s.providerName));
    if (uniqueProviders.size >= 2 && group.length >= 2) {
      // Sort by price to find who sells cheapest (likely original)
      const sorted = [...group].sort((a, b) => a.rateUSD - b.rateUSD);
      const cheapest = sorted[0].rateUSD;
      const mostExpensive = sorted[sorted.length - 1].rateUSD;
      const markupPct = cheapest > 0 ? ((mostExpensive - cheapest) / cheapest) * 100 : 0;
      
      resellerCandidates.push({ key, services: sorted, markupPct });
    }
  }

  // Sort by number of providers (more = more likely resold)
  resellerCandidates.sort((a, b) => {
    const aProvs = new Set(a.services.map(s => s.providerName)).size;
    const bProvs = new Set(b.services.map(s => s.providerName)).size;
    return bProvs - aProvs || b.services.length - a.services.length;
  });

  console.log(`Found ${resellerCandidates.length} reseller candidate groups\n`);

  // 5. Build comprehensive report
  const report: string[] = [];
  report.push('# 🕵️ Мульти-Провайдерная Разведка Smmplan');
  report.push(`\n**Дата:** ${new Date().toISOString()}`);
  report.push(`**Провайдеров:** ${providers.length}`);
  report.push(`**Всего услуг:** ${allServices.length}`);
  report.push(`**Кросс-матчей:** ${crossMatches.length}`);
  report.push(`**Кандидатов на перепродажу:** ${resellerCandidates.length}`);

  // Provider summary
  report.push('\n## 📊 Сводка по провайдерам\n');
  report.push('| Провайдер | Валюта | Услуг | Платформ | Мин.цена | Макс.цена | Медиана |');
  report.push('|-----------|--------|-------|----------|----------|-----------|---------|');
  
  for (const prov of providers) {
    const provServices = allServices.filter(s => s.providerName === prov.name);
    const platforms = new Set(provServices.map(s => s.platform));
    const rates = provServices.map(s => s.rateUSD).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)] || 0;
    const currency = provServices[0]?.currency || '?';
    report.push(`| ${prov.name} | ${currency} | ${provServices.length} | ${platforms.size} | $${rates[0]?.toFixed(4) || '?'} | $${rates[rates.length-1]?.toFixed(2) || '?'} | $${median.toFixed(4)} |`);
  }

  // Cross-provider match table (top 50 most interesting)
  report.push('\n## 🔄 Кросс-провайдерные совпадения (ТОП-50)\n');
  report.push('Услуги, которые продаются у нескольких провайдеров — можно выбрать лучшую цену.\n');

  let matchCount = 0;
  for (const match of crossMatches.slice(0, 50)) {
    matchCount++;
    const [platform, name] = match.key.split('::');
    const sorted = [...match.services].sort((a, b) => a.rateUSD - b.rateUSD);
    const cheapest = sorted[0];
    const savings = sorted.length > 1 ? ((sorted[sorted.length-1].rateUSD - cheapest.rateUSD) / sorted[sorted.length-1].rateUSD * 100) : 0;
    
    report.push(`### ${matchCount}. ${platform} — "${sorted[0].originalName.substring(0, 80)}"`);
    report.push(`Экономия до **${savings.toFixed(0)}%** при выборе лучшего провайдера\n`);
    report.push('| Провайдер | ExtID | Цена (USD/1000) | Мин | Макс | Refill | Cancel |');
    report.push('|-----------|-------|-----------------|-----|------|--------|--------|');
    for (const s of sorted) {
      const best = s === cheapest ? ' 🏆' : '';
      report.push(`| ${s.providerName}${best} | ${s.extId} | $${s.rateUSD.toFixed(4)} | ${s.min} | ${s.max} | ${s.refill ? '✅' : '❌'} | ${s.cancel ? '✅' : '❌'} |`);
    }
    report.push('');
  }

  // Reseller report
  report.push('\n## 🕵️ Обнаруженные перепродавцы\n');
  report.push('Группы услуг с одинаковыми параметрами (min/max/refill/cancel) у разных провайдеров.\n');
  report.push('Провайдер с самой низкой ценой, вероятно, **оригинальный поставщик**.\n');

  // Group resellers by provider pairs to find patterns
  const resellerPairs: Record<string, number> = {};
  for (const rc of resellerCandidates) {
    const provs = [...new Set(rc.services.map(s => s.providerName))].sort();
    for (let i = 0; i < provs.length; i++) {
      for (let j = i + 1; j < provs.length; j++) {
        const pair = `${provs[i]} ↔ ${provs[j]}`;
        resellerPairs[pair] = (resellerPairs[pair] || 0) + 1;
      }
    }
  }

  report.push('### Частота совпадений между провайдерами\n');
  report.push('| Пара провайдеров | Совпадающих услуг | Подозрение |');
  report.push('|------------------|-------------------|------------|');
  const sortedPairs = Object.entries(resellerPairs).sort((a, b) => b[1] - a[1]);
  for (const [pair, count] of sortedPairs) {
    const suspicion = count > 100 ? '🔴 ВЫСОКОЕ' : count > 30 ? '🟡 СРЕДНЕЕ' : '🟢 НИЗКОЕ';
    report.push(`| ${pair} | ${count} | ${suspicion} |`);
  }

  // Show top reseller examples
  report.push('\n### Примеры перепродажи (ТОП-30 по наценке)\n');
  
  const topMarkup = [...resellerCandidates]
    .filter(rc => rc.markupPct > 5 && rc.markupPct < 1000)
    .sort((a, b) => b.markupPct - a.markupPct)
    .slice(0, 30);

  let resIdx = 0;
  for (const rc of topMarkup) {
    resIdx++;
    const original = rc.services[0];  // cheapest = likely original
    const resellers = rc.services.slice(1);
    
    report.push(`**${resIdx}.** "${original.originalName.substring(0, 70)}" (${original.platform})`);
    report.push(`   Оригинал: **${original.providerName}** — $${original.rateUSD.toFixed(4)}`);
    for (const r of resellers) {
      const markup = original.rateUSD > 0 ? ((r.rateUSD - original.rateUSD) / original.rateUSD * 100) : 0;
      report.push(`   Перепродажа: **${r.providerName}** — $${r.rateUSD.toFixed(4)} (+${markup.toFixed(0)}%)`);
    }
    report.push('');
  }

  // Unique services (only at one provider)
  report.push('\n## 💎 Уникальные услуги (есть только у одного провайдера)\n');
  
  const uniqueByProvider: Record<string, number> = {};
  const singleProviderGroups = Object.values(matchGroups).filter(g => {
    const uniqueProvs = new Set(g.map(s => s.providerName));
    return uniqueProvs.size === 1;
  });
  for (const g of singleProviderGroups) {
    const prov = g[0].providerName;
    uniqueByProvider[prov] = (uniqueByProvider[prov] || 0) + g.length;
  }
  
  report.push('| Провайдер | Уникальных услуг |');
  report.push('|-----------|------------------|');
  for (const [prov, count] of Object.entries(uniqueByProvider).sort((a, b) => b[1] - a[1])) {
    report.push(`| ${prov} | ${count} |`);
  }

  // Best prices per platform+category
  report.push('\n## 🏆 Лучшие цены по категориям\n');
  report.push('Какой провайдер самый дешёвый для каждой категории.\n');
  
  const catGroups: Record<string, NormalizedService[]> = {};
  for (const s of allServices) {
    const key = `${s.platform} > ${s.category}`;
    if (!catGroups[key]) catGroups[key] = [];
    catGroups[key].push(s);
  }

  report.push('| Платформа > Категория | Лучший провайдер | Цена USD/1000 | 2-й провайдер | Цена 2-го |');
  report.push('|-----------------------|------------------|---------------|---------------|-----------|');
  
  for (const [key, services] of Object.entries(catGroups).sort()) {
    if (services.length < 2) continue;
    const byProvider: Record<string, number> = {};
    for (const s of services) {
      if (!byProvider[s.providerName] || s.rateUSD < byProvider[s.providerName]) {
        byProvider[s.providerName] = s.rateUSD;
      }
    }
    const sorted = Object.entries(byProvider).sort((a, b) => a[1] - b[1]);
    if (sorted.length >= 2) {
      report.push(`| ${key} | **${sorted[0][0]}** | $${sorted[0][1].toFixed(4)} | ${sorted[1][0]} | $${sorted[1][1].toFixed(4)} |`);
    }
  }

  // Write report
  const fullReport = report.join('\n');
  fs.writeFileSync('scripts/provider-intelligence-report.md', fullReport, 'utf-8');
  console.log(`\n✅ Report written to scripts/provider-intelligence-report.md (${report.length} lines)`);
  
  // Also save raw data for further analysis
  fs.writeFileSync('scripts/all-providers-data.json', JSON.stringify(allServices, null, 2), 'utf-8');
  console.log(`✅ Raw data written to scripts/all-providers-data.json`);
}

main().catch(console.error).finally(() => process.exit(0));
