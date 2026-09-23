import * as fs from 'fs';
import * as path from 'path';

const data = JSON.parse(fs.readFileSync('deep_audit_4_networks.json', 'utf8'));

const items = data.items;

const byNet: Record<string, typeof items> = {};
for (const it of items) {
  if (!byNet[it.networkSlug]) byNet[it.networkSlug] = [];
  byNet[it.networkSlug].push(it);
}

let md = `# Детальный аудит каталога: Twitch, Twitter (X), Facebook, MAX\n\n`;
md += `**Всего проверено услуг:** ${data.totalCount}\n`;
md += `**Аномалий цен (rate > 1000 / экстремальные):** ${data.extremePriceCount}\n`;
md += `**Несоответствий targetType:** ${data.targetTypeIssueCount}\n\n`;

for (const [netSlug, list] of Object.entries(byNet)) {
  const netName = list[0].network;
  md += `## 🌐 Сеть: ${netName} (всего услуг: ${list.length})\n\n`;
  
  // group by category
  const byCat: Record<string, typeof list> = {};
  for (const it of list) {
    if (!byCat[it.category]) byCat[it.category] = [];
    byCat[it.category].push(it);
  }

  for (const [catName, catItems] of Object.entries(byCat)) {
    md += `### 📂 Категория: ${catName} (${catItems.length} услуг)\n\n`;
    md += `| ID | Название | Провайдер (extId) | Rate (БД) | Markup | Цена 1000 шт | Цена 1 шт | TargetType | Min/Max | Проблема / Статус |\n`;
    md += `|---|---|---|---|---|---|---|---|---|---|\n`;
    for (const it of catItems) {
      const pInfo = `${it.providerName} (${it.externalId || '—'})`;
      const issue = it.rateAnalysis.isExtreme 
        ? `🚨 **Аномалия цены**: ${it.pricePer1kRub} ₽/1k` 
        : (it.targetTypeIssue ? `⚠️ **TargetType**: ${it.targetType}` : `✅ Норма`);
      md += `| \`${it.numericId}\` (\`${it.id}\`) | **${it.name}** | ${pInfo} | \`${it.rate}\` ${it.providerCurrency} | \`${it.markup}x\` | **${it.pricePer1kRub} ₽** | **${it.pricePerUnitRub} ₽** | \`${it.targetType}\` | ${it.minQty}..${it.maxQty} | ${issue} |\n`;
    }
    md += `\n`;
  }
}

fs.writeFileSync('AUDIT_REPORT_4_NETWORKS.md', md);
console.log('Report saved to AUDIT_REPORT_4_NETWORKS.md');
