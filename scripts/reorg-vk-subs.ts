import { db } from '../src/lib/db';

async function main() {
  console.log('Начинаем реорганизацию услуг VK...');

  // Найдем нужные услуги и обновим их
  const updates = [
    {
      extId: '2327',
      name: 'VK Подписчики [Эконом]',
      desc: 'Базовое качество для быстрого создания массовки. Аккаунты из СНГ, возможны списания ("собачки"). Идеально подходит для старта новых пустых сообществ перед запуском рекламы. Гарантия восстановления: 12 дней.'
    },
    {
      extId: '2090',
      name: 'VK Подписчики [Стандарт]',
      desc: 'Оптимальное соотношение цены и качества. Аудитория СНГ с заполненными профилями (аватарка, посты). Минимальный процент блокировок аккаунтов со стороны ВКонтакте. Плавная скорость добавления для безопасности вашей группы.'
    },
    {
      extId: '1797',
      name: 'VK Подписчики [Премиум]',
      desc: 'Высшее качество на рынке. Максимально "живые" аккаунты реальных пользователей, полностью имитирующие естественное поведение. Никаких ботов и "собачек". Расширенная гарантия восстановления — 90 дней! Безопасно для крупных бизнес-аккаунтов.'
    }
  ];

  const categoryName = '👥 Вступление в группы / чаты';
  
  // 1. Обновляем 3 основные услуги
  for (const item of updates) {
    const s = await db.service.findFirst({
      where: { externalId: item.extId, isActive: true }
    });
    
    if (s) {
      await db.service.update({
        where: { id: s.id },
        data: { name: item.name, description: item.desc }
      });
      console.log(`✅ Обновлена услуга: ${item.name}`);
    } else {
      console.log(`⚠️ Не найдена услуга с externalId: ${item.extId}`);
    }
  }

  // 2. Отключаем остальные услуги в этой категории, если в названии есть VK, и это не наши 3 услуги
  const disabled = await db.service.updateMany({
    where: {
      isActive: true,
      category: { name: categoryName },
      externalId: { notIn: updates.map(u => u.extId) },
      name: { contains: 'VK' } // чтобы не задеть Twitch, если он попал сюда
    },
    data: {
      isActive: false
    }
  });

  console.log(`✅ Отключено лишних услуг VK: ${disabled.count}`);
}

main()
  .then(() => {
    console.log('Готово!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Ошибка:', err);
    process.exit(1);
  });
