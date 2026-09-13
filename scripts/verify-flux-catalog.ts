// Mock server-only for CLI execution
require.cache[require.resolve('server-only')] = {
  id: require.resolve('server-only'),
  filename: require.resolve('server-only'),
  loaded: true,
  exports: {},
} as any;

import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { db } from '../src/lib/db';
import { tenantVisibilityFilter } from '../src/lib/tenant-scope';

async function main() {
  console.log('🔍 [Verification] Проверка наполнения каталога SMMflux (tenantId: flux)...\n');

  // 1. Service Count
  const fluxServiceCount = await db.service.count({
    where: { tenantId: 'flux' },
  });
  console.log(`✅ Общее количество услуг для SMMflux: ${fluxServiceCount} (Ожидалось: 899)`);
  if (fluxServiceCount !== 899) {
    throw new Error(`Service count mismatch: expected 899, got ${fluxServiceCount}`);
  }

  // 2. Active Services
  const activeCount = await db.service.count({
    where: { tenantId: 'flux', isActive: true },
  });
  console.log(`✅ Активных услуг для SMMflux: ${activeCount}`);

  // 3. Margin Floor Invariant Check (markup >= 3.0x)
  const lowMarginCount = await db.service.count({
    where: {
      tenantId: 'flux',
      markup: { lt: 3.0 },
    },
  });
  console.log(`✅ Услуг с маржой < 3.0x: ${lowMarginCount} (Ожидалось: 0)`);
  if (lowMarginCount > 0) {
    throw new Error(`Margin floor violation! Found ${lowMarginCount} services with markup < 3.0x`);
  }

  // 4. Social Networks with Services for flux
  const networks = await db.network.findMany({
    where: {
      tenantId: tenantVisibilityFilter('flux'),
      categories: {
        some: {
          services: {
            some: {
              tenantId: 'flux',
              isActive: true,
            },
          },
        },
      },
    },
    include: {
      categories: {
        where: {
          services: {
            some: {
              tenantId: 'flux',
              isActive: true,
            },
          },
        },
        include: {
          _count: {
            select: {
              services: {
                where: { tenantId: 'flux', isActive: true },
              },
            },
          },
        },
      },
    },
    orderBy: { sort: 'asc' },
  });

  console.log(`\n🌐 Доступно социальных сетей с услугами на витрине SMMflux: ${networks.length}`);
  for (const net of networks) {
    const totalNetServices = net.categories.reduce((sum, c) => sum + c._count.services, 0);
    console.log(`  📡 ${net.name} (${net.slug}): ${totalNetServices} услуг в ${net.categories.length} категориях`);
    for (const cat of net.categories) {
      console.log(`     └─ 📂 ${cat.name} (${cat.activityType}): ${cat._count.services} услуг`);
    }
  }

  // 5. Sample 3 services inspect
  console.log('\n🔍 Примеры нормализованных услуг на витрине:');
  const samples = await db.service.findMany({
    where: { tenantId: 'flux' },
    take: 3,
    include: { category: { include: { network: true } } },
  });

  for (const s of samples) {
    console.log(`\n[ID: ${s.externalId}] ${s.name}`);
    console.log(`  Категория: ${s.category.network?.name} -> ${s.category.name} (${s.category.activityType})`);
    console.log(`  Цена за 1000 шт: ${(s.pricePer1000Cents / 100).toFixed(2)} ₽ | Закупка: ${s.rate.toFixed(2)} ₽ | Наценка: ${s.markup.toFixed(2)}x`);
    console.log(`  Тип таргета: ${s.targetType} | Тир: ${s.qualityTier} | SortOrder: ${s.sortOrder}`);
    console.log(`  Бейджи: ${JSON.stringify(s.features)}`);
  }

  console.log('\n🎉 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО (100% PASS)!');
  await db.$disconnect();
}

main().catch((err) => {
  console.error('❌ Ошибка верификации:', err);
  process.exit(1);
});
