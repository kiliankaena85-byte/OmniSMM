import * as fs from 'fs';
import * as path from 'path';

const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'audit_video_services_report.json'), 'utf-8'));

for (const net of ['youtube', 'instagram', 'tiktok', 'likee']) {
  console.log(`\n======================================================`);
  console.log(`NETWORK: ${net.toUpperCase()} (${report.networkSummaries[net].networkName})`);
  console.log(`Categories: ${report.networkSummaries[net].categoriesCount} | Services: ${report.networkSummaries[net].servicesCount}`);
  console.log(`======================================================`);

  const netServices = report.services.filter((s: any) => s.network === net);
  const byCategory: Record<string, any[]> = {};
  for (const s of netServices) {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  }

  for (const [catName, services] of Object.entries(byCategory)) {
    console.log(`\n--- CATEGORY: ${catName} (${services.length} services) ---`);
    for (const s of services) {
      console.log(`[#${s.numericId}] "${s.name}"`);
      console.log(`  Rate: ${s.rate} ${s.providerCurrency} | Markup: x${s.markup} | Retail: ${s.pricePer1kRub} ₽/1k (${s.pricePerUnitRub.toFixed(4)} ₽/шт)`);
      console.log(`  Limits: [${s.minQty} - ${s.maxQty}] | Target: ${s.targetType} | Quality: ${s.qualityTier} | Badge: ${s.badge || 'None'}`);
      console.log(`  Refill: ${s.isRefillEnabled} (${s.warrantyDays ?? 0}d) | Cancel: ${s.isCancelEnabled} | Drip: ${s.isDripFeedEnabled}`);
      console.log(`  Provider: ${s.providerName} (id: ${s.providerId}, extId: ${s.externalId})`);
      if (s.description) console.log(`  Desc: ${s.description.slice(0, 100)}...`);
      if (s.issues.length > 0) console.log(`  ❌ ISSUES: ${s.issues.join('; ')}`);
      if (s.warnings.length > 0) console.log(`  ⚠️ WARNINGS: ${s.warnings.join('; ')}`);
    }
  }
}
