import { db } from '../src/lib/db';

async function polishSecondary() {
  console.log('🚀 Polishing secondary networks taxonomy...');

  // Helper
  async function renameCategory(netSlug: string, oldNamePart: string, newName: string) {
    const cat = await db.category.findFirst({
      where: { network: { slug: netSlug }, name: { contains: oldNamePart } }
    });
    if (cat) {
      await db.category.update({
        where: { id: cat.id },
        data: { name: newName, tenantId: 'all' }
      });
      console.log(`  ✓ Polished [${netSlug}]: "${newName}"`);
    }
  }

  // Twitch friend leftover
  const twitchSubs = await db.category.findFirst({
    where: { network: { slug: 'twitch' }, name: { contains: 'Платные подписки' } }
  });
  if (twitchSubs) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'twitch' }, name: { contains: 'друзья' } } },
      data: { categoryId: twitchSubs.id, tenantId: 'all' }
    });
  }

  // Rutube friend leftover
  const rutubeTop = await db.category.findFirst({
    where: { network: { slug: 'rutube' }, name: { contains: 'ТОП' } }
  });
  if (rutubeTop) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'rutube' }, name: { contains: 'друзья' } } },
      data: { categoryId: rutubeTop.id, tenantId: 'all' }
    });
  }

  // SoundCloud plays
  const soundcloudPlays = await db.category.findFirst({
    where: { network: { slug: 'soundcloud' } }
  });
  if (soundcloudPlays) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'soundcloud' }, name: { contains: 'друзья' } } },
      data: { categoryId: soundcloudPlays.id, tenantId: 'all' }
    });
  }

  // Spotify
  await renameCategory('spotify', 'Подписчики', '👥 Подписчики артиста и плейлистов');
  await renameCategory('spotify', 'Premium', '⭐ Премиум-прослушивания и подписчики');
  await renameCategory('spotify', 'Сохранения', '💚 Добавления в медиатеку (Pre-saves)');

  // SoundCloud
  await renameCategory('soundcloud', 'Подписчики', '👥 Фолловеры артиста (Followers)');
  await renameCategory('soundcloud', 'Лайки', '❤️ Лайки на треки');

  // Trovo
  await renameCategory('trovo', 'Подписчики', '💜 Фолловеры стримера (Followers)');
  await renameCategory('trovo', 'Стримы', '🔴 Зрители на прямой эфир (Trovo Live)');

  // Rumble
  await renameCategory('rumble', 'Подписчики', '👥 Подписчики на канал Rumble');
  await renameCategory('rumble', 'Стримы', '🔴 Зрители на трансляцию Rumble Live');

  // Reddit
  await renameCategory('reddit', 'Подписчики', '👥 Подписчики в сабреддит (Subreddit Members)');

  // Pinterest
  await renameCategory('pinterest', 'Подписчики', '👥 Подписчики на доски и профиль (Followers)');

  // Clean empty
  await db.category.deleteMany({
    where: { services: { none: {} } }
  });

  console.log('✅ Secondary networks taxonomy polish completed!');
}

polishSecondary().catch(err => {
  console.error(err);
  process.exit(1);
});
