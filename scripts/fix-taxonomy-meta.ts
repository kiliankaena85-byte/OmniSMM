import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const META_CATEGORIES = [
  { keywords: ['подписчики', 'subscribers', 'фолловеры'], name: 'Подписчики' },
  { keywords: ['просмотр', 'views', 'глазки'], name: 'Просмотры' },
  { keywords: ['лайки', 'likes', 'классы', 'мне нравится'], name: 'Лайки' },
  { keywords: ['реакц', 'reactions'], name: 'Реакции' },
  { keywords: ['комментари', 'comments', 'отзывы'], name: 'Комментарии' },
  { keywords: ['репост', 'repost', 'поделиться'], name: 'Репосты' },
  { keywords: ['авто', 'auto', 'подписка на'], name: 'Автоактивности' },
  { keywords: ['статистик', 'statistic', 'охват', 'показы', 'сохранения'], name: 'Статистика' },
  { keywords: ['жалоб', 'report', 'страйк'], name: 'Жалобы' },
  { keywords: ['голос', 'опрос', 'poll', 'votes'], name: 'Голосования' },
  { keywords: ['зрител', 'стрим', 'stream', 'live'], name: 'Зрители (Эфир)' },
];

async function main() {
  console.log('🏗️ Smmplan Data Architect: Запуск объединения в МЕТА-категории...');

  const services = await prisma.service.findMany({
    include: { category: { include: { network: true } } }
  });

  console.log(`Найдено ${services.length} услуг. Начинаем распределение...`);

  let updated = 0;
  const metaCategoryMap = new Map<string, string>(); // networkId_metaName -> categoryId

  for (const srv of services) {
    if (!srv.category?.networkId) continue;

    const netId = srv.category.networkId;
    const searchString = (srv.category.name + ' ' + srv.name).toLowerCase();
    
    let matchedMetaName = 'Разное';
    for (const meta of META_CATEGORIES) {
      if (meta.keywords.some(k => searchString.includes(k))) {
        matchedMetaName = meta.name;
        break; // found match!
      }
    }

    const mapKey = `${netId}_${matchedMetaName}`;
    let targetCatId = metaCategoryMap.get(mapKey);

    if (!targetCatId) {
      // Ищем существующую мета-категорию
      let existingCat = await prisma.category.findFirst({
        where: { networkId: netId, name: matchedMetaName }
      });
      if (!existingCat) {
        existingCat = await prisma.category.create({
          data: { name: matchedMetaName, network: { connect: { id: netId } } }
        });
      }
      targetCatId = existingCat.id;
      metaCategoryMap.set(mapKey, targetCatId);
    }

    if (srv.categoryId !== targetCatId) {
       await prisma.service.update({
         where: { id: srv.id },
         data: { categoryId: targetCatId }
       });
       updated++;
    }
  }

  console.log(`✅ Распределено услуг по новым МЕТА-категориям: ${updated}`);

  // Удаляем старые пустые категории
  const emptyCats = await prisma.category.findMany({
    where: { services: { none: {} } }
  });

  let deleted = 0;
  for (const cat of emptyCats) {
    await prisma.category.delete({ where: { id: cat.id }});
    deleted++;
  }
  console.log(`🗑️ Удалено старых (уже пустых) узких категорий: ${deleted}`);
}

main()
  .catch(console.error)
  .finally(async () => await prisma.$disconnect());
