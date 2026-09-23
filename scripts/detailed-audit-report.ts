import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('./scripts/audit-ru-services-result.json', 'utf8'));

let out = '';
out += '========================================================================\n';
out += '                  FULL CATALOG AUDIT BREAKDOWN                          \n';
out += '========================================================================\n\n';

out += '--- SUMMARY STATS ---\n';
out += JSON.stringify(data.summary, null, 2) + '\n\n';

out += '--- ALL ISSUES (' + data.issues.length + ') ---\n';
for (const iss of data.issues) {
  out += `[${iss.severity}] [${iss.socialNetwork.toUpperCase()}] [${iss.category}]\n`;
  out += `  Service: "${iss.serviceName}" (ID: ${iss.serviceId}, # ${iss.numericId})\n`;
  out += `  Issue: ${iss.issueType} -> ${iss.description}\n`;
  out += `  Current Values: ${JSON.stringify(iss.currentValues)}\n`;
  out += `  Recommendation: ${iss.recommendation}\n`;
  out += '------------------------------------------------------------------------\n';
}

out += '\n--- SERVICE BY SERVICE VERIFICATION ---\n';
const networks = ['telegram', 'vk', 'rutube', 'dzen', 'ok'];

for (const net of networks) {
  out += `\n========================================================================\n`;
  out += `                        NETWORK: ${net.toUpperCase()}\n`;
  out += `========================================================================\n`;

  const services = data.servicesList.filter((s: any) => s.network === net);
  const categories = Array.from(new Set(services.map((s: any) => s.category)));

  for (const cat of categories) {
    const catServices = services.filter((s: any) => s.category === cat);
    out += `\n📂 CATEGORY: ${cat} (Services count: ${catServices.length})\n`;
    
    for (const s of catServices) {
      out += `  ▶ [ID: ${s.id}] [NumericID: ${s.numericId}] "${s.name}"\n`;
      out += `    - Status: ${s.isActive ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n`;
      out += `    - Target Type: ${s.targetType}\n`;
      out += `    - Rate: ${s.rate} ${s.providerCurrency} | Markup: x${s.markup}\n`;
      out += `    - Price: ${s.pricePer1kRub} ₽ / 1000 шт (${s.pricePerUnitRub} ₽ / шт)\n`;
      out += `    - Limits: min ${s.minQty} .. max ${s.maxQty}\n`;
      out += `    - Provider: ${s.providerName || 'NO PROVIDER'} (Ext ID: ${s.externalId || 'NONE'})\n`;
      out += `    - DripFeed: ${s.isDripFeedEnabled ? '✅' : '❌'} | Refill: ${s.isRefillEnabled ? '✅' : '❌'}\n`;
      out += `    - Features: ${JSON.stringify(s.features)}\n`;
    }
  }
}

fs.writeFileSync('./scripts/audit-utf8-report.txt', out, 'utf-8');
console.log('Written to ./scripts/audit-utf8-report.txt');
