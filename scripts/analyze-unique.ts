import * as fs from 'fs';
import * as readline from 'readline';

async function analyzeUnique() {
  const filePath = 'C:\\Users\\Артём\\Desktop\\active_services_export.csv';
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  const rows: any[] = [];

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      continue;
    }
    if (!line.trim()) continue;

    const cols: string[] = [];
    let inQuotes = false;
    let currentCol = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(currentCol.trim().replace(/^"|"$/g, ''));
        currentCol = '';
      } else {
        currentCol += char;
      }
    }
    cols.push(currentCol.trim().replace(/^"|"$/g, ''));

    const [id, site_id, name, category, provider_id, provider_name, provider_service_id, price, status, markup_percent, real_markup] = cols;
    rows.push({
      id, site_id, name, category, provider_id, provider_name, provider_service_id, price: parseFloat(price), status, markup_percent, real_markup
    });
  }

  // Check unique provider_service_id + provider_name
  const uniqueByProviderKey = new Map<string, any>();
  for (const r of rows) {
    const key = `${r.provider_name}_${r.provider_service_id}`;
    if (!uniqueByProviderKey.has(key)) {
      uniqueByProviderKey.set(key, r);
    }
  }
  console.log('Unique Services by Provider+ID:', uniqueByProviderKey.size);

  // Check unique by name + category
  const uniqueByNameCat = new Map<string, any>();
  for (const r of rows) {
    const key = `${r.category}_${r.name}`;
    if (!uniqueByNameCat.has(key)) {
      uniqueByNameCat.set(key, r);
    }
  }
  console.log('Unique Services by Category + Name:', uniqueByNameCat.size);

  // Group by category
  const catDistribution: Record<string, number> = {};
  for (const [_, r] of uniqueByProviderKey) {
    catDistribution[r.category] = (catDistribution[r.category] || 0) + 1;
  }
  console.log('Unique Services distribution by Category:', catDistribution);
}

analyzeUnique().catch(console.error);
