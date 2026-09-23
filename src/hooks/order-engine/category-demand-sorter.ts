/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Category demand scoring and sorting utility.
 */

export function getCategoryDemandScore(name: string): number {
  const n = name.toLowerCase();
  
  if ((n.includes('подписчик') || n.includes('участник') || n.includes('follow') || n.includes('member')) && !n.includes('premium') && !n.includes('премиум') && !n.includes('бот')) {
    return 10;
  }
  if (n.includes('просмотр') || n.includes('охват') || n.includes('view') || n.includes('watch') || n.includes('stat') || n.includes('стат')) {
    return 20;
  }
  if (n.includes('лайк') || n.includes('like') || n.includes('нравится') || n.includes('heart')) {
    return 30;
  }
  if (n.includes('реакц') || n.includes('reaction') || n.includes('emoji') || n.includes('эмоци')) {
    return 40;
  }
  if (n.includes('premium') || n.includes('премиум')) {
    return 95;
  }
  if (n.includes('буст') || n.includes('boost') || n.includes('level')) {
    return 60;
  }
  if (n.includes('коммент') || n.includes('comment') || n.includes('отзыв') || n.includes('review')) {
    return 70;
  }
  if (n.includes('репост') || n.includes('repost') || n.includes('share') || n.includes('поделит')) {
    return 80;
  }
  if (n.includes('звезд') || n.includes('star') || n.includes('coin')) {
    return 90;
  }
  if (n.includes('бот') || n.includes('bot') || n.includes('инвайт') || n.includes('invite') || n.includes('referral') || n.includes('рефер')) {
    return 100;
  }
  return 999;
}

export function sortCategories<T extends { name: string }>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const scoreA = getCategoryDemandScore(a.name);
    const scoreB = getCategoryDemandScore(b.name);
    
    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }
    return a.name.localeCompare(b.name);
  });
}
