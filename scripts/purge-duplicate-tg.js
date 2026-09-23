const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function purgeDuplicateTelegramCategories() {
  const telegram = await prisma.network.findFirst({
    where: { slug: 'telegram' },
  });

  if (!telegram) return;

  const oldCategorySlugs = [
    'telegram-boosts',
    'telegram-premium',
    'telegram-bots',
    'telegram-subscribers',
    'telegram-other'
  ];

  for (const oldSlug of oldCategorySlugs) {
    const oldCat = await prisma.category.findFirst({
      where: { networkId: telegram.id, slug: oldSlug },
      include: { services: true }
    });

    if (oldCat) {
      console.log(`Processing old category: "${oldCat.name}" (slug: ${oldCat.slug}) with ${oldCat.services.length} services`);
      for (const s of oldCat.services) {
        try {
          await prisma.service.delete({ where: { id: s.id } });
        } catch {
          await prisma.service.update({
            where: { id: s.id },
            data: { isActive: false, isQuarantined: true, name: `[DEPRECATED] ${s.name}` }
          });
        }
      }

      try {
        await prisma.category.delete({ where: { id: oldCat.id } });
        console.log(`✅ Deleted category: ${oldCat.slug}`);
      } catch (err) {
        console.warn(`Could not delete category ${oldCat.slug}:`, err.message);
      }
    }
  }

  // Also clean up any lingering "Просмотры - Стандарт", "Просмотры - С гарантией 60 дней" with fake provider karandash/smm_panelus
  const fakeServices = await prisma.service.findMany({
    where: {
      category: { networkId: telegram.id },
      provider: {
        name: { not: 'Основной Поставщик (API 1)' }
      }
    }
  });

  console.log(`Cleaning up ${fakeServices.length} legacy services from non-active providers...`);
  for (const s of fakeServices) {
    try {
      await prisma.service.delete({ where: { id: s.id } });
    } catch {
      await prisma.service.update({
        where: { id: s.id },
        data: { isActive: false, isQuarantined: true }
      });
    }
  }

  console.log('✨ All duplicate categories and fake services purged!');
  await prisma.$disconnect();
}

purgeDuplicateTelegramCategories().catch(console.error);
