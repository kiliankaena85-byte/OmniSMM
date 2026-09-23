import * as fs from 'fs';
import * as readline from 'readline';

async function analyzeCsv() {
  const filePath = 'C:\\Users\\Артём\\Desktop\\active_services_export.csv';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  let count = 0;
  const siteIds = new Set<string>();
  const categories = new Set<string>();
  const providers = new Set<string>();
  const statusCounts: Record<string, number> = {};

  const rows: any[] = [];

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      console.log('Header:', line);
      continue;
    }
    if (!line.trim()) continue;

    // Simple CSV parser supporting quotes
    const regex = /(".*?"|[^",\s]+)(?=\s*,|\s*$)/g;
    // Let's parse properly
    const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
    // Or parse CSV row
    count++;
    
    // Split by comma preserving quotes
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

    // id,site_id,name,category,provider_id,provider_name,provider_service_id,price,status,markup_percent,real_markup
    const [id, site_id, name, category, provider_id, provider_name, provider_service_id, price, status, markup_percent, real_markup] = cols;
    siteIds.add(site_id);
    categories.add(category);
    providers.add(provider_name);
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    rows.push({
      id, site_id, name, category, provider_id, provider_name, provider_service_id, price: parseFloat(price), status, markup_percent, real_markup
    });
  }

  console.log('Total rows in CSV:', count);
  console.log('Unique site_ids:', Array.from(siteIds));
  console.log('Unique categories:', Array.from(categories));
  console.log('Unique providers:', Array.from(providers));
  console.log('Status counts:', statusCounts);

  // Group by site_id
  for (const sId of siteIds) {
    const forSite = rows.filter(r => r.site_id === sId && r.status === 'Активна');
    console.log(`Site ID ${sId}: ${forSite.length} active services`);
  }
}

analyzeCsv().catch(console.error);
