import * as fs from 'fs';
import * as path from 'path';

const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'audit_video_services_report.json'), 'utf-8'));
let out = '';

for (const net of ['youtube', 'instagram', 'tiktok', 'likee']) {
  const netServices = report.services.filter((s: any) => s.network === net);
  out += `\n================================================================================\n`;
  out += `NETWORK: ${net.toUpperCase()} (${report.networkSummaries[net].networkName}) - Total: ${netServices.length} services\n`;
  out += `================================================================================\n`;

  for (const s of netServices) {
    out += `--- [ID: ${s.id} | #${s.numericId}] "${s.name}" ---\n`;
    out += `  Category: ${s.category} (${s.categorySlug})\n`;
    out += `  Rate: ${s.rate} ${s.providerCurrency} | Markup: x${s.markup} | Retail: ${s.pricePer1kRub} ₽/1k (${s.pricePerUnitRub} ₽/ед)\n`;
    out += `  Limits: min=${s.minQty}, max=${s.maxQty} | Target: ${s.targetType}\n`;
    out += `  Provider: ${s.providerName} (id: ${s.providerId}, extId: ${s.externalId})\n`;
    out += `  QualityTier: ${s.qualityTier} | Badge: ${s.badge} | Refill: ${s.isRefillEnabled} (${s.warrantyDays}d) | Cancel: ${s.isCancelEnabled}\n`;
    out += `  Description: ${s.description ? s.description.trim() : 'NO DESCRIPTION'}\n`;
    if (s.issues.length > 0) out += `  ❌ ISSUES: ${s.issues.join(' | ')}\n`;
    if (s.warnings.length > 0) out += `  ⚠️ WARNINGS: ${s.warnings.join(' | ')}\n`;
  }
}

fs.writeFileSync(path.join(process.cwd(), 'dump_video_details.txt'), out, 'utf-8');
console.log('Saved dump_video_details.txt successfully');

