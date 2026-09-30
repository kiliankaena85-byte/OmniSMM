import type { FluxNetwork } from "@/types/flux";
export { matchesNetworkSearch, NETWORK_SEARCH_ALIASES } from "./flux-search-aliases";

export const BRAND_ICON_MAP: Record<string, string> = {
  odnoklassniki: '/brands/ok.svg',
  ok: '/brands/ok.svg',
  'yandex-dzen': '/brands/dzen.svg',
  dzen: '/brands/dzen.svg',
  'yandex dzen': '/brands/dzen.svg',
  vkontakte: '/brands/vk.svg',
  vk: '/brands/vk.svg',
  behance: '/brands/behance.svg',
  viber: '/brands/viber.svg',
  pikabu: '/brands/pikabu.svg',
  quora: '/brands/quora.svg',
  rumble: '/brands/rumble.svg',
  telegram: '/brands/telegram.svg',
  youtube: '/brands/youtube.svg',
  instagram: '/brands/instagram.svg',
  tiktok: '/brands/tiktok.svg',
  rutube: '/brands/rutube.svg',
  discord: '/brands/discord.svg',
  facebook: '/brands/facebook.svg',
  github: '/brands/github.svg',
  kick: '/brands/kick.svg',
  likee: '/brands/likee.svg',
  linkedin: '/brands/linkedin.svg',
  medium: '/brands/medium.svg',
  pinterest: '/brands/pinterest.svg',
  reddit: '/brands/reddit.svg',
  snapchat: '/brands/snapchat.svg',
  soundcloud: '/brands/soundcloud.svg',
  spotify: '/brands/spotify.svg',
  steam: '/brands/steam.svg',
  threads: '/brands/threads.svg',
  trovo: '/brands/trovo.svg',
  tumblr: '/brands/tumblr.svg',
  twitch: '/brands/twitch.svg',
  whatsapp: '/brands/whatsapp.svg',
  twitter: '/brands/x.svg',
  x: '/brands/x.svg',
  appstore: '/brands/appstore.svg',
  googleplay: '/brands/googleplay.svg',
  google: '/brands/google.svg',
};

export function isMonochromeIcon(network: FluxNetwork): boolean {
  const s = (network.slug || '').toLowerCase().trim();
  const n = (network.name || '').toLowerCase().trim();

  // Multi-letter monochrome identifiers
  if (s.includes('github') || n.includes('github')) return true;
  if (s.includes('threads') || n.includes('threads')) return true;
  if (s.includes('twitter') || n.includes('twitter')) return true;
  if (s.includes('medium') || n.includes('medium')) return true;

  // Single-letter 'x' exact token matching (protects 'yandex', 'max', etc.)
  if (s === 'x' || s === 'x-twitter' || s === 'twitter-x' || n === 'x' || n.startsWith('x ') || n.includes(' x ') || n.endsWith(' x') || n.includes('(x)')) {
    return true;
  }

  return false;
}

export function resolveNetworkIcon(network: FluxNetwork): string {
  if (network.icon && network.icon.trim().length > 0 && network.icon !== '/brands/generic.svg') {
    return network.icon;
  }
  const slug = (network.slug || '').toLowerCase().trim();
  const name = (network.name || '').toLowerCase().trim();
  if (BRAND_ICON_MAP[slug]) return BRAND_ICON_MAP[slug];
  if (BRAND_ICON_MAP[name]) return BRAND_ICON_MAP[name];

  for (const [key, path] of Object.entries(BRAND_ICON_MAP)) {
    if (key.length <= 2) {
      const words = slug.split(/[-_\s]+/);
      const nameWords = name.split(/[-_\s]+/);
      if (words.includes(key) || nameWords.includes(key)) {
        return path;
      }
    } else if (slug.includes(key) || name.includes(key)) {
      return path;
    }
  }
  return '/brands/generic.svg';
}

export function isTop6Network(network: FluxNetwork): boolean {
  const s = (network.slug || '').toLowerCase();
  const n = (network.name || '').toLowerCase();
  return (
    s.includes('telegram') || n.includes('telegram') || n.includes('телеграм') || s === 'tg' ||
    s === 'vk' || s.includes('vkontakte') || n.includes('вконтакте') || n.includes('vk') || n === 'вк' ||
    s.includes('youtube') || n.includes('youtube') || n.includes('ютуб') || s === 'yt' ||
    s.includes('instagram') || n.includes('instagram') || n.includes('инстаграм') || s === 'ig' ||
    s.includes('tiktok') || n.includes('tiktok') || n.includes('тикток') || s === 'tt' ||
    s.includes('rutube') || n.includes('rutube') || n.includes('рутуб') || s === 'rt'
  );
}

export function getTop6Rank(network: FluxNetwork): number {
  const s = (network.slug || '').toLowerCase();
  const n = (network.name || '').toLowerCase();
  if (s.includes('telegram') || n.includes('telegram') || n.includes('телеграм') || s === 'tg') return 1;
  if (s === 'vk' || s.includes('vkontakte') || n.includes('вконтакте') || n.includes('vk') || n === 'вк') return 2;
  if (s.includes('youtube') || n.includes('youtube') || n.includes('ютуб') || s === 'yt') return 3;
  if (s.includes('instagram') || n.includes('instagram') || n.includes('инстаграм') || s === 'ig') return 4;
  if (s.includes('tiktok') || n.includes('tiktok') || n.includes('тикток') || s === 'tt') return 5;
  if (s.includes('rutube') || n.includes('rutube') || n.includes('рутуб') || s === 'rt') return 6;
  return 99;
}

export const TOP_BADGES: Record<number, { label: string; badgeClass: string }> = {
  1: { label: 'ТОП', badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 font-black' },
  2: { label: 'ХИТ', badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 font-black' },
  3: { label: 'ХИТ', badgeClass: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30 font-black' },
  4: { label: 'ТОП', badgeClass: 'bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30 font-black' },
  5: { label: 'ХИТ', badgeClass: 'bg-neutral-900/10 dark:bg-white/10 text-neutral-900 dark:text-neutral-100 border-neutral-300 dark:border-neutral-700 font-black' },
  6: { label: 'ТОП', badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30 font-black' },
};

export type TaxonomyId = 'all' | 'messengers' | 'video' | 'social' | 'streams_music';

export const TAXONOMY_CHIPS: Array<{ id: TaxonomyId; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'messengers', label: 'Мессенджеры' },
  { id: 'video', label: 'Видео' },
  { id: 'social', label: 'Соцсети' },
  { id: 'streams_music', label: 'Стримы & Музыка' },
];

const TAXONOMY_SLUGS: Record<TaxonomyId, string[]> = {
  all: [],
  messengers: ['telegram', 'whatsapp', 'viber', 'discord'],
  video: ['youtube', 'rutube', 'tiktok', 'likee', 'rumble'],
  social: [
    'vkontakte', 'vk', 'instagram', 'facebook', 'odnoklassniki', 'ok',
    'threads', 'twitter', 'x', 'reddit', 'pinterest', 'tumblr',
    'pikabu', 'linkedin', 'behance', 'quora', 'dzen', 'yandex-dzen', 'max'
  ],
  streams_music: ['twitch', 'kick', 'trovo', 'spotify', 'soundcloud', 'steam', 'audiomack', 'applemusic']
};

export function matchesTaxonomy(network: FluxNetwork, taxonomy: TaxonomyId): boolean {
  if (taxonomy === 'all') return true;
  const s = (network.slug || '').toLowerCase();
  const n = (network.name || '').toLowerCase();
  const allowed = TAXONOMY_SLUGS[taxonomy];
  return allowed.some(term => s.includes(term) || n.includes(term));
}
