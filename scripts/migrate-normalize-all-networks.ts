import * as dotenv from 'dotenv';
dotenv.config();
import { db } from '@/lib/db';

async function main() {
  console.log('=== NORMALIZING ALL REMAINING NETWORKS ===\n');

  // Networks to normalize
  const networksConfig = [
    {
      slug: 'youtube',
      categories: [
        { name: '👁️ Просмотры', slug: 'yt-views', sort: 1, match: ['просмотр', 'views'] },
        { name: '👥 Подписчики', slug: 'yt-subscribers', sort: 2, match: ['подписчик', 'subscribers'] },
        { name: '❤️ Лайки', slug: 'yt-likes', sort: 3, match: ['лайк', 'likes'] },
        { name: '💬 Комментарии', slug: 'yt-comments', sort: 4, match: ['комментар', 'comments'] },
        { name: '⏱️ Часы просмотров', slug: 'yt-watchtime', sort: 5, match: ['час', 'монетизац', 'watch'] },
      ],
      defaultSlug: 'yt-views'
    },
    {
      slug: 'instagram',
      categories: [
        { name: '👥 Подписчики', slug: 'ig-subscribers', sort: 1, match: ['подписчик', 'followers'] },
        { name: '❤️ Лайки', slug: 'ig-likes', sort: 2, match: ['лайк', 'likes'] },
        { name: '👁️ Просмотры Reels и Stories', slug: 'ig-views', sort: 3, match: ['просмотр', 'reels', 'stories', 'охват'] },
        { name: '💬 Комментарии', slug: 'ig-comments', sort: 4, match: ['комментар', 'comments'] },
      ],
      defaultSlug: 'ig-subscribers'
    },
    {
      slug: 'vk',
      categories: [
        { name: '👥 Подписчики в группу', slug: 'vk-subscribers', sort: 1, match: ['подписчик', 'групп', 'паблик', 'друзь'] },
        { name: '❤️ Лайки', slug: 'vk-likes', sort: 2, match: ['лайк', 'likes'] },
        { name: '👁️ Просмотры постов и клипов', slug: 'vk-views', sort: 3, match: ['просмотр', 'клип', 'глаз'] },
        { name: '🔄 Репосты', slug: 'vk-reposts', sort: 4, match: ['репост', 'поделит'] },
        { name: '💬 Комментарии', slug: 'vk-comments', sort: 5, match: ['комментар', 'comments'] },
      ],
      defaultSlug: 'vk-subscribers'
    },
    {
      slug: 'tiktok',
      categories: [
        { name: '👥 Подписчики', slug: 'tt-subscribers', sort: 1, match: ['подписчик', 'followers'] },
        { name: '👁️ Просмотры', slug: 'tt-views', sort: 2, match: ['просмотр', 'views'] },
        { name: '❤️ Лайки', slug: 'tt-likes', sort: 3, match: ['лайк', 'likes'] },
        { name: '🔄 Репосты и сохранения', slug: 'tt-shares', sort: 4, match: ['репост', 'сохранен', 'share'] },
      ],
      defaultSlug: 'tt-views'
    }
  ];

  for (const netCfg of networksConfig) {
    const net = await db.network.findFirst({ where: { slug: netCfg.slug } });
    if (!net) continue;

    console.log(`\n--- Processing Network: ${net.name} (${net.slug}) ---`);

    const catMap = new Map<string, string>();
    for (const c of netCfg.categories) {
      const existing = await db.category.findFirst({
        where: { networkId: net.id, OR: [{ slug: c.slug }, { name: c.name }] }
      });
      if (existing) {
        const u = await db.category.update({
          where: { id: existing.id },
          data: { name: c.name, slug: c.slug, sort: c.sort }
        });
        catMap.set(c.slug, u.id);
      } else {
        const created = await db.category.create({
          data: { name: c.name, slug: c.slug, sort: c.sort, networkId: net.id, tenantId: 'smmplan' }
        });
        catMap.set(c.slug, created.id);
      }
    }

    const services = await db.service.findMany({
      where: { category: { networkId: net.id } }
    });

    console.log(`Classifying ${services.length} services for ${net.name}...`);
    for (const s of services) {
      const lower = s.name.toLowerCase();
      let matchedSlug = netCfg.defaultSlug;

      for (const c of netCfg.categories) {
        if (c.match.some(m => lower.includes(m))) {
          matchedSlug = c.slug;
          break;
        }
      }

      const targetId = catMap.get(matchedSlug);
      if (targetId && s.categoryId !== targetId) {
        await db.service.update({
          where: { id: s.id },
          data: { categoryId: targetId }
        });
      }
    }

    // Clean up empty obsolete categories
    const validIds = Array.from(catMap.values());
    const obsolete = await db.category.findMany({
      where: { networkId: net.id, id: { notIn: validIds } },
      include: { services: true }
    });

    for (const obs of obsolete) {
      if (obs.services.length === 0) {
        await db.category.delete({ where: { id: obs.id } });
        console.log(`✓ Deleted empty obsolete category: "${obs.name}" (${obs.id})`);
      }
    }
  }

  console.log('\n✅ ALL NETWORKS NORMALIZED SUCCESSFULLY!');
}

main().then(() => process.exit(0)).catch(err => { console.error('FATAL:', err); process.exit(1); });
