import * as fs from 'fs';
import * as path from 'path';
import { db } from '../../src/lib/db';

interface NormalizedService {
  providerId: string;
  providerName: string;
  extId: string;
  originalName: string;
  normalizedName: string;
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
  type: string;
  desc: string;
  fingerprint: string;
}

async function main() {
  console.log('=== Provider Intelligence Analyst (gsd-analytics-intel) ===\n');

  const jsonPath = path.join(process.cwd(), 'scripts', 'all-providers-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error("Missing scripts/all-providers-data.json cache");
    process.exit(1);
  }

  const allServices: NormalizedService[] = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  console.log(`Loaded ${allServices.length} services from cache.`);

  const providers = await db.provider.findMany();
  const providerMap = new Map(providers.map(p => [p.name, p]));
  
  // Active services in our system
  const activeDbServices = await db.service.findMany({ 
    where: { isActive: true },
    include: { provider: true, category: true }
  });

  // Calculate Error Rate and Refill Reliability per provider from DB Orders
  const orders = await db.order.findMany({
    where: { providerId: { not: null } },
    select: { providerId: true, status: true, provider: { select: { name: true } } }
  });

  const providerStats: Record<string, { totalOrders: number, errors: number, refills: number, successfulRefills: number }> = {};
  providers.forEach(p => {
    providerStats[p.name] = { totalOrders: 0, errors: 0, refills: 0, successfulRefills: 0 };
  });

  for (const o of orders) {
    if (!o.provider?.name) continue;
    const stats = providerStats[o.provider.name];
    if (stats) {
      stats.totalOrders++;
      if (o.status === 'ERROR' || o.status === 'CANCELED') stats.errors++;
    }
  }

  // Refills data
  const dbRefills = await db.refill.findMany({
    include: { order: { include: { provider: true } } }
  }).catch(() => []); // If refill table doesn't exist or similar

  for (const r of dbRefills) {
    const provName = (r as any).order?.provider?.name;
    if (provName && providerStats[provName]) {
      providerStats[provName].refills++;
      if ((r as any).status === 'COMPLETED') {
        providerStats[provName].successfulRefills++;
      }
    }
  }

  // Analysis 1: Cross-Provider Matching & Best Price
  const matchGroups: Record<string, NormalizedService[]> = {};
  for (const s of allServices) {
    const key = `${s.platform}::${s.normalizedName}`;
    if (!matchGroups[key]) matchGroups[key] = [];
    matchGroups[key].push(s);
  }

  // Analysis 2: Reseller Detection
  const fpGroups: Record<string, NormalizedService[]> = {};
  for (const s of allServices) {
    const nameWords = s.normalizedName.split(' ').filter(w => w.length > 3).sort().join('_');
    const key = `${s.platform}::${nameWords}::${s.fingerprint}`;
    if (!fpGroups[key]) fpGroups[key] = [];
    fpGroups[key].push(s);
  }

  const resellerPairs: Record<string, number> = {};
  for (const group of Object.values(fpGroups)) {
    const uniqueProviders = [...new Set(group.map(s => s.providerName))];
    if (uniqueProviders.length >= 2 && group.length >= 2) {
      for (let i = 0; i < uniqueProviders.length; i++) {
        for (let j = i + 1; j < uniqueProviders.length; j++) {
          const pair = [uniqueProviders[i], uniqueProviders[j]].sort().join(' ↔ ');
          resellerPairs[pair] = (resellerPairs[pair] || 0) + 1;
        }
      }
    }
  }

  // Analysis 5: Provider Scorecard
  const scorecard: Record<string, { score: number, rank: string, errRate: number, catalog: number, refillRate: number, avgPos: number }> = {};
  
  // Calculate avg position in category
  const catGroups: Record<string, NormalizedService[]> = {};
  for (const s of allServices) {
    const key = `${s.platform} > ${s.category}`;
    if (!catGroups[key]) catGroups[key] = [];
    catGroups[key].push(s);
  }

  const providerPosSum: Record<string, { sum: number, count: number }> = {};
  providers.forEach(p => providerPosSum[p.name] = { sum: 0, count: 0 });

  for (const group of Object.values(catGroups)) {
    if (group.length < 2) continue;
    const byProv: Record<string, number> = {};
    for (const s of group) {
      if (!byProv[s.providerName] || s.rateUSD < byProv[s.providerName]) {
        byProv[s.providerName] = s.rateUSD;
      }
    }
    const sorted = Object.entries(byProv).sort((a, b) => a[1] - b[1]);
    sorted.forEach(([provName, _], idx) => {
      if (providerPosSum[provName]) {
        providerPosSum[provName].sum += (idx + 1);
        providerPosSum[provName].count++;
      }
    });
  }

  const uniqueServiceProviders = new Set(allServices.map(s => s.providerName));
  for (const provName of uniqueServiceProviders) {
    const catalogSize = allServices.filter(s => s.providerName === provName).length;
    const st = providerStats[provName] || { totalOrders: 0, errors: 0, refills: 0, successfulRefills: 0 };
    
    const errorRate = st.totalOrders > 0 ? (st.errors / st.totalOrders) : 0;
    const errScore = Math.max(0, 100 - (errorRate * 100)); // 30%
    
    const catalogScore = Math.min(100, (catalogSize / 2000) * 100); // 15% (2000 is good)
    
    const refillRate = st.refills > 0 ? (st.successfulRefills / st.refills) : 1; 
    const refillScore = refillRate * 100; // 15%
    
    const posData = providerPosSum[provName];
    const avgPos = posData && posData.count > 0 ? (posData.sum / posData.count) : 3;
    // Avg pos 1 => 100, pos 5 => ~0
    const priceScore = Math.max(0, 100 - ((avgPos - 1) * 25)); // 30%

    // Balance health 10% (assume 100 for now if active)
    const balanceScore = 100;

    const totalScore = (priceScore * 0.3) + (errScore * 0.3) + (catalogScore * 0.15) + (refillScore * 0.15) + (balanceScore * 0.10);
    
    let rank = 'F';
    if (totalScore >= 90) rank = 'S';
    else if (totalScore >= 75) rank = 'A';
    else if (totalScore >= 60) rank = 'B';
    else if (totalScore >= 40) rank = 'C';

    scorecard[provName] = { score: totalScore, rank, errRate: errorRate * 100, catalog: catalogSize, refillRate: refillRate * 100, avgPos };
  }

  // Analysis 6: Vendor Lock-In Risk
  const vendorLockIn: { category: string, provider: string, risk: string, ordersPerMonth: number }[] = [];
  let highRiskCount = 0;
  for (const [key, group] of Object.entries(catGroups)) {
    const uniqueProvs = [...new Set(group.map(s => s.providerName))];
    if (uniqueProvs.length === 1) {
      // Find orders for this category from our DB (approximated)
      // For simplicity here, we assume 0 orders if not in DB directly matching
      vendorLockIn.push({
        category: key,
        provider: uniqueProvs[0],
        risk: '🟡 MEDIUM', // Assuming low volume
        ordersPerMonth: 0
      });
      highRiskCount++; // Counting medium as risk too
    }
  }

  // Analysis 7: Arbitrage Opportunities
  // "Для услуг которые мы сейчас покупаем у Provider A: Если Provider B предлагает ту же услугу на > 20% дешевле"
  const arbitrage: { serviceName: string, currentProv: string, currentRate: number, newProv: string, newRate: number, savingsPct: number }[] = [];
  
  for (const dbS of activeDbServices) {
    if (!dbS.provider?.name) continue;
    const currentProvName = dbS.provider.name;
    const originalRate = dbS.rate; // Assuming this is USD or RUB, let's normalize to USD
    // We assume current DB rate is correctly stored.
    // Try to find the service in matchGroups by its name/category
    const catAnalysis = `${dbS.category.name}`; // rough approximation, smart logic used earlier
    // Just search allServices for a match by similar name
    const sNameNorm = dbS.name.toLowerCase().replace(/[^a-zа-яё0-9]/g, '');
    const altServices = allServices.filter(s => 
      s.normalizedName.replace(/[^a-zа-яё0-9]/g, '') === sNameNorm && 
      s.providerName !== currentProvName
    );

    let bestAlt: NormalizedService | null = null;
    for (const alt of altServices) {
      if (!bestAlt || alt.rateUSD < bestAlt.rateUSD) {
        bestAlt = alt;
      }
    }

    if (bestAlt) {
      const dbRateUSD = dbS.providerCurrency === 'RUB' ? originalRate / 83 : originalRate;
      const savingsPct = ((dbRateUSD - bestAlt.rateUSD) / dbRateUSD) * 100;
      if (savingsPct > 20) {
        arbitrage.push({
          serviceName: dbS.name,
          currentProv: currentProvName,
          currentRate: dbRateUSD,
          newProv: bestAlt.providerName,
          newRate: bestAlt.rateUSD,
          savingsPct
        });
      }
    }
  }

  arbitrage.sort((a, b) => b.savingsPct - a.savingsPct);

  // Formatting Report
  const reportLines: string[] = [];
  const dateStr = new Date().toISOString().split('T')[0];
  
  reportLines.push(`# 🕵️ Provider Intelligence Report — Smmplan`);
  reportLines.push(`**Дата:** ${dateStr}`);
  reportLines.push(`**Провайдеров:** ${providers.length}`);
  reportLines.push(`**Услуг проанализировано:** ${allServices.length}\n`);

  reportLines.push(`## Provider Scorecard`);
  reportLines.push(`| # | Провайдер | Rank | Score | Price Pos | Error% | Catalog | Refill% |`);
  reportLines.push(`|---|-----------|------|-------|-----------|--------|---------|---------|`);
  
  const sortedScorecard = Object.entries(scorecard).sort((a, b) => b[1].score - a[1].score);
  sortedScorecard.forEach(([prov, stats], idx) => {
    reportLines.push(`| ${idx + 1} | **${prov}** | ${stats.rank} | ${stats.score.toFixed(1)} | ${stats.avgPos.toFixed(1)} | ${stats.errRate.toFixed(1)}% | ${stats.catalog} | ${stats.refillRate.toFixed(1)}% |`);
  });

  reportLines.push(`\n## Top 20 Arbitrage Opportunities`);
  reportLines.push(`| Услуга | Текущий провайдер | Цена | Альтернатива | Цена | Экономия |`);
  reportLines.push(`|--------|-------------------|------|-------------|------|----------|`);
  
  if (arbitrage.length === 0) {
    reportLines.push(`| Нет данных (услуги из БД не сматчились с кэшем или нет экономии >20%) | - | - | - | - | - |`);
  } else {
    arbitrage.slice(0, 20).forEach(a => {
      reportLines.push(`| ${a.serviceName.substring(0, 40)}... | ${a.currentProv} | $${a.currentRate.toFixed(4)} | **${a.newProv}** | $${a.newRate.toFixed(4)} | **${a.savingsPct.toFixed(0)}%** |`);
    });
  }

  reportLines.push(`\n## Reseller Map`);
  reportLines.push(`| Пара провайдеров | Совпадающих услуг (подозрение на перепродажу) |`);
  reportLines.push(`|------------------|-----------------------------------------------|`);
  const sortedResellers = Object.entries(resellerPairs).sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (sortedResellers.length === 0) reportLines.push(`| Нет пересечений | - |`);
  sortedResellers.forEach(([pair, count]) => {
    reportLines.push(`| ${pair} | ${count} |`);
  });

  reportLines.push(`\n## Vendor Lock-In Risks`);
  reportLines.push(`| Категория | Единственный провайдер | Orders/мес | Risk |`);
  reportLines.push(`|-----------|----------------------|------------|------|`);
  if (vendorLockIn.length === 0) {
    reportLines.push(`| Нет категорий с vendor lock-in | - | - | 🟢 LOW |`);
  } else {
    vendorLockIn.slice(0, 20).forEach(v => {
      reportLines.push(`| ${v.category} | ${v.provider} | ${v.ordersPerMonth} | ${v.risk} |`);
    });
  }
  
  reportLines.push(`\n## 📋 Action Items`);
  let actionIdx = 1;
  if (arbitrage.length > 0) {
    reportLines.push(`${actionIdx++}. Переключить "${arbitrage[0].serviceName}" на ${arbitrage[0].newProv} (экономия ${arbitrage[0].savingsPct.toFixed(0)}%)`);
  }
  if (vendorLockIn.length > 0) {
    reportLines.push(`${actionIdx++}. Добавить backup-провайдера для категории "${vendorLockIn[0].category}" (сейчас монополия ${vendorLockIn[0].provider})`);
  }
  const lowRank = sortedScorecard.filter(s => s[1].rank === 'C' || s[1].rank === 'F');
  if (lowRank.length > 0) {
    reportLines.push(`${actionIdx++}. Снизить объем закупок у провайдера ${lowRank[0][0]} (Rank: ${lowRank[0][1].rank})`);
  }
  if (actionIdx === 1) {
    reportLines.push(`1. Текущая конфигурация оптимальна.`);
  }

  const outDir = path.join(process.cwd(), '.planning', 'analytics', dateStr);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'intel-report.md');
  
  fs.writeFileSync(outPath, reportLines.join('\n'), 'utf-8');
  console.log(`\n✅ Report saved to ${outPath}`);
}

main().catch(console.error).finally(() => process.exit(0));
