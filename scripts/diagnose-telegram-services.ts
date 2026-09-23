import { db } from '../../src/lib/db';

async function diagnoseTelegramServices() {
  console.log('🔍 [DIAGNOSTIC] Inspecting Telegram services and categories in PostgreSQL...\n');

  // 1. Get Telegram Network
  const telegramNetwork = await db.socialNetwork.findFirst({
    where: {
      OR: [
        { slug: 'telegram' },
        { code: 'telegram' },
        { name: { contains: 'Telegram', mode: 'insensitive' } },
      ],
    },
    include: {
      categories: {
        include: {
          services: true,
        },
      },
    },
  });

  if (!telegramNetwork) {
    console.log('❌ Telegram network not found!');
    await db.$disconnect();
    return;
  }

  console.log(`📱 Social Network: ${telegramNetwork.name} (id: ${telegramNetwork.id}, slug: ${telegramNetwork.slug})`);
  console.log(`📁 Total categories: ${telegramNetwork.categories.length}\n`);

  for (const cat of telegramNetwork.categories) {
    console.log(`📂 Category: "${cat.name}" (slug: ${cat.slug}, id: ${cat.id}, tenant: ${cat.tenantId}, isActive: ${cat.isActive})`);
    console.log(`   Services count: ${cat.services.length}`);
    for (const s of cat.services) {
      console.log(`     - [ID: ${s.id}] "${s.name}" | provider: ${s.provider || 'N/A'} (provId: ${s.providerServiceId || 'N/A'}) | Price: ${s.pricePerUnitRub} ₽/ед | Active: ${s.isActive} | Min/Max: ${s.minQty}/${s.maxQty} | Slug: ${s.slug}`);
    }
    console.log('');
  }

  // Also check all services across the entire DB with names like "Продвижение %" or "Тариф %"
  const weirdServices = await db.service.findMany({
    where: {
      OR: [
        { name: { contains: 'Продвижение' } },
        { name: { contains: 'Тариф' } },
        { name: { contains: 'Тест' } },
        { name: { contains: 'Mock' } },
      ],
    },
    include: {
      category: {
        include: {
          network: true,
        },
      },
    },
  });

  console.log(`\n⚠️ Suspicious / Mock services across entire DB: ${weirdServices.length}`);
  for (const ws of weirdServices) {
    console.log(`  - [${ws.category.network.name} > ${ws.category.name}] "${ws.name}" (id: ${ws.id}, provider: ${ws.provider}, active: ${ws.isActive}, price: ${ws.pricePerUnitRub})`);
  }

  await db.$disconnect();
}

diagnoseTelegramServices().catch(console.error);
