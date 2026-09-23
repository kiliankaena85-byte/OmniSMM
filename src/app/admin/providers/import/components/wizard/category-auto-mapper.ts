import { inferTargetTypeFromName, inferTargetTypeFromCategory, isTargetTypeCompatible } from '@/utils/target-type';
import type { ExternalServiceItem, CategoryItem } from '../../types';

export const autoMapCategory = (
  s: ExternalServiceItem,
  categories: CategoryItem[]
): { id: string; confident: boolean } | null => {
  // Normalise platform: some providers send 'Vkontakte' or 'vk' instead of 'VK'
  const rawPlatform = (s.metrics?.platform || '').trim();
  const platform = rawPlatform.toUpperCase()
    .replace(/^VKONTAKTE$/, 'VK')
    .replace(/^VK\.COM$/, 'VK');

  const category = (s.metrics?.category || '').toUpperCase();
  const serviceName = (s.name || '').toLowerCase();
  const serviceTargetType = inferTargetTypeFromName(s.name);

  // Filter categories by platform — try both the slug AND the network name
  const platformCategories = categories.filter((c) => {
    const netSlug = (c.network?.slug || '').toUpperCase()
      .replace(/^VKONTAKTE$/, 'VK')
      .replace(/^VK\.COM$/, 'VK');
    const netName = (c.network?.name || '').toUpperCase()
      .replace(/ВКОНТАКТЕ/g, 'VK')
      .replace(/ВКОНТАКТE/g, 'VK');
    return netSlug === platform || netName.includes(platform);
  });

  const targetCategories = platformCategories.length > 0 ? platformCategories : categories;

  const keywords: Record<string, string[]> = {
    SUBSCRIBERS: ['sub', 'member', 'channel', 'group', 'joiner', 'follower', 'подпис', 'участ', 'друг', 'фолловер', 'читател', 'инвайт', 'буст', 'boost'],
    LIKES: ['like', 'heart', 'favorite', 'upvote', 'лайк', 'нравится', 'сердеч', 'клас'],
    VIEWS: ['view', 'play', 'impression', 'reach', 'просм', 'показ', 'глаз', 'видео', 'стат'],
    REPOSTS: ['repost', 'share', 'retweet', 'репост', 'подели'],
    REACTIONS: ['react', 'emoji', 'fire', 'thumb', 'реакц', 'эмод'],
    COMMENTS: ['comment', 'reply', 'custom comment', 'коммен', 'отзыв'],
    STORIES: ['story', 'stories', 'сторис'],
    POLLS: ['poll', 'vote', 'votes', 'опрос', 'голос', 'голоса', 'голосов'],
  };

  let bestCategory: CategoryItem | null = null;
  let maxScore = -1;

  for (const c of targetCategories) {
    const catSlug = (c.slug || c.id || '').toUpperCase();
    const catName = (c.name || '').toLowerCase();
    const catTargetType = inferTargetTypeFromCategory(c.name);

    if (!isTargetTypeCompatible(serviceTargetType, catTargetType)) {
      continue;
    }

    let score = 0;

    if (category && keywords[category]) {
      const words = keywords[category];
      const matchesCat = words.some((w) => catSlug.includes(w.toUpperCase()) || catName.includes(w));
      if (matchesCat) {
        score += 25;
      }
    }

    for (const [, words] of Object.entries(keywords)) {
      const serviceMatches = words.some((w) => serviceName.includes(w));
      if (serviceMatches) {
        const catMatches = words.some((w) => catSlug.includes(w.toUpperCase()) || catName.includes(w));
        if (catMatches) {
          score += 15;
        }
        words.forEach((w: string) => {
          if (serviceName.includes(w) && (catName.includes(w) || catSlug.includes(w.toUpperCase()))) {
            score += 5;
          }
        });
      }
    }

    const nameWords = serviceName.split(/[\s_\-+.#()\/]+/);
    const catWords = catName.split(/[\s_\-+.#()\/]+/);
    nameWords.forEach((nw: string) => {
      if (nw.length > 2 && catWords.includes(nw)) {
        score += 10;
      }
    });

    if (score > maxScore) {
      maxScore = score;
      bestCategory = c;
    }
  }

  if (bestCategory && maxScore >= 10) {
    return { id: bestCategory.id, confident: true };
  }

  // Fallback: if platform matched categories exist, return the best scoring one
  if (platformCategories.length > 0 && bestCategory && maxScore >= 0) {
    return { id: bestCategory.id, confident: false };
  }

  return { id: '', confident: false };
};
