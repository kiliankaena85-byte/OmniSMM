import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function dump() {
  const services = await prisma.service.findMany({
    include: {
      category: {
        include: { network: true }
      }
    },
    orderBy: [
      { category: { network: { name: 'asc' } } },
      { category: { name: 'asc' } },
      { name: 'asc' }
    ]
  });

  const lines: string[] = [];
  lines.push('ID|NETWORK|CATEGORY|NAME|RATE_USD|MIN|MAX|REFILL|CANCEL|DRIP|EXTERNAL_ID|DESCRIPTION');
  
  for (const s of services) {
    const net = s.category?.network?.name || 'UNKNOWN';
    const cat = s.category?.name || 'UNKNOWN';
    const rate = Number(s.rate).toFixed(4);
    const desc = (s.description || '').replace(/\n/g, ' ').replace(/\|/g, '/').substring(0, 300);
    lines.push(`${s.externalId}|${net}|${cat}|${s.name}|${rate}|${s.minQty}|${s.maxQty}|${s.isRefillEnabled}|${s.isCancelEnabled}|${s.isDripFeedEnabled}|${s.externalId}|${desc}`);
  }

  fs.writeFileSync('scripts/catalog-dump.csv', lines.join('\n'), 'utf-8');
  console.log(`Dumped ${services.length} services to scripts/catalog-dump.csv`);
  
  // Also generate a JSON for deeper analysis
  const jsonData = services.map(s => ({
    id: s.id,
    extId: s.externalId,
    network: s.category?.network?.name || 'UNKNOWN',
    category: s.category?.name || 'UNKNOWN',
    name: s.name,
    rate: Number(s.rate),
    min: s.minQty,
    max: s.maxQty,
    refill: s.isRefillEnabled,
    cancel: s.isCancelEnabled,
    drip: s.isDripFeedEnabled,
    desc: s.description || ''
  }));
  
  fs.writeFileSync('scripts/catalog-dump.json', JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`Dumped JSON to scripts/catalog-dump.json`);
}

dump().finally(() => prisma.$disconnect());
