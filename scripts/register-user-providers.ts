import dotenv from 'dotenv';
dotenv.config();

const pgUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_URL || (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgresql://') ? process.env.DATABASE_URL : 'postgresql://postgres:postgres@localhost:5435/smmplan_lite?schema=public');
process.env.DATABASE_URL = pgUrl;
process.env.POSTGRES_PRISMA_URL = pgUrl;
process.env.POSTGRES_URL = pgUrl;

import { db } from '../src/lib/db';
import { encrypt } from '../src/lib/crypto/encryption';

interface ProviderInput {
  name: string;
  slug: string;
  apiUrl: string;
  apiKey: string;
}

const PROVIDERS: ProviderInput[] = [
  {
    name: 'VexBoost',
    slug: 'vexboost',
    apiUrl: 'https://vexboost.ru/api/v2',
    apiKey: process.env.PROVIDER_VEXBOOST_KEY || '',
  },
  {
    name: 'Soc-Rocket',
    slug: 'soc-rocket',
    apiUrl: 'https://soc-rocket.ru/api/v2/',
    apiKey: process.env.PROVIDER_SOCROCKET_KEY || '',
  },
  {
    name: 'SMMPrime',
    slug: 'smmprime',
    apiUrl: 'https://smmprime.com/api/v2',
    apiKey: process.env.PROVIDER_SMMPRIME_KEY || '',
  },
  {
    name: 'Stream-Promotion',
    slug: 'stream-promotion',
    apiUrl: 'https://stream-promotion.ru/api/v2',
    apiKey: process.env.PROVIDER_STREAMPROMOTION_KEY || '',
  },
  {
    name: 'ProSMM-Shop',
    slug: 'prosmm-shop',
    apiUrl: 'https://prosmm-shop.com/api/v2',
    apiKey: process.env.PROVIDER_PROSMMSHOP_KEY || '',
  },
  {
    name: 'SMMPanelUS',
    slug: 'smmpanelus',
    apiUrl: 'https://smmpanelus.com/api/v2',
    apiKey: process.env.PROVIDER_SMMPANELUS_KEY || '',
  },
];

async function testProviderApi(apiUrl: string, apiKey: string) {
  const cleanUrl = apiUrl.replace(/\/+$/, '');
  
  // 1. Try POST form-urlencoded
  try {
    const params = new URLSearchParams({ key: apiKey, action: 'balance' });
    const res = await fetch(cleanUrl, {
      method: 'POST',
      body: params,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, method: 'POST', data };
    }
  } catch (err) {}

  // 2. Try GET with query params
  try {
    const getUrl = `${cleanUrl}?key=${encodeURIComponent(apiKey)}&action=balance`;
    const res = await fetch(getUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, method: 'GET', data };
    }
  } catch (err) {}

  // 3. Try services action
  try {
    const getUrl = `${cleanUrl}?key=${encodeURIComponent(apiKey)}&action=services`;
    const res = await fetch(getUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json();
      return { ok: true, method: 'GET(services)', data: { servicesCount: Array.isArray(data) ? data.length : 'OK' } };
    }
  } catch (err: any) {
    return { ok: false, error: err.message || String(err) };
  }

  return { ok: false, error: 'Could not connect via POST or GET' };
}

async function main() {
  console.log('═════════════════════════════════════════════════════════════════════════════════');
  console.log('  🔌 РЕГИСТРАЦИЯ И ПРОВЕРКА 6 SMM-ПРОВАЙДЕРОВ В СИСТЕМЕ OMNISMM');
  console.log('═════════════════════════════════════════════════════════════════════════════════\n');

  for (const p of PROVIDERS) {
    console.log(`📡 Проверка соединения с [${p.name}] (${p.apiUrl})...`);
    const check = await testProviderApi(p.apiUrl, p.apiKey);
    
    let balanceDisplay = 'N/A';
    let currencyDisplay = 'USD';

    if (check.ok) {
      console.log(`   ✅ API доступен (${check.method}). Ответ:`, check.data);
      if (check.data && check.data.balance !== undefined) {
        balanceDisplay = `${check.data.balance} ${check.data.currency || 'USD'}`;
        currencyDisplay = check.data.currency || 'USD';
      }
    } else {
      console.log(`   ⚠️ Предупреждение при запросе: ${check.error}`);
    }

    const encryptedKey = encrypt(p.apiKey);

    const existing = await db.provider.findFirst({
      where: {
        OR: [
          { name: p.name },
          { apiUrl: p.apiUrl }
        ]
      }
    });

    if (existing) {
      const updated = await db.provider.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          apiUrl: p.apiUrl,
          apiKey: encryptedKey,
          isActive: true,
          balanceCurrency: currencyDisplay,
          lastSuccessAt: check.ok ? new Date() : undefined,
          metadata: { 
            slug: p.slug, 
            balance: balanceDisplay,
            lastVerifiedAt: new Date().toISOString() 
          },
        }
      });
      console.log(`   🔄 Провайдер [${p.name}] обновлён в БД (ID: ${updated.id})\n`);
    } else {
      const created = await db.provider.create({
        data: {
          name: p.name,
          apiUrl: p.apiUrl,
          apiKey: encryptedKey,
          isActive: true,
          balanceCurrency: currencyDisplay,
          lastSuccessAt: check.ok ? new Date() : undefined,
          metadata: { 
            slug: p.slug, 
            balance: balanceDisplay,
            registeredAt: new Date().toISOString() 
          },
        }
      });
      console.log(`   ✨ Провайдер [${p.name}] успешно зарегистрирован в БД (ID: ${created.id})\n`);
    }
  }

  const all = await db.provider.findMany({ orderBy: { createdAt: 'asc' } });
  console.log('═════════════════════════════════════════════════════════════════════════════════');
  console.log(`📋 ИТОГОВЫЙ СПИСОК ВСЕХ ЗАРЕГИСТРИРОВАННЫХ ПРОВАЙДЕРОВ В БД (${all.length} шт.):`);
  console.log('═════════════════════════════════════════════════════════════════════════════════');
  console.table(all.map(x => ({
    ID: x.id,
    Name: x.name,
    API_URL: x.apiUrl,
    Active: x.isActive,
    Balance: (x.metadata as any)?.balance || 'N/A',
  })));
}

main()
  .catch(err => {
    console.error('Fatal error during provider registration:', err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    process.exit(0);
  });
