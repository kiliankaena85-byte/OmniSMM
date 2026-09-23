import { db } from '../src/lib/db';

async function main() {
  console.log('🚀 Running Deep Native Platform Taxonomy Refinement...');

  async function getOrCreateCategory(networkSlug: string, categoryName: string, activityType = 'FOLLOWERS') {
    const network = await db.network.findFirst({
      where: { slug: { equals: networkSlug, mode: 'insensitive' } }
    });
    if (!network) return null;

    let category = await db.category.findFirst({
      where: { networkId: network.id, name: categoryName }
    });

    if (!category) {
      const slug = `${networkSlug}-${categoryName.toLowerCase().replace(/[^a-zа-я0-9]+/gi, '-').replace(/^-|-$/g, '')}-${Date.now()}`;
      category = await db.category.create({
        data: {
          name: categoryName,
          slug,
          networkId: network.id,
          tenantId: 'all',
          activityType: activityType as any
        }
      });
      console.log(`  + Created: [${network.name}] -> "${categoryName}"`);
    }

    return category;
  }

  // 1. Instagram: Показы и Охваты
  const igReachCat = await getOrCreateCategory('instagram', '👁️ Показы и Охваты (Reach & Impressions)', 'VIEWS');
  if (igReachCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'instagram' } }, name: { contains: 'Показ' } },
      data: { categoryId: igReachCat.id, tenantId: 'all' }
    });
  }

  // 2. Rutube: Вывод в ТОП и Реакции
  const rutubeTopCat = await getOrCreateCategory('rutube', '🚀 Вывод в ТОП и Ракеты (Rutube)', 'LIKES');
  const rutubeReactionsCat = await getOrCreateCategory('rutube', '🎭 Реакции и Эмоции', 'LIKES');
  if (rutubeTopCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'rutube' } }, OR: [{ name: { contains: 'ТОП' } }, { name: { contains: 'Топ' } }] },
      data: { categoryId: rutubeTopCat.id, tenantId: 'all' }
    });
  }
  if (rutubeReactionsCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'rutube' } }, name: { contains: 'эмоции' } },
      data: { categoryId: rutubeReactionsCat.id, tenantId: 'all' }
    });
  }

  // 3. Reddit: Апвоуты
  const redditUpvotesCat = await getOrCreateCategory('reddit', '⬆️ Апвоуты постов (Upvotes)', 'LIKES');
  if (redditUpvotesCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'reddit' } }, name: { contains: 'Апвоут' } },
      data: { categoryId: redditUpvotesCat.id, tenantId: 'all' }
    });
  }

  // 4. Pinterest: Репины и Сохранения
  const pinterestPinsCat = await getOrCreateCategory('pinterest', '📌 Репины и Сохранения (Pins)', 'LIKES');
  const pinterestSeoCat = await getOrCreateCategory('pinterest', '🌐 Вечные ссылки и SEO', 'SHARES');
  if (pinterestPinsCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'pinterest' } }, name: { contains: 'Репин' } },
      data: { categoryId: pinterestPinsCat.id, tenantId: 'all' }
    });
  }
  if (pinterestSeoCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'pinterest' } }, OR: [{ name: { contains: 'ссылок' } }, { name: { contains: 'Сигналы' } }] },
      data: { categoryId: pinterestSeoCat.id, tenantId: 'all' }
    });
  }

  // 5. LinkedIn: Связи и Подтверждение навыков
  const linkedinCat = await getOrCreateCategory('linkedin', '🤝 Деловые контакты и Навыки (Connections & Endorsements)', 'FOLLOWERS');
  if (linkedinCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'linkedin' } } },
      data: { categoryId: linkedinCat.id, tenantId: 'all' }
    });
  }

  // 6. Medium: Хлопки и Избранное
  const mediumCat = await getOrCreateCategory('medium', '👏 Хлопки и Избранное (Claps & Bookmarks)', 'LIKES');
  if (mediumCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'medium' } } },
      data: { categoryId: mediumCat.id, tenantId: 'all' }
    });
  }

  // 7. Quora: Апвоуты и Даунвоуты
  const quoraCat = await getOrCreateCategory('quora', '⬆️ Апвоуты и Даунвоуты ответов', 'LIKES');
  if (quoraCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'quora' } } },
      data: { categoryId: quoraCat.id, tenantId: 'all' }
    });
  }

  // 8. Kick: Платные подписки и KICKs
  const kickCat = await getOrCreateCategory('kick', '💎 Платные подписки и KICKs', 'FOLLOWERS');
  if (kickCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'kick' } } },
      data: { categoryId: kickCat.id, tenantId: 'all' }
    });
  }

  // 9. Twitch: Платные подписки
  const twitchSubs = await getOrCreateCategory('twitch', '💎 Платные подписки (Sub Tier 1/2/3) & Биты', 'FOLLOWERS');
  if (twitchSubs) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'twitch' } }, name: { contains: 'Подписка' } },
      data: { categoryId: twitchSubs.id, tenantId: 'all' }
    });
  }

  // 10. WhatsApp: Жалобы и Бан
  const waReportsCat = await getOrCreateCategory('whatsapp', '🛡️ Жалобы и Бан номеров', 'REPORTS');
  if (waReportsCat) {
    await db.service.updateMany({
      where: { category: { network: { slug: 'whatsapp' } }, name: { contains: 'бан' } },
      data: { categoryId: waReportsCat.id, tenantId: 'all' }
    });
  }

  // 11. VK: Объединить вступления в группы и сообщества
  const vkGroupSubs = await db.category.findFirst({
    where: { network: { slug: 'vk' }, name: { contains: 'Подписчики в группу' } }
  });
  const vkGroupJoins = await db.category.findFirst({
    where: { network: { slug: 'vk' }, name: { contains: 'Вступления в сообщества' } }
  });
  if (vkGroupSubs && vkGroupJoins) {
    await db.service.updateMany({
      where: { categoryId: vkGroupJoins.id },
      data: { categoryId: vkGroupSubs.id, tenantId: 'all' }
    });
    await db.category.update({
      where: { id: vkGroupSubs.id },
      data: { name: '👥 Подписчики и вступления в сообщества' }
    });
    await db.category.delete({ where: { id: vkGroupJoins.id } });
  }

  // 12. Clean up any remaining empty categories across the whole database
  const deleted = await db.category.deleteMany({
    where: { services: { none: {} } }
  });
  console.log(`🧹 Deleted empty categories: ${deleted.count}`);

  // 13. Ensure tenantId = 'all'
  await db.service.updateMany({ data: { tenantId: 'all' } });
  await db.category.updateMany({ data: { tenantId: 'all' } });
  await db.network.updateMany({ data: { tenantId: 'all' } });

  console.log('✨ Deep Native Platform Taxonomy Refinement completed successfully!');
}

main().catch(err => {
  console.error('Error during taxonomy refinement:', err);
  process.exit(1);
});
