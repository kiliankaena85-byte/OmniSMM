import { db } from '../src/lib/db';
import * as fs from 'fs';
import * as path from 'path';
import { inferTargetTypeFromCategory } from '../src/utils/target-type';

async function main() {
  console.log('🔍 Starting Multi-Pass Catalog Audit...');

  const services = await db.service.findMany({
    include: {
      category: { include: { network: true } },
      provider: true,
      orders: { select: { id: true, status: true } },
    }
  });

  const networks = await db.network.findMany();
  const categories = await db.category.findMany();

  // Scoreboard
  let duplicates = 0;
  let garbage = 0;
  let classificationErrors = 0;
  let dead = 0;
  let languageIssues = 0;
  let legalRisks = 0;

  const logs: string[] = [];
  const addLog = (pass: string, msg: string) => logs.push(`- **[${pass}]** ${msg}`);

  // PASS 1: Duplicates (Same network, same normalized name)
  console.log('Running Pass 1: Duplicates');
  const seenNames = new Map<string, string[]>();
  for (const s of services) {
    const norm = s.name.toLowerCase().replace(/[^a-zа-я0-9]/g, '');
    const key = `${s.category.networkId}_${norm}`;
    if (!seenNames.has(key)) seenNames.set(key, []);
    seenNames.get(key)!.push(s.id);
  }
  for (const [key, ids] of seenNames.entries()) {
    if (ids.length > 1) {
      duplicates++;
      const dupes = services.filter(s => ids.includes(s.id));
      addLog('Duplicates', `Found ${ids.length} identical services: ${dupes[0].name} (Network: ${dupes[0].category.network?.name})`);
    }
  }

  // PASS 2: Garbage (Insane prices, useless ranges)
  console.log('Running Pass 2: Garbage');
  for (const s of services) {
    if (s.rate > 50000) {
      garbage++;
      addLog('Garbage', `[${s.numericId}] Insane price: $${s.rate}`);
    }
    if (s.minQty === s.maxQty && s.maxQty < 10) {
      garbage++;
      addLog('Garbage', `[${s.numericId}] Useless range: ${s.minQty}-${s.maxQty}`);
    }
  }

  // PASS 3: Classification Errors
  console.log('Running Pass 3: Classification');
  for (const s of services) {
    const nameL = s.name.toLowerCase();
    const catL = s.category.name.toLowerCase();
    
    // Check obvious mismatches
    if (nameL.includes('подписчик') && !catL.includes('подписчик')) {
      classificationErrors++;
      addLog('Classification', `[${s.numericId}] "${s.name}" is a Follower service but in category "${s.category.name}"`);
    }
    if ((nameL.includes('vk') || nameL.includes('вк')) && s.category.network?.name.toLowerCase() !== 'vkontakte') {
      classificationErrors++;
      addLog('Classification', `[${s.numericId}] "${s.name}" is a VK service but in network "${s.category.network?.name}"`);
    }

    const expectedTarget = inferTargetTypeFromCategory(s.category.name);
    if (s.targetType !== expectedTarget && !['CUSTOM', 'POLL'].includes(s.targetType)) {
      classificationErrors++;
      addLog('TargetType', `[${s.numericId}] "${s.name}" has targetType=${s.targetType}, expected ${expectedTarget}`);
    }
  }

  // PASS 4: Dead Services
  console.log('Running Pass 4: Dead Services');
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  for (const s of services) {
    if (s.isActive && s.lastSeenAt && s.lastSeenAt < sevenDaysAgo) {
      dead++;
      addLog('Dead', `[${s.numericId}] Active but last seen ${(Date.now() - s.lastSeenAt.getTime())/86400000 | 0} days ago`);
    }
  }

  // PASS 5: Language Audit
  console.log('Running Pass 5: Language');
  for (const s of services) {
    if (!/[а-яА-Я]/.test(s.name) && s.name.length > 10) {
      languageIssues++;
      addLog('Language', `[${s.numericId}] Not localized: "${s.name}"`);
    }
  }

  // PASS 10: Legal Risks
  console.log('Running Pass 10: Legal Risks');
  const legalKeywords = ['жалоб', 'report', 'complaint', 'спам', 'spam', 'фрод', 'накрутк', 'ban'];
  for (const s of services) {
    const nameL = s.name.toLowerCase();
    if (legalKeywords.some(k => nameL.includes(k))) {
      legalRisks++;
      addLog('Legal', `[${s.numericId}] Contains legal risk keyword: "${s.name}"`);
    }
  }

  // Generate Report
  const totalIssues = duplicates + garbage + classificationErrors + dead + languageIssues + legalRisks;
  const score = Math.max(0, 100 - (totalIssues / services.length) * 100);

  const report = `
# 🏷️ Catalog Health Report
**Date:** ${new Date().toISOString()}
**Services Analyzed:** ${services.length}

## Scoreboard
| Pass | Issues Found |
|--------|-----------------|
| Duplicates | ${duplicates} |
| Garbage | ${garbage} |
| Classification | ${classificationErrors} |
| Dead/Zombie | ${dead} |
| Language | ${languageIssues} |
| Legal Risks | ${legalRisks} |

## Catalog Health Score
Score: **${score.toFixed(1)} / 100**
Rating: ${score > 90 ? 'A' : score > 75 ? 'B' : score > 60 ? 'C' : 'D'}

## Detailed Findings (Sample)
${logs.slice(0, 100).join('\n')}
${logs.length > 100 ? `\n...and ${logs.length - 100} more.` : ''}
  `;

  const dateStr = new Date().toISOString().split('T')[0];
  const dir = path.join(process.cwd(), '.planning', 'analytics', dateStr);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'catalog-report.md'), report.trim());

  console.log(`\n✅ Report generated: .planning/analytics/${dateStr}/catalog-report.md`);
  console.log(`Health Score: ${score.toFixed(1)}/100`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
