import { db } from '../src/lib/db';

async function main() {
  console.log('=== НАЧАЛО МИГРАЦИИ КАТЕГОРИЙ ===\n');

  const networks = await db.network.findMany({
    include: { categories: true }
  });

  for (const network of networks) {
    console.log(`\n🌐 Сеть: ${network.name}`);
    
    // Динамические правила: для Telegram Premium Подписчики не трогаем, для остальных - сливаем.
    const sourcesForSubs = ['Подписчики / Участники', 'Вступление в группы / чаты'];
    if (network.name !== 'TELEGRAM') {
      sourcesForSubs.push('Premium Подписчики');
    }

    const categoryMapping = [
      { target: '👥 Подписчики', sources: sourcesForSubs },
      { target: '❤️ Лайки', sources: ['Лайки / Нравится'] },
      { target: '👁 Просмотры', sources: ['Просмотры / Охват', 'Автопросмотры'] },
      { target: '💬 Комментарии', sources: ['Комментарии / Отзывы'] },
      { target: '📢 Репосты', sources: ['Репосты / Поделиться', 'Авторепосты'] },
      { target: '🎭 Реакции', sources: ['Реакции / Эмодзи'] },
    ];

    for (const rule of categoryMapping) {
      const matchingCategories = network.categories.filter(c => 
        rule.sources.some(s => c.name.includes(s)) && c.name !== rule.target
      );

      if (matchingCategories.length > 0) {
        // Проверяем, есть ли уже целевая категория
        let targetCategory = network.categories.find(c => c.name === rule.target);
        
        if (!targetCategory) {
          // Если целевой категории нет, берем первую из найденных (например "Подписчики / Участники") 
          // и переименовываем её в целевую "👥 Подписчики"
          const baseCategory = matchingCategories[0];
          targetCategory = await db.category.update({
            where: { id: baseCategory.id },
            data: { name: rule.target }
          });
          console.log(`  🔄 Категория "${baseCategory.name}" переименована в "${rule.target}"`);
          // Убираем ее из массива тех, которые нужно удалить
          matchingCategories.shift();
        }

        if (matchingCategories.length > 0) {
          const categoryIdsToDelete = matchingCategories.map(c => c.id);
          
          // Переносим все услуги из удаляемых категорий в целевую
          const updateResult = await db.service.updateMany({
            where: { categoryId: { in: categoryIdsToDelete } },
            data: { categoryId: targetCategory.id }
          });
          console.log(`  ➡️ Перенесено ${updateResult.count} услуг в "${rule.target}"`);

          // Удаляем пустые категории
          await db.category.deleteMany({
            where: { id: { in: categoryIdsToDelete } }
          });
          console.log(`  🗑️ Удалены дублирующие категории: ${matchingCategories.map(c => c.name).join(', ')}`);
        }
      }
    }
  }

  console.log('\n=== МИГРАЦИЯ УСПЕШНО ЗАВЕРШЕНА ===');
}

main().catch(console.error);
