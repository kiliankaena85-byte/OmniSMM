import type { FluxNetwork } from "@/types/flux";

export const NETWORK_SEARCH_ALIASES: Record<string, string[]> = {
  telegram: ['телеграм', 'телега', 'тг', 'tg', 'телеграмм', 'telegram'],
  vkontakte: ['вконтакте', 'вк', 'vk', 'vkontakte'],
  vk: ['вконтакте', 'вк', 'vk', 'vkontakte'],
  youtube: ['ютуб', 'ютюб', 'ютубчик', 'yt', 'you tube', 'youtube'],
  instagram: ['инстаграм', 'инста', 'инст', 'ig', 'insta', 'instagram'],
  tiktok: ['тикток', 'тиктокер', 'тт', 'tt', 'тик ток', 'tiktok'],
  rutube: ['рутуб', 'рутьюб', 'рт', 'rt', 'rutube'],
  discord: ['дискорд', 'диск', 'дс', 'dc', 'discord'],
  twitch: ['твич', 'твитч', 'twitch'],
  whatsapp: ['ватсап', 'вацап', 'воцап', 'вазап', 'wa', 'whats app', 'whatsapp'],
  viber: ['вайбер', 'вибер', 'viber'],
  pikabu: ['пикабу', 'пикабушник', 'pikabu'],
  spotify: ['спотифай', 'споти', 'spotify'],
  soundcloud: ['саундклауд', 'саунд', 'soundcloud'],
  steam: ['стим', 'steam'],
  twitter: ['твиттер', 'твит', 'твитер', 'х', 'икс', 'x', 'twitter'],
  x: ['твиттер', 'твит', 'твитер', 'х', 'икс', 'x', 'twitter'],
  kick: ['кик', 'kick'],
  trovo: ['трово', 'trovo'],
  reddit: ['реддит', 'рединг', 'reddit'],
  likee: ['лайки', 'лайк', 'likee'],
  linkedin: ['линкедин', 'линкед', 'linkedin'],
  pinterest: ['пинтерест', 'пин', 'pinterest'],
  behance: ['беханс', 'бехансе', 'behance'],
  github: ['гитхаб', 'гит', 'github'],
  facebook: ['фейсбук', 'фэйсбук', 'фб', 'fb', 'facebook'],
  threads: ['тредс', 'тридс', 'threads'],
  odnoklassniki: ['одноклассники', 'однокласс', 'ок', 'ok', 'odnoklassniki'],
  ok: ['одноклассники', 'однокласс', 'ок', 'ok', 'odnoklassniki'],
  dzen: ['дзен', 'яндекс дзен', 'яндекс', 'dzen', 'yandex-dzen'],
  'yandex-dzen': ['дзен', 'яндекс дзен', 'яндекс', 'dzen', 'yandex-dzen'],
  snapchat: ['снапчат', 'снап', 'snapchat', 'snap'],
  quora: ['квора', 'quora'],
  rumble: ['рамбл', 'rumble'],
  tumblr: ['тамблер', 'тумблер', 'tumblr'],
  medium: ['медиум', 'medium'],
};

export function matchesNetworkSearch(network: FluxNetwork, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const slug = (network.slug || '').toLowerCase().trim();
  const name = (network.name || '').toLowerCase().trim();

  // Direct substring matches
  if (name.includes(query) || slug.includes(query)) return true;

  // Exact abbreviation check
  if (query === 'тг' && (slug.includes('telegram') || name.includes('telegram'))) return true;
  if (query === 'вк' && (slug.includes('vk') || name.includes('вконтакте'))) return true;
  if (query === 'тт' && (slug.includes('tiktok') || name.includes('tiktok'))) return true;
  if (query === 'рт' && (slug.includes('rutube') || name.includes('rutube'))) return true;
  if (query === 'дс' && (slug.includes('discord') || name.includes('discord'))) return true;
  if (query === 'ок' && (slug.includes('ok') || slug.includes('odnoklassniki') || name.includes('одноклассники'))) return true;

  // Search aliases lookup
  for (const [key, aliases] of Object.entries(NETWORK_SEARCH_ALIASES)) {
    if (slug === key || slug.includes(key) || name.includes(key) || key.includes(slug)) {
      if (aliases.some(alias => alias.includes(query) || query.includes(alias))) {
        return true;
      }
    }
  }

  // Reverse alias check: does query start with or match an alias belonging to this network?
  for (const [key, aliases] of Object.entries(NETWORK_SEARCH_ALIASES)) {
    if (aliases.some(alias => alias === query || alias.startsWith(query) || query.startsWith(alias))) {
      if (slug.includes(key) || key.includes(slug) || name.includes(key) || key.includes(name)) {
        return true;
      }
    }
  }

  return false;
}
