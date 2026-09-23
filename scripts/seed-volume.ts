import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CHUNK_SIZE = 5000;
const TARGET_ROWS = 100000; // Let's use 100k to save time locally, but it's enough to cause B-Tree degradation if unindexed

async function seedVolume() {
  console.log(`[SeedVolume] Starting data volume injection. Target: ${TARGET_ROWS} rows.`);

  // 1. Create a dummy provider & category & service to attach orders to
  const provider = await prisma.provider.create({
    data: {
      name: `Volume-Provider-${Date.now()}`,
      apiUrl: 'http://localhost/volume',
      apiKey: 'volume-key',
    }
  });

  const category = await prisma.category.create({
    data: {
      name: `Volume-Category-${Date.now()}`,
    }
  });

  const service = await prisma.service.create({
    data: {
      name: 'Volume Stress Service',
      numericId: 999999,
      providerId: provider.id,
      categoryId: category.id,
      rate: 1.0,
      markup: 2.0,
      minQty: 10,
      maxQty: 1000,
      isActive: true,
    }
  });

  // 2. Create a dummy user
  const user = await prisma.user.create({
    data: {
      email: `volume-victim-${Date.now()}@test.com`,
      balance: 0,
      role: 'USER',
    }
  });

  console.log(`[SeedVolume] Dummy entities created. Starting Order & LedgerEntry injection...`);

  // 3. Inject Orders in chunks
  let totalInserted = 0;
  
  while (totalInserted < TARGET_ROWS) {
    const ordersData = [];
    const ledgerData = [];
    
    for (let i = 0; i < CHUNK_SIZE; i++) {
      const externalId = `ext-${totalInserted + i}-${Date.now()}`;
      
      ordersData.push({
        userId: user.id,
        serviceId: service.id,
        link: 'https://volume.test',
        quantity: 100,
        charge: BigInt(100),
        providerCost: BigInt(50),
        status: 'COMPLETED' as const,
        externalId: externalId,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)), // Randomize past dates
      });
      
      ledgerData.push({
        userId: user.id,
        amount: BigInt(-100),
        reason: `Volume order ${externalId}`,
        createdAt: new Date(),
      });
    }

    // Insert chunks
    await prisma.$transaction([
      prisma.order.createMany({ data: ordersData }),
      prisma.ledgerEntry.createMany({ data: ledgerData })
    ]);

    totalInserted += CHUNK_SIZE;
    console.log(`[SeedVolume] Inserted ${totalInserted} / ${TARGET_ROWS} rows...`);
  }

  console.log(`[SeedVolume] Injection complete. 100,000 Orders and 100,000 LedgerEntries added.`);
  
  // Checking row counts
  const ordersCount = await prisma.order.count();
  const ledgerCount = await prisma.ledgerEntry.count();
  console.log(`[SeedVolume] Total DB Rows: Orders=${ordersCount}, Ledger=${ledgerCount}`);
}

seedVolume()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
