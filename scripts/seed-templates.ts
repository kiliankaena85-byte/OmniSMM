import { db as prisma } from '../src/lib/db';

const templates = [
  {
    shortcut: 'hello',
    label: '👋 Приветствие',
    category: 'GENERAL',
    sort: 1,
    text: 'Здравствуйте, {user_name}! Спасибо за обращение в поддержку Smmplan. Чем могу помочь?',
  },
  {
    shortcut: 'link',
    label: '🔗 Запрос ссылки',
    category: 'ORDER',
    sort: 2,
    text: 'Пожалуйста, отправьте прямую ссылку на ваш профиль/пост, чтобы мы могли проверить заказ #{order_id}.',
  },
  {
    shortcut: 'delay',
    label: '⏳ Задержка',
    category: 'ORDER',
    sort: 3,
    text: 'Ваш заказ #{order_id} ({service_name}) находится в работе. На данный момент наблюдается небольшая задержка у провайдера. Пожалуйста, ожидайте — заказ будет выполнен в течение указанного срока.',
  },
  {
    shortcut: 'restart',
    label: '🔄 Перезапуск',
    category: 'ORDER',
    sort: 4,
    text: 'Мы перезапустили ваш заказ #{order_id}. Обновлённый статус: {order_status}. Если проблема сохранится, сообщите нам.',
  },
  {
    shortcut: 'refund',
    label: '💰 Возврат на баланс',
    category: 'PAYMENT',
    sort: 5,
    text: 'Средства по заказу #{order_id} были возвращены на ваш баланс. Вы можете использовать их для нового заказа или запросить вывод.',
  },
  {
    shortcut: 'refund_fpr',
    label: '⚖️ Возврат по ст. 32 ЗОЗПП (ФПР)',
    category: 'PAYMENT',
    sort: 6,
    text: 'Здравствуйте, {user_name}! В соответствии со ст. 32 Закона РФ «О защите прав потребителей» и условиями Оферты, при отказе от услуги вам возвращаются неиспользованные средства за вычетом фактически понесенных расходов (ФПР) на отправку пакетов через API провайдеров. Сумма возврата по заказу #{order_id} рассчитана и зачислена на ваш баланс. Чек возврата прихода сформирован в соответствии с 54-ФЗ.',
  },
  {
    shortcut: 'delete_self',
    label: '🛡️ 152-ФЗ: Самостоятельное удаление аккаунта',
    category: 'LEGAL',
    sort: 7,
    text: 'Здравствуйте, {user_name}! Вы можете самостоятельно удалить свой аккаунт и обезличить персональные данные:\n1. Перейдите в раздел «Настройки профиля» (/dashboard/settings).\n2. Прокрутите страницу вниз до красного блока «Удаление аккаунта».\n3. Введите слово УДАЛИТЬ и ваш текущий пароль для подтверждения.\n4. Нажмите «Удалить аккаунт навсегда».\nВсе ваши персональные данные (email, телефон, сессии) будут мгновенно и безвозвратно уничтожены в соответствии со ст. 21 Федерального закона № 152-ФЗ.',
  },
  {
    shortcut: 'delete_done',
    label: '🛡️ 152-ФЗ: Подтверждение удаления профиля',
    category: 'LEGAL',
    sort: 8,
    text: 'Здравствуйте, {user_name}! Ваш запрос на отзыв согласия на обработку персональных данных и удаление профиля исполнен администрацией сервиса в соответствии со ст. 21 Федерального закона № 152-ФЗ. Все идентификационные данные (email, мессенджеры, телефон, активные сессии) безвозвратно уничтожены и обезличены. Фискальная отчетность и чеки сохранены в обезличенном виде в силу обязательных требований ст. 23 НК РФ и 54-ФЗ. Спасибо за сотрудничество!',
  },
  {
    shortcut: 'meta_warn',
    label: '⚠️ 38-ФЗ: Дисклеймер Meta Platforms Inc.',
    category: 'LEGAL',
    sort: 9,
    text: 'Напоминаем, что деятельность Meta Platforms Inc. (Instagram, Facebook) признана экстремистской и запрещена на территории РФ решением Тверского районного суда г. Москвы от 21.03.2022. Сервис оказывает услуги исключительно в рамках технических протоколов для пользователей из юрисдикций, где использование данных платформ не ограничено.',
  },
  {
    shortcut: 'wait',
    label: '⏰ Ожидание ответа',
    category: 'GENERAL',
    sort: 10,
    text: 'Ожидаем вашего ответа. Если у вас остались вопросы — напишите, мы на связи.',
  },
  {
    shortcut: 'escalate',
    label: '📞 Эскалация',
    category: 'GENERAL',
    sort: 11,
    text: 'Я передал ваш запрос старшему специалисту. Он свяжется с вами в ближайшее время. Номер обращения: {ticket_id}.',
  },
  {
    shortcut: 'close',
    label: '✅ Закрытие',
    category: 'GENERAL',
    sort: 12,
    text: 'Рады, что смогли помочь! Если появятся новые вопросы — обращайтесь, мы всегда на связи. Хорошего дня, {user_name}!',
  },
] as const;

async function main() {
  console.log('🌱 Seeding support templates with 152-FZ, 54-FZ & Consumer Protection macros...\n');

  for (const template of templates) {
    const result = await prisma.supportTemplate.upsert({
      where: { shortcut: template.shortcut },
      update: {
        label: template.label,
        text: template.text,
        category: template.category,
        sort: template.sort,
      },
      create: {
        shortcut: template.shortcut,
        label: template.label,
        text: template.text,
        category: template.category,
        sort: template.sort,
      },
    });

    console.log(`  ✅ [${result.category}] ${result.label} (shortcut: "${result.shortcut}")`);
  }

  console.log(`\n🎉 Done! Total templates seeded: ${templates.length}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
