import { db } from '../src/lib/db';

async function main() {
  console.log('=== ЗАПУСК ФИНАЛЬНОГО ПАТЧА КАТАЛОГА ===\n');

  let fixedTargetTypes = 0;
  let disabledGarbage = 0;
  let disabledDuplicates = 0;

  // 1. Отключаем услуги с бракованными лимитами (например, min=1, max=1)
  const garbageServices = await db.service.findMany({
    where: { isActive: true }
  });

  for (const s of garbageServices) {
    if (s.minQty === s.maxQty && s.maxQty < 10) {
      await db.service.update({
        where: { id: s.id },
        data: { isActive: false }
      });
      disabledGarbage++;
      console.log(`  🗑️ Отключен брак: [ID: ${s.id}] ${s.name} (Лимиты: ${s.minQty}-${s.maxQty})`);
    }
  }

  // 2. Отключаем абсолютные дубликаты по имени (оставляем только один)
  const activeServices = await db.service.findMany({
    where: { isActive: true },
    orderBy: { rate: 'asc' } // если дубли, оставим самый дешевый
  });

  const seenNames = new Set<string>();
  for (const s of activeServices) {
    if (seenNames.has(s.name)) {
      await db.service.update({
        where: { id: s.id },
        data: { isActive: false }
      });
      disabledDuplicates++;
      console.log(`  👯 Отключен дубликат: ${s.name}`);
    } else {
      seenNames.add(s.name);
    }
  }

  // 3. Исправляем TargetType
  const servicesToFix = await db.service.findMany({
    where: { isActive: true },
    include: { category: true }
  });

  for (const s of servicesToFix) {
    let expectedType = s.targetType;
    const catName = s.category.name.toLowerCase();
    const srvName = s.name.toLowerCase();

    if (srvName.includes('story') || srvName.includes('истори') || srvName.includes('стори')) {
      expectedType = 'STORY';
    } else if (catName.includes('подписчики') || catName.includes('участники') || catName.includes('друзья')) {
      expectedType = 'CHANNEL';
    } else if (srvName.includes('звезд') || srvName.includes('подарок')) {
      expectedType = 'CUSTOM';
    } else if (
      catName.includes('лайки') || 
      catName.includes('просмотры') || 
      catName.includes('комментарии') || 
      catName.includes('реакции') || 
      catName.includes('репосты')
    ) {
      expectedType = 'POST';
    }

    if (s.targetType !== expectedType) {
      await db.service.update({
        where: { id: s.id },
        data: { targetType: expectedType }
      });
      fixedTargetTypes++;
      console.log(`  🎯 TargetType исправлен: ${s.name} (${s.targetType} -> ${expectedType})`);
    }
  }

  console.log(`\n=== ИТОГИ ПАТЧА ===`);
  console.log(`Отключен мусор (лимиты): ${disabledGarbage} шт.`);
  console.log(`Отключены дубликаты (по имени): ${disabledDuplicates} шт.`);
  console.log(`Исправлены TargetType: ${fixedTargetTypes} шт.`);
}

main().catch(console.error);
