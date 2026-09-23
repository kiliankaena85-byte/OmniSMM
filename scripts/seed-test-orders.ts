import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find a user or create one
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test-admin-view@example.com',
        role: 'ADMIN',
      },
    });
  }

  // Find a generic category & service or create one
  let category = await prisma.category.findFirst();
  if (!category) {
    let network = await prisma.network.findFirst({ where: { slug: 'test-network' } });
    if (!network) {
      network = await prisma.network.create({
        data: { name: 'Test Network', slug: 'test-network' }
      });
    }

    category = await prisma.category.create({
      data: {
        sort: 1,
        name: 'Test Category',
        networkId: network.id
      },
    });
  }

  let service = await prisma.service.findFirst();
  if (!service) {
    service = await prisma.service.create({
      data: {
        categoryId: category.id,
        name: 'YouTube Views 🔥 Real 🔥 [Non-Drop] MAX 500K - Very Long Title For UI Truncation Testing Purpose',
        markup: 3.0,
        rate: 5.50,
        minQty: 10,
        maxQty: 500000,
        isActive: true,
      },
    });
  }

  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL', 'CANCELED', 'AWAITING_PAYMENT', 'ERROR'] as const;
  const errors = [null, null, null, 'Can not reach provider API', 'Invalid link format'];

  for (let i = 0; i < 20; i++) {
    const isDripFeed = Math.random() > 0.8;
    const runs = isDripFeed ? Math.floor(Math.random() * 10) + 2 : null;
    const currentRun = isDripFeed ? Math.floor(Math.random() * runs!) : 0;

    await prisma.order.create({
      data: {
        user: { connect: { id: user.id } },
        service: { connect: { id: service.id } },
        status: statuses[Math.floor(Math.random() * statuses.length)],
        link: Math.random() > 0.5 
          ? `https://instagram.com/p/${Math.random().toString(36).substring(7)}/some_very_very_long_post_hash_to_overflow_the_column_link_width_test_test_test` 
          : 'https://t.me/durov',
        quantity: Math.floor(Math.random() * 10000) + 100,
        charge: Math.floor(Math.random() * 5000) + 100,
        providerCost: Math.floor(Math.random() * 2000) + 50,
        remains: Math.floor(Math.random() * 500),
        isDripFeed,
        runs,
        interval: isDripFeed ? 60 : null,
        currentRun,
        error: errors[Math.floor(Math.random() * errors.length)],
        externalId: Math.random() > 0.5 ? Math.floor(Math.random() * 99999).toString() : null,
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)), // random past date
      },
    });
  }

  console.log('✅ Created 20 test orders for UI layout testing');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
