import * as fs from 'fs';
import * as readline from 'readline';
import { db } from '../src/lib/db';

const NETWORK_MAP: Record<string, { name: string; slug: string; sort: number }> = {
  'Telegram': { name: 'Telegram', slug: 'telegram', sort: 1 },
  'Вконтакте': { name: 'ВКонтакте', slug: 'vk', sort: 2 },
  'Instagram': { name: 'Instagram', slug: 'instagram', sort: 3 },
  'YouTube': { name: 'YouTube', slug: 'youtube', sort: 4 },
  'TikTok': { name: 'TikTok', slug: 'tiktok', sort: 5 },
  'Rutube': { name: 'Rutube', slug: 'rutube', sort: 6 },
  'Яндекс Дзен': { name: 'Дзен', slug: 'dzen', sort: 7 },
  'Likee': { name: 'Likee', slug: 'likee', sort: 8 },
  'Twitch': { name: 'Twitch', slug: 'twitch', sort: 9 },
  'Twitter (x)': { name: 'Twitter (X)', slug: 'twitter', sort: 10 },
  'Facebook': { name: 'Facebook', slug: 'facebook', sort: 11 },
  'Одноклассники': { name: 'Одноклассники', slug: 'ok', sort: 12 },
  'MAX': { name: 'MAX', slug: 'max', sort: 13 }
};

interface CsvRow {
  id: string;
  site_id: string;
  name: string;
  category: string;
  provider_id: string;
  provider_name: string;
  provider_service_id: string;
  price: number;
  status: string;
  markup_percent: string;
  real_markup: string;
}

async function runImport() {
  console.log(`=== LIVE IMPORT OF PRIMELIKE ACTIVE SERVICES ===\n`);

  const filePath = 'C:\\Users\\Артём\\Desktop\\active_services_export.csv';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let isHeader = true;
  const rows: CsvRow[] = [];

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
    if (status === 'Активна') {
      rows.push({
        id, site_id, name, category, provider_id, provider_name, provider_service_id, price: parseFloat(price), status, markup_percent, real_markup
      });
    }
  }

  // Deduplicate by provider_name + provider_service_id
  const uniqueServices = new Map<string, CsvRow>();
  for (const r of rows.filter(r => r.site_id === '1')) {
    const key = `${r.provider_name}_${r.provider_service_id}`;
    uniqueServices.set(key, r);
  }
  for (const r of rows) {
    const key = `${r.provider_name}_${r.provider_service_id}`;
    if (!uniqueServices.has(key)) {
      uniqueServices.set(key, r);
    }
  }

  console.log(`Total active services to import: ${uniqueServices.size}\n`);

  // 1. Load or create Providers
  const existingProviders = await db.provider.findMany();
  const providerMap = new Map<string, string>();
  for (const p of existingProviders) {
    providerMap.set(p.name.toLowerCase(), p.id);
  }

  const uniqueProviderNames = new Set(Array.from(uniqueServices.values()).map(s => s.provider_name));
  for (const pName of uniqueProviderNames) {
    if (!providerMap.has(pName.toLowerCase())) {
      const created = await db.provider.create({
        data: {
          name: pName,
          apiUrl: `https://api.${pName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com/v2`,
          apiKey: 'auto-imported-key',
          balanceCurrency: 'RUB',
          isActive: true
        }
      });
      providerMap.set(pName.toLowerCase(), created.id);
      console.log(`  ➕ Created Provider: ${pName}`);
    }
  }

  // 2. Load or create Networks
  const existingNetworks = await db.network.findMany();
  const networkMap = new Map<string, string>();
  for (const n of existingNetworks) {
    networkMap.set(n.slug.toLowerCase(), n.id);
    networkMap.set(n.name.toLowerCase(), n.id);
  }

  for (const [catName, netConfig] of Object.entries(NETWORK_MAP)) {
    if (!networkMap.has(netConfig.slug.toLowerCase())) {
      const createdNet = await db.network.create({
        data: {
          name: netConfig.name,
          slug: netConfig.slug,
          sort: netConfig.sort,
          isActive: true,
          tenantId: 'all'
        }
      });
      networkMap.set(netConfig.slug.toLowerCase(), createdNet.id);
      networkMap.set(netConfig.name.toLowerCase(), createdNet.id);
      console.log(`  ➕ Created Network: ${netConfig.name} (${netConfig.slug})`);
    }
  }

  // 3. Load or create Categories
  const existingCategories = await db.category.findMany();
  const categoryMap = new Map<string, string>();
  for (const c of existingCategories) {
    if (c.networkId) {
      categoryMap.set(`${c.networkId}_${c.name.toLowerCase()}`, c.id);
    }
  }

  // 4. Import Services
  let importedCount = 0;
  let updatedCount = 0;

  for (const [key, s] of uniqueServices) {
    const netConfig = NETWORK_MAP[s.category] || { name: s.category, slug: s.category.toLowerCase().replace(/[^a-z0-9]/g, ''), sort: 99 };
    const networkId = networkMap.get(netConfig.slug.toLowerCase()) || networkMap.get(netConfig.name.toLowerCase());

    if (!networkId) {
      console.warn(`⚠️ Network not found for category ${s.category}`);
      continue;
    }

    const categoryName = s.category;
    const catKey = `${networkId}_${categoryName.toLowerCase()}`;
    let categoryId = categoryMap.get(catKey);

    if (!categoryId) {
      const createdCat = await db.category.create({
        data: {
          name: categoryName,
          network: { connect: { id: networkId } },
          sort: 1,
          tenantId: 'all'
        }
      });
      categoryId = createdCat.id;
      categoryMap.set(catKey, categoryId);
      console.log(`  ➕ Created Category: ${categoryName} in ${netConfig.name}`);
    }

    const providerId = providerMap.get(s.provider_name.toLowerCase());
    const pricePer1000 = s.price; // RUB per 1000 pcs
    const priceCents = Math.round(pricePer1000 * 100);

    if (categoryId && providerId) {
      // Check if service already exists by providerId and externalId
      const existingSvc = await db.service.findFirst({
        where: {
          providerId,
          externalId: s.provider_service_id
        }
      });

      if (existingSvc) {
        await db.service.update({
          where: { id: existingSvc.id },
          data: {
            name: s.name,
            categoryId,
            rate: pricePer1000,
            pricePer1000Cents: priceCents,
            isActive: true,
            isQuarantined: false,
            tenantId: 'all'
          }
        });
        updatedCount++;
      } else {
        await db.service.create({
          data: {
            name: s.name,
            categoryId,
            providerId,
            externalId: s.provider_service_id,
            rate: pricePer1000,
            pricePer1000Cents: priceCents,
            providerCurrency: 'RUB',
            markup: 1.0,
            minQty: 10,
            maxQty: 500000,
            isActive: true,
            isQuarantined: false,
            tenantId: 'all',
            description: `Услуга из PrimeLike SMM Toolbox (${s.provider_name} #${s.provider_service_id})`
          }
        });
        importedCount++;
      }
    }
  }

  console.log(`\n🎉 IMPORT COMPLETED SUCCESSFULLY!`);
  console.log(`   ➕ New Services Created: ${importedCount}`);
  console.log(`   🔄 Existing Services Updated: ${updatedCount}`);
  console.log(`   📊 Total Active Services in Database: ${importedCount + updatedCount}`);
}

runImport().catch(console.error).finally(() => db.$disconnect());
