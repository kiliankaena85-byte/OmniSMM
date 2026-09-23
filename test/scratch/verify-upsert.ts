import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const cleanupDb = async () => {
  const testUserEmails = ['e2e-magic-tester@test.com', 'e2e-sufficient@test.com', 'e2e-insufficient@test.com'];
  const testServiceIds = ['e2e-sub-service', 'e2e-like-service', 'e2e-story-service', 'e2e-custom-service'];
  const testCategoryIds = ['e2e-telegram-subs-cat', 'e2e-telegram-likes-cat', 'e2e-instagram-stories-cat', 'e2e-telegram-custom-cat'];

  try {
    const users = await prisma.user.findMany({
      where: { email: { in: testUserEmails } }
    });
    const userIds = users.map(u => u.id);

    try {
      await prisma.invoice.deleteMany({
        where: { userId: { in: userIds } }
      });
    } catch (e) {
      console.warn('Invoice cleanup skipped:', (e as Error).message);
    }

    try {
      await prisma.order.deleteMany({
        where: {
          OR: [
            { userId: { in: userIds } },
            { email: { in: testUserEmails } },
            { serviceId: { in: testServiceIds } }
          ]
        }
      });
    } catch (e) {
      console.warn('Order cleanup skipped:', (e as Error).message);
    }

    try {
      await prisma.payment.deleteMany({
        where: { userId: { in: userIds } }
      });
    } catch (e) {
      console.warn('Payment cleanup skipped:', (e as Error).message);
    }

    try {
      await prisma.authToken.deleteMany({
        where: { userId: { in: userIds } }
      });
    } catch (e) {
      console.warn('AuthToken cleanup skipped:', (e as Error).message);
    }

    try {
      await prisma.session.deleteMany({
        where: { userId: { in: userIds } }
      });
    } catch (e) {
      console.warn('Session cleanup skipped:', (e as Error).message);
    }

    try {
      await prisma.service.deleteMany({
        where: { id: { in: testServiceIds } }
      });
    } catch (e) {
      console.warn('Service cleanup skipped:', (e as Error).message);
    }

    try {
      await prisma.category.deleteMany({
        where: { id: { in: testCategoryIds } }
      });
    } catch (e) {
      console.warn('Category cleanup skipped:', (e as Error).message);
    }

    try {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } }
      });
    } catch (e) {
      console.warn('User cleanup skipped (possibly referenced by immutable ledger):', (e as Error).message);
    }
  } catch (e) {
    console.error('Error during cleanup:', e);
  }
};

async function main() {
  console.log('--- Running cleanupDb first ---');
  await cleanupDb();

  console.log('--- Verify Category & Service Upsert ---');
  // 1. Ensure networks exist
  let network = await prisma.network.findUnique({ where: { slug: 'telegram' } });
  if (!network) {
    network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
  }
  console.log('Network:', network);

  // 2. Create Categories
  const cat = await prisma.category.upsert({
    where: { id: 'e2e-telegram-subs-cat' },
    update: {
      name: 'E2E Telegram Subscribers',
      sort: 10,
      networkId: network.id
    },
    create: {
      id: 'e2e-telegram-subs-cat',
      name: 'E2E Telegram Subscribers',
      sort: 10,
      networkId: network.id
    }
  });
  console.log('Category created:', cat);

  // Check if it can be found immediately
  const foundCat = await prisma.category.findUnique({ where: { id: 'e2e-telegram-subs-cat' } });
  console.log('Found Category:', foundCat);

  // 3. Ensure Provider exists
  let provider = await prisma.provider.findFirst({ where: { name: 'E2E Test Provider' } });
  if (!provider) {
    provider = await prisma.provider.create({
      data: { name: 'E2E Test Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
    });
  }
  console.log('Provider:', provider);

  // 4. Create Service referencing category
  const service = await prisma.service.upsert({
    where: { id: 'e2e-sub-service' },
    update: {
      name: 'E2E Subscribers Service',
      categoryId: 'e2e-telegram-subs-cat',
      providerId: provider.id,
      rate: 1.0,
      markup: 2.5,
      minQty: 10,
      maxQty: 10000,
      isQuarantined: false,
      isActive: true,
      externalId: 'e2e-sub-101',
      targetType: 'CHANNEL'
    },
    create: {
      id: 'e2e-sub-service',
      name: 'E2E Subscribers Service',
      categoryId: 'e2e-telegram-subs-cat',
      providerId: provider.id,
      rate: 1.0,
      markup: 2.5,
      minQty: 10,
      maxQty: 10000,
      isQuarantined: false,
      isActive: true,
      externalId: 'e2e-sub-101',
      targetType: 'CHANNEL'
    }
  });
  console.log('Service created successfully!');
}

main()
  .catch((err) => {
    console.error('Error occurred:', err);
  })
  .finally(() => prisma.$disconnect());
