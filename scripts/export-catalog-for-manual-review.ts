import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Exporting catalog for manual review...');
  
  const services = await prisma.service.findMany({
    include: {
      category: {
        include: {
          network: true
        }
      }
    },
    orderBy: [
      { category: { networkId: 'asc' } },
      { categoryId: 'asc' },
      { name: 'asc' }
    ]
  });

  const riskKeywords = ['жалоб', 'report', 'complaint', 'спам', 'фейк', 'накрутк', 'взлом'];

  // CSV Header
  let csvContent = '\uFEFF'; // BOM for Excel UTF-8 support
  csvContent += 'ID;External ID;Status;Network;Category;Service Name;Target Type;Custom Data Type;Price;Legal Risk Flag\n';

  let legalRiskCount = 0;

  for (const s of services) {
    const network = s.category?.network?.name || 'UNKNOWN';
    const category = s.category?.name || 'UNKNOWN';
    const name = s.name.replace(/;/g, ',').replace(/\n/g, ' '); // Clean for CSV
    
    // Check legal risk
    const nameLower = name.toLowerCase();
    const isLegalRisk = riskKeywords.some(kw => nameLower.includes(kw));
    if (isLegalRisk) legalRiskCount++;
    const legalRiskStr = isLegalRisk ? 'YES (Risk)' : 'No';

    const statusStr = s.isActive ? (s.isQuarantined ? 'Quarantined' : 'Active') : 'Inactive';

    csvContent += `${s.id};${s.externalId || ''};${statusStr};${network};${category};"${name}";${s.targetType};${s.customDataType};${s.rate};${legalRiskStr}\n`;
  }

  const exportPath = path.join(process.cwd(), 'catalog-manual-review.csv');
  fs.writeFileSync(exportPath, csvContent, 'utf8');

  console.log(`\nExport complete! Generated file: ${exportPath}`);
  console.log(`Total services exported: ${services.length}`);
  console.log(`Services flagged with Legal Risks: ${legalRiskCount}`);
  console.log(`\nYou can now open 'catalog-manual-review.csv' in Excel or Google Sheets to manually verify everything.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
