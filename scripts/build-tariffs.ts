import { db } from '../src/lib/db';

async function main() {
  console.log('=== НАЧАЛО ГЕНЕРАЦИИ ТАРИФОВ (МАКСИМУМ 10 УСЛУГ) ===\n');

  // Описания тарифов
  const descriptions: Record<string, string> = {
    'Эконом': 'Базовое качество для быстрого создания массовки. Возможны частичные списания. Идеально для быстрого старта. Гарантий на восстановление нет.',
    'Стандарт': 'Оптимальное соотношение цены и качества. Аккаунты с заполненными профилями. Плавный старт и минимальные риски списаний.',
    'Премиум': 'Высшее качество на рынке. Полная имитация живых пользователей. 100% безопасность для вашего аккаунта и расширенная гарантия от отписок.'
  };

  // Получаем провайдера Vexboost
  const vexboost = await db.provider.findFirst({ where: { name: { contains: 'Vexboost' } } });
  if (!vexboost) {
    console.error('Провайдер Vexboost не найден!');
    return;
  }

  // Получаем все категории вместе с сетями
  const categories = await db.category.findMany({
    include: { network: true }
  });

  let totalDisabled = 0;
  let totalUpdated = 0;

  for (const category of categories) {
    if (!category.network) continue;

    // Находим все активные услуги vexboost в этой категории
    const services = await db.service.findMany({
      where: {
        categoryId: category.id,
        providerId: vexboost.id,
        isActive: true
      },
      orderBy: { rate: 'asc' } // Сортируем по цене провайдера по возрастанию
    });

    if (services.length === 0) continue;

    console.log(`\n📂 ${category.network.name} -> ${category.name} (Услуг до фильтра: ${services.length})`);

    // Выбираем максимум 10 услуг, равномерно распределенных по цене
    let selectedServices = [];
    const toDisable: string[] = [];

    if (services.length <= 10) {
      selectedServices = [...services];
    } else {
      // Равномерный выбор 10 элементов
      const step = (services.length - 1) / 9; // 9 интервалов для 10 элементов
      const selectedIndices = new Set<number>();
      
      for (let i = 0; i < 10; i++) {
        selectedIndices.add(Math.round(i * step));
      }

      for (let i = 0; i < services.length; i++) {
        if (selectedIndices.has(i)) {
          selectedServices.push(services[i]);
        } else {
          toDisable.push(services[i].id);
        }
      }
    }

    // Распределяем выбранные услуги по 3 тарифам в зависимости от их цены относительно друг друга
    for (let i = 0; i < selectedServices.length; i++) {
      const service = selectedServices[i];
      let tariffName = 'Стандарт';
      
      // Делим на 3 примерно равные группы
      const totalSelected = selectedServices.length;
      if (i < Math.ceil(totalSelected / 3)) {
        tariffName = 'Эконом';
      } else if (i >= Math.floor((totalSelected * 2) / 3)) {
        tariffName = 'Премиум';
      }

      // Сохраняем оригинальное имя, но добавляем префикс тарифа
      const cleanName = service.name.replace(/\[Эконом\]|\[Стандарт\]|\[Премиум\]/gi, '').trim();
      const newName = `[${tariffName}] ${cleanName}`;

      await db.service.update({
        where: { id: service.id },
        data: { 
          name: newName,
          description: descriptions[tariffName]
        }
      });
      console.log(`  ✅ ${newName} (Цена: $${service.rate})`);
      totalUpdated++;
    }

    // Отключаем мусор (всё что не попало в топ-10)
    if (toDisable.length > 0) {
      await db.service.updateMany({
        where: { id: { in: toDisable } },
        data: { isActive: false }
      });
      console.log(`  🗑️ Отключено избыточных услуг: ${toDisable.length} шт.`);
      totalDisabled += toDisable.length;
    }
  }

  console.log(`\n=== ИТОГО ===`);
  console.log(`Оставлено активными (до 10 на категорию): ${totalUpdated} услуг`);
  console.log(`Скрыто (избыток): ${totalDisabled} услуг`);
}

main().catch(console.error);
