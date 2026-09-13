/**
 * Loyalty & Client Tier Calculation Utility (OmniSMM 1.0)
 * Calculates client status, cashback bonus, and tier progression based on BigInt kopecks.
 */

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD';

export interface LoyaltyInfo {
  tier: LoyaltyTier;
  tierName: string;
  badgeColor: string;
  cashbackPercent: number;
  discountPercent: number;
  nextTierName: string | null;
  thresholdKopecks: bigint;
  nextThresholdKopecks: bigint | null;
  progressPercent: number;
  remainingToNextTierRub: number;
}

/**
 * Computes Banker's Rounding (Half-Even) percentage for loyalty tiers using pure BigInt.
 */
function halfEvenPercent(numerator: bigint, denominator: bigint): number {
  if (denominator <= BigInt(0)) return 0;
  // Scaled by 10 to inspect the first decimal digit for banker's rounding
  const scaled = (numerator * BigInt(1000)) / denominator;
  const rem = scaled % BigInt(10);
  const base = scaled / BigInt(10);
  if (rem > BigInt(5)) {
    return Math.min(100, Math.max(0, Number(base + BigInt(1))));
  } else if (rem === BigInt(5)) {
    return Math.min(100, Math.max(0, Number(base % BigInt(2) === BigInt(1) ? base + BigInt(1) : base)));
  }
  return Math.min(100, Math.max(0, Number(base)));
}

export function getLoyaltyInfo(totalSpentKopecks: bigint | number): LoyaltyInfo {
  const spent = typeof totalSpentKopecks === 'bigint' 
    ? (totalSpentKopecks < BigInt(0) ? BigInt(0) : totalSpentKopecks)
    : BigInt(String(Math.max(0, Math.floor(totalSpentKopecks))));

  // Thresholds in kopecks:
  // Bronze: 0 - 5 000 RUB (0 - 500 000 kopecks) -> Cashback 1%
  // Silver: 5 000 - 25 000 RUB (500 000 - 2 500 000 kopecks) -> Cashback 3%, Discount 3%
  // Gold: 25 000+ RUB (2 500 000+ kopecks) -> Cashback 5%, Discount 5%

  const SILVER_THRESHOLD = BigInt(500000);   // 5 000 RUB
  const GOLD_THRESHOLD = BigInt(2500000);    // 25 000 RUB

  if (spent >= GOLD_THRESHOLD) {
    return {
      tier: 'GOLD',
      tierName: 'Gold Client',
      badgeColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20',
      cashbackPercent: 5,
      discountPercent: 5,
      nextTierName: null,
      thresholdKopecks: GOLD_THRESHOLD,
      nextThresholdKopecks: null,
      progressPercent: 100,
      remainingToNextTierRub: 0,
    };
  }

  if (spent >= SILVER_THRESHOLD) {
    const range = GOLD_THRESHOLD - SILVER_THRESHOLD;
    const current = spent - SILVER_THRESHOLD;
    const progress = halfEvenPercent(current, range);
    const remainingKopecks = GOLD_THRESHOLD - spent;
    // Explicit user-facing ceiling in integer BigInt math: shows whole rubles required to achieve next tier
    const remainingToNextTierRub = Number((remainingKopecks + BigInt(99)) / BigInt(100));
    return {
      tier: 'SILVER',
      tierName: 'Silver Client',
      badgeColor: 'text-slate-700 dark:text-slate-200 bg-slate-500/10 border border-slate-500/20',
      cashbackPercent: 3,
      discountPercent: 3,
      nextTierName: 'Gold',
      thresholdKopecks: SILVER_THRESHOLD,
      nextThresholdKopecks: GOLD_THRESHOLD,
      progressPercent: progress,
      remainingToNextTierRub,
    };
  }

  const progress = halfEvenPercent(spent, SILVER_THRESHOLD);
  const remainingKopecks = SILVER_THRESHOLD - spent;
  // Explicit user-facing ceiling in integer BigInt math: shows whole rubles required to achieve next tier
  const remainingToNextTierRub = Number((remainingKopecks + BigInt(99)) / BigInt(100));
  return {
    tier: 'BRONZE',
    tierName: 'Bronze Client',
    badgeColor: 'text-orange-700 dark:text-orange-400 bg-orange-500/10 border border-orange-500/20',
    cashbackPercent: 1,
    discountPercent: 0,
    nextTierName: 'Silver',
    thresholdKopecks: BigInt(0),
    nextThresholdKopecks: SILVER_THRESHOLD,
    progressPercent: progress,
    remainingToNextTierRub,
  };
}

export function getOrderProgressPercent(status: string): number {
  switch (status) {
    case 'COMPLETED':
      return 100;
    case 'IN_PROGRESS':
      return 65;
    case 'PROVISIONING':
      return 25;
    case 'PENDING':
    case 'AWAITING_PAYMENT':
      return 10;
    case 'PARTIAL':
      return 85;
    case 'CANCELED':
    case 'ERROR':
    default:
      return 0;
  }
}

export const TOP_LAUNCHPAD_NETWORKS = [
  { 
    slug: 'telegram', 
    name: 'Telegram', 
    desc: 'Подписчики, Просмотры, Реакции', 
    priceFrom: 'от 0.01 ₽ / шт', 
    glow: 'hover:border-sky-500/40 hover:shadow-sky-500/15', 
    badge: 'Топ 1',
    badgeColor: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20' 
  },
  { 
    slug: 'vk', 
    name: 'ВКонтакте', 
    desc: 'Подписчики, Лайки, Просмотры', 
    priceFrom: 'от 0.05 ₽ / шт', 
    glow: 'hover:border-blue-500/40 hover:shadow-blue-500/15', 
    badge: 'Хит РФ',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' 
  },
  { 
    slug: 'instagram', 
    name: 'Instagram', 
    desc: 'Фолловеры, Лайки, Reels', 
    priceFrom: 'от 0.08 ₽ / шт', 
    glow: 'hover:border-pink-500/40 hover:shadow-pink-500/15',
    badge: 'Быстро',
    badgeColor: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20'
  },
  { 
    slug: 'youtube', 
    name: 'YouTube', 
    desc: 'Просмотры с удержанием, Shorts', 
    priceFrom: 'от 0.12 ₽ / шт', 
    glow: 'hover:border-red-500/40 hover:shadow-red-500/15', 
    badge: 'Качество',
    badgeColor: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' 
  },
  { 
    slug: 'tiktok', 
    name: 'TikTok', 
    desc: 'Просмотры, Лайки, Подписчики', 
    priceFrom: 'от 0.04 ₽ / шт', 
    glow: 'hover:border-neutral-500/40 hover:shadow-neutral-500/15', 
    badge: 'Тренды',
    badgeColor: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20' 
  },
  { 
    slug: 'rutube', 
    name: 'Rutube', 
    desc: 'Просмотры, Подписчики, Топ', 
    priceFrom: 'от 0.09 ₽ / шт', 
    glow: 'hover:border-orange-500/40 hover:shadow-orange-500/15', 
    badge: 'РФ Видео',
    badgeColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' 
  },
  { 
    slug: 'dzen', 
    name: 'Дзен', 
    desc: 'Дочитывания, Подписчики, Лайки', 
    priceFrom: 'от 0.07 ₽ / шт', 
    glow: 'hover:border-amber-500/40 hover:shadow-amber-500/15', 
    badge: 'Статьи',
    badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
  },
];
