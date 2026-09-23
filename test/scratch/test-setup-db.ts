import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting DB setup simulation...');
  
  let network = await prisma.network.findUnique({ where: { slug: 'telegram' } });
  if (!network) {
    console.log('Creating Telegram network');
    network = await prisma.network.create({ data: { name: 'Telegram', slug: 'telegram' } });
  }
  console.log('Telegram Network ID:', network.id);

  let instagramNetwork = await prisma.network.findUnique({ where: { slug: 'instagram' } });
  if (!instagramNetwork) {
    console.log('Creating Instagram network');
    instagramNetwork = await prisma.network.create({ data: { name: 'Instagram', slug: 'instagram' } });
  }
  console.log('Instagram Network ID:', instagramNetwork.id);

  console.log('Upserting Category...');
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
  console.log('Category upserted successfully:', cat.id);

  console.log('Checking Category table record directly:');
  const checkCat = await prisma.category.findUnique({
    where: { id: 'e2e-telegram-subs-cat' }
  });
  console.log('checkCat:', checkCat);

  let provider = await prisma.provider.findFirst({ where: { name: 'E2E Test Provider' } });
  if (!provider) {
    provider = await prisma.provider.create({
      data: { name: 'E2E Test Provider', apiUrl: 'http://test.local', apiKey: 'test_key' }
    });
  }
  console.log('Provider ID:', provider.id);

  console.log('Upserting Service...');
  const svc = await prisma.service.upsert({
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
  console.log('Service upserted successfully:', svc.id);
}

main()
  .catch(e => console.error('Failed:', e))
  .finally(() => prisma.$disconnect());
