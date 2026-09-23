import { db } from '../src/lib/db';

async function main() {
  console.log('=== DRY RUN: Слияние категорий ===\n');

  const networks = await db.network.findMany({
    include: { categories: { include: { _count: { select: { services: true } } } } }
  });

  const categoryMapping = [
    { target: '👥 Подписчики', sources: ['Подписчики / Участники', 'Вступление в группы / чаты'] },
    { target: '❤️ Лайки', sources: ['Лайки / Нравится'] },
    { target: '👁 Просмотры', sources: ['Просмотры / Охват', 'Автопросмотры'] },
    { target: '💬 Комментарии', sources: ['Комментарии / Отзывы'] },
    { target: '📢 Репосты', sources: ['Репосты / Поделиться', 'Авторепосты'] },
    { target: '🎭 Реакции', sources: ['Реакции / Эмодзи'] },
  ];

  for (const network of networks) {
    console.log(`\n🌐 Сеть: ${network.name}`);
    let networkHasChanges = false;

    for (const rule of categoryMapping) {
      // Ищем все категории в этой соцсети, которые подпадают под источники
      const matchingCategories = network.categories.filter(c => 
        rule.sources.some(s => c.name.includes(s))
      );

      if (matchingCategories.length > 0) {
        networkHasChanges = true;
        const totalServices = matchingCategories.reduce((sum, c) => sum + c._count.services, 0);
        
        console.log(`  🎯 Будет создана/обновлена категория: [${rule.target}]`);
        console.log(`     Сюда переедут услуги (${totalServices} шт.) из:`);
        
        for (const match of matchingCategories) {
          console.log(`       - "${match.name}" (${match._count.services} услуг) -> будет удалена/переименована`);
        }
      }
    }

    if (!networkHasChanges) {
      console.log(`  (Нет категорий для слияния по правилам)`);
    }
  }

  console.log('\n=== DRY RUN ЗАВЕРШЕН (База данных не изменена) ===');
}

main().catch(console.error);
