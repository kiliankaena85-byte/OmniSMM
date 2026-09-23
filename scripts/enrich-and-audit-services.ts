import { db } from '../src/lib/db';

async function main() {
  console.log('=== КОМПЛЕКСНАЯ НАСТРОЙКА И АУДИТ ТИПОВ ССЫЛОК И УСЛУГ ===\n');

  const services = await db.service.findMany({
    include: {
      category: {
        include: {
          network: true
        }
      }
    }
  });

  console.log(`Всего услуг в базе: ${services.length}`);

  let updatedTargetTypes = 0;
  let updatedWarnings = 0;
  let updatedMediaGroup = 0;
  let updatedCustomData = 0;

  for (const s of services) {
    const sName = s.name.toLowerCase();
    const catName = (s.category?.name || '').toLowerCase();
    const netSlug = (s.category?.network?.slug || '').toLowerCase();

    let targetType = 'POST';
    let isMediaGroupAware = false;
    let requireWarning = false;
    let warningMessage: string | null = null;
    let clientRequirement: string | null = null;
    let customDataType = 'NONE';
    let customDataLabel: string | null = null;

    // 1. Определение targetType
    // 1.1. Подписчики, участники, друзья, группы, бусты
    if (
      catName.includes('подписчик') ||
      catName.includes('участник') ||
      catName.includes('буст') ||
      catName.includes('boost') ||
      catName.includes('групп') ||
      catName.includes('друзь') ||
      catName.includes('фолловер') ||
      catName.includes('follower') ||
      catName.includes('subscriber') ||
      catName.includes('трафик') ||
      catName.includes('посещен') ||
      sName.includes('подписчик') ||
      sName.includes('участник') ||
      sName.includes('на канал') ||
      sName.includes('в группу') ||
      sName.includes('в паблик') ||
      sName.includes('профиль')
    ) {
      targetType = 'CHANNEL';
    }

    // 1.2. Автопросмотры и авто-активность (КРИТИЧНО: ссылка на канал, а не на пост!)
    if (
      sName.includes('автопросмотр') ||
      sName.includes('авто просмотр') ||
      sName.includes('авто-просмотр') ||
      sName.includes('auto view') ||
      sName.includes('на будущие') ||
      sName.includes('на 10 пост') ||
      sName.includes('на 20 пост') ||
      sName.includes('на 50 пост') ||
      sName.includes('на 100 пост') ||
      catName.includes('автопросмотр')
    ) {
      targetType = 'CHANNEL'; // Требуется ссылка на канал!
    }

    // 1.3. Сториз / Истории
    if (catName.includes('сториз') || catName.includes('истори') || catName.includes('story') || catName.includes('stories')) {
      targetType = 'STORY';
    }

    // 1.4. Боты / Рефералы в боты
    if (catName.includes('бот') || catName.includes('реферал') || sName.includes('реферал') || sName.includes('/start=')) {
      targetType = 'BOT';
    }

    // 1.5. Опросы / Голосования
    if (catName.includes('опрос') || catName.includes('голос') || sName.includes('опрос') || sName.includes('голосован') || sName.includes('poll') || sName.includes('vote')) {
      targetType = 'POLL';
      customDataType = 'POLL_OPTION';
      customDataLabel = 'Номер варианта ответа (например, 1 или 2)';
    }

    // 1.6. Комментарии и отзывы
    if (catName.includes('комментар') || catName.includes('отзыв') || sName.includes('комментар') || sName.includes('отзыв') || sName.includes('custom comment')) {
      customDataType = 'COMMENTS';
      customDataLabel = 'Текст комментариев (каждый с новой строки)';
    }

    // 2. Telegram Media Group / Альбомы (несколько фото/видео в одном посте)
    if (netSlug === 'telegram' && (catName.includes('просмотр') || catName.includes('реакци') || catName.includes('репост') || catName.includes('лайк') || sName.includes('пост'))) {
      isMediaGroupAware = true;
    }

    // 3. Закрытые каналы / Инвайты / Специфические требования
    if (
      sName.includes('закрыт') ||
      sName.includes('приватн') ||
      sName.includes('private') ||
      sName.includes('инвайт') ||
      sName.includes('invite') ||
      catName.includes('закрыт') ||
      catName.includes('приватн')
    ) {
      requireWarning = true;
      warningMessage = 'Внимание: для закрытого канала обязательно добавьте нашего бота-инвайтора в администраторы канала с правом добавления участников!';
      clientRequirement = 'invite_bot_admin';
    }

    // Предупреждение для 18+ и NSFW
    if (sName.includes('18+') || sName.includes('nsfw') || sName.includes('эротик') || sName.includes('adult')) {
      requireWarning = true;
      warningMessage = 'Услуга предназначена строго для каналов/страниц с контентом 18+. Запрещены экстремизм и нелегальный контент.';
    }

    // Проверяем, изменились ли данные
    const needsUpdate =
      s.targetType !== targetType ||
      s.isMediaGroupAware !== isMediaGroupAware ||
      s.requireWarning !== requireWarning ||
      s.warningMessage !== warningMessage ||
      s.customDataType !== customDataType ||
      s.customDataLabel !== customDataLabel;

    if (needsUpdate) {
      await db.service.update({
        where: { id: s.id },
        data: {
          targetType,
          isMediaGroupAware,
          requireWarning,
          warningMessage,
          clientRequirement,
          customDataType,
          customDataLabel,
        }
      });

      if (s.targetType !== targetType) updatedTargetTypes++;
      if (s.requireWarning !== requireWarning) updatedWarnings++;
      if (s.isMediaGroupAware !== isMediaGroupAware) updatedMediaGroup++;
      if (s.customDataType !== customDataType) updatedCustomData++;
    }
  }

  console.log('✅ Обработка завершена:');
  console.log(`  - Обновлено targetType: ${updatedTargetTypes}`);
  console.log(`  - Добавлено предупреждений и требований (закрытые каналы): ${updatedWarnings}`);
  console.log(`  - Включена поддержка Telegram MediaGroup (альбомы): ${updatedMediaGroup}`);
  console.log(`  - Настроено кастомных данных (опросы, комментарии): ${updatedCustomData}`);

  // Статистика распределения
  const stats = await db.service.groupBy({
    by: ['targetType'],
    _count: { id: true }
  });
  console.log('\n📊 Распределение услуг по типам ссылок (targetType):');
  for (const st of stats) {
    console.log(`  - ${st.targetType}: ${st._count.id} услуг`);
  }
}

main().finally(() => db.$disconnect());
