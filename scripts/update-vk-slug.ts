import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateVkSlug() {
  console.log('--- Обновление слага ВКонтакте на "vk" ---');

  const updated = await prisma.network.updateMany({
    where: {
      OR: [
        { slug: 'vkontakte' },
        { name: 'VKontakte' },
        { name: 'VK' }
      ]
    },
    data: {
      name: 'ВКонтакте (VK)',
      slug: 'vk',
    }
  });

  console.log(`Обновлено сетей в БД: ${updated.count}`);

  const vkNetwork = await prisma.network.findFirst({
    where: { slug: 'vk' },
    include: { categories: true }
  });

  if (vkNetwork) {
    console.log(`✅ Сеть: "${vkNetwork.name}", slug: "${vkNetwork.slug}", Категорий: ${vkNetwork.categories.length}`);
  }
}

updateVkSlug().catch(console.error).finally(() => prisma.$disconnect());
