/**
 * OmniSMM Icon Registry & Smart Suggestion Engine
 * High-performance curated icons catalog with bilingual RU/EN search and smart auto-detection.
 */

export interface IconDefinition {
  id: string; // e.g. "lucide:heart" or "brand:telegram"
  name: string; // e.g. "heart"
  type: 'lucide' | 'brand' | 'custom';
  label: string; // Human label: "Лайки / Сердце"
  category: 'social' | 'metric' | 'feature' | 'general';
  keywords: string[]; // ['лайк', 'сердце', 'симпатия', 'любовь', 'like', 'heart']
  color?: string; // Default brand or semantic color
}

// ─── BRAND ICONS REGISTRY ──────────────────────────────────────────────────
export const BRAND_ICONS: IconDefinition[] = [
  { id: 'brand:telegram', name: 'telegram', type: 'brand', label: 'Telegram', category: 'social', color: '#2AABEE', keywords: ['телеграм', 'телега', 'тг', 'telegram', 'tg', 'channel', 'group'] },
  { id: 'brand:vk', name: 'vk', type: 'brand', label: 'ВКонтакте', category: 'social', color: '#0077FF', keywords: ['вконтакте', 'вк', 'паблик', 'vk', 'vkontakte'] },
  { id: 'brand:instagram', name: 'instagram', type: 'brand', label: 'Instagram', category: 'social', color: '#E1306C', keywords: ['инстаграм', 'инста', 'рилс', 'сторис', 'instagram', 'ig', 'reels'] },
  { id: 'brand:youtube', name: 'youtube', type: 'brand', label: 'YouTube', category: 'social', color: '#FF0000', keywords: ['ютуб', 'ютубчик', 'шортс', 'youtube', 'yt', 'shorts'] },
  { id: 'brand:tiktok', name: 'tiktok', type: 'brand', label: 'TikTok', category: 'social', color: '#000000', keywords: ['тикток', 'тт', 'видео', 'tiktok', 'tt'] },
  { id: 'brand:twitch', name: 'twitch', type: 'brand', label: 'Twitch', category: 'social', color: '#9146FF', keywords: ['твич', 'стрим', 'twitch', 'stream'] },
  { id: 'brand:discord', name: 'discord', type: 'brand', label: 'Discord', category: 'social', color: '#5865F2', keywords: ['дискорд', 'сервер', 'discord', 'dc'] },
  { id: 'brand:max', name: 'max', type: 'brand', label: 'MAX', category: 'social', color: '#5355ee', keywords: ['макс', 'max', 'мессенджер'] },
  { id: 'brand:rutube', name: 'rutube', type: 'brand', label: 'Rutube', category: 'social', color: '#00A6DF', keywords: ['рутуб', 'rutube'] },
  { id: 'brand:dzen', name: 'dzen', type: 'brand', label: 'Дзен', category: 'social', color: '#FF3300', keywords: ['дзен', 'яндекс', 'dzen', 'yandex'] },
  { id: 'brand:threads', name: 'threads', type: 'brand', label: 'Threads', category: 'social', color: '#000000', keywords: ['тредс', 'threads'] },
  { id: 'brand:twitter', name: 'twitter', type: 'brand', label: 'X (Twitter)', category: 'social', color: '#000000', keywords: ['твиттер', 'икс', 'twitter', 'x'] },
  { id: 'brand:likee', name: 'likee', type: 'brand', label: 'Likee', category: 'social', color: '#FF0050', keywords: ['лайки', 'лайк', 'likee'] },
  { id: 'brand:kick', name: 'kick', type: 'brand', label: 'Kick', category: 'social', color: '#53FC18', keywords: ['кик', 'стрим', 'kick'] },
  { id: 'brand:steam', name: 'steam', type: 'brand', label: 'Steam', category: 'social', color: '#171A21', keywords: ['стим', 'игры', 'steam'] },
  { id: 'brand:spotify', name: 'spotify', type: 'brand', label: 'Spotify', category: 'social', color: '#1DB954', keywords: ['спотифай', 'музыка', 'spotify'] },
  { id: 'brand:soundcloud', name: 'soundcloud', type: 'brand', label: 'SoundCloud', category: 'social', color: '#FF3300', keywords: ['саундклауд', 'треки', 'soundcloud'] },
  { id: 'brand:odnoklassniki', name: 'odnoklassniki', type: 'brand', label: 'Одноклассники', category: 'social', color: '#F58220', keywords: ['одноклассники', 'ок', 'ok', 'odnoklassniki'] },
  { id: 'brand:whatsapp', name: 'whatsapp', type: 'brand', label: 'WhatsApp', category: 'social', color: '#25D366', keywords: ['ватсап', 'вотсап', 'whatsapp', 'wa'] },
  { id: 'brand:viber', name: 'viber', type: 'brand', label: 'Viber', category: 'social', color: '#7360F2', keywords: ['вайбер', 'viber'] },
  { id: 'brand:snapchat', name: 'snapchat', type: 'brand', label: 'Snapchat', category: 'social', color: '#FFFC00', keywords: ['снапчат', 'snapchat'] },
  { id: 'brand:reddit', name: 'reddit', type: 'brand', label: 'Reddit', category: 'social', color: '#FF4500', keywords: ['реддит', 'reddit'] },
  { id: 'brand:pinterest', name: 'pinterest', type: 'brand', label: 'Pinterest', category: 'social', color: '#E60023', keywords: ['пинтерест', 'доски', 'pinterest'] },
  { id: 'brand:linkedin', name: 'linkedin', type: 'brand', label: 'LinkedIn', category: 'social', color: '#0A66C2', keywords: ['линкедин', 'linkedin'] },
  { id: 'brand:facebook', name: 'facebook', type: 'brand', label: 'Facebook', category: 'social', color: '#1877F2', keywords: ['фейсбук', 'facebook', 'fb'] },
  { id: 'brand:kwai', name: 'kwai', type: 'brand', label: 'Kwai', category: 'social', color: '#FF7E00', keywords: ['квай', 'квэй', 'kwai'] },
  { id: 'brand:medium', name: 'medium', type: 'brand', label: 'Medium', category: 'social', color: '#000000', keywords: ['медиум', 'medium'] }
];

// ─── LUCIDE SMM METRICS & ACTIVITY ICONS ──────────────────────────────────
export const METRIC_ICONS: IconDefinition[] = [
  { id: 'lucide:users', name: 'users', type: 'lucide', label: 'Подписчики / Аудитория', category: 'metric', keywords: ['подписчики', 'фолловеры', 'участники', 'люди', 'группа', 'канал', 'users', 'followers', 'members', 'audience'] },
  { id: 'lucide:user-plus', name: 'user-plus', type: 'lucide', label: 'Добавление подписчиков', category: 'metric', keywords: ['добавление', 'вступление', 'приглашение', 'прирост', 'user-plus', 'invite'] },
  { id: 'lucide:user-check', name: 'user-check', type: 'lucide', label: 'Живые пользователи', category: 'metric', keywords: ['живые', 'реальные', 'верифицированные', 'активные', 'user-check', 'real'] },
  { id: 'lucide:heart', name: 'heart', type: 'lucide', label: 'Лайки / Сердечки', category: 'metric', keywords: ['лайки', 'лайк', 'сердце', 'симпатии', 'нравится', 'heart', 'like', 'likes', 'love'] },
  { id: 'lucide:thumbs-up', name: 'thumbs-up', type: 'lucide', label: 'Классы / Одобрение', category: 'metric', keywords: ['классы', 'палец вверх', 'топ', 'thumbs-up', 'upvote'] },
  { id: 'lucide:eye', name: 'eye', type: 'lucide', label: 'Просмотры / Охваты', category: 'metric', keywords: ['просмотры', 'просмотр', 'глаз', 'охваты', 'показы', 'сторис', 'eye', 'views', 'impressions'] },
  { id: 'lucide:share-2', name: 'share-2', type: 'lucide', label: 'Репосты / Поделиться', category: 'metric', keywords: ['репосты', 'репост', 'поделиться', 'пересылка', 'share', 'repost', 'forward'] },
  { id: 'lucide:message-circle', name: 'message-circle', type: 'lucide', label: 'Комментарии / Отзывы', category: 'metric', keywords: ['комментарии', 'комменты', 'отзывы', 'сообщения', 'ответы', 'comments', 'comment', 'feedback'] },
  { id: 'lucide:message-square', name: 'message-square', type: 'lucide', label: 'Обсуждения / Чаты', category: 'metric', keywords: ['обсуждения', 'чат', 'беседа', 'диалог', 'chat', 'discussion'] },
  { id: 'lucide:flame', name: 'flame', type: 'lucide', label: 'Огонь / Тренды / Хит', category: 'metric', keywords: ['огонь', 'пламя', 'хит', 'тренды', 'жара', 'реакция огонь', 'fire', 'flame', 'trending', 'hot'] },
  { id: 'lucide:rocket', name: 'rocket', type: 'lucide', label: 'Бусты / Ракета / Ускорение', category: 'metric', keywords: ['бусты', 'буст', 'ракета', 'взлет', 'ускорение', 'boost', 'rocket', 'launch'] },
  { id: 'lucide:bar-chart-2', name: 'bar-chart-2', type: 'lucide', label: 'Опросы / Голоса', category: 'metric', keywords: ['опросы', 'голоса', 'голосование', 'статистика', 'диаграмма', 'poll', 'votes', 'chart'] },
  { id: 'lucide:clock', name: 'clock', type: 'lucide', label: 'Часы просмотров / Таймер', category: 'metric', keywords: ['часы', 'время', 'удержание', 'длительность', 'таймер', 'watch-hours', 'time', 'clock'] },
  { id: 'lucide:play', name: 'play', type: 'lucide', label: 'Воспроизведения / Видео', category: 'metric', keywords: ['видео', 'плей', 'проигрывание', 'клипы', 'шортс', 'play', 'video'] },
  { id: 'lucide:smile', name: 'smile', type: 'lucide', label: 'Реакции / Смайлики', category: 'metric', keywords: ['реакции', 'эмодзи', 'смайлы', 'позитив', 'smile', 'emoji', 'reactions'] },
  { id: 'lucide:star', name: 'star', type: 'lucide', label: 'Звезды / Избранное / Telegram Stars', category: 'metric', keywords: ['звезды', 'звезда', 'избранное', 'stars', 'favorite', 'tg stars'] }
];

// ─── LUCIDE SMM FEATURES & QUALITY TIERS (SERVICES) ───────────────────────
export const FEATURE_ICONS: IconDefinition[] = [
  { id: 'lucide:zap', name: 'zap', type: 'lucide', label: 'Мгновенный старт / Быстро', category: 'feature', keywords: ['быстрый', 'молния', 'мгновенно', 'скорость', 'моментально', 'flash', 'fast', 'instant', 'speed', 'zap'] },
  { id: 'lucide:shield-check', name: 'shield-check', type: 'lucide', label: 'Гарантия / Без списаний', category: 'feature', keywords: ['гарантия', 'защита', 'без списаний', 'надежно', 'безопасно', 'warranty', 'guarantee', 'safe', 'shield'] },
  { id: 'lucide:shield', name: 'shield', type: 'lucide', label: 'Базовая защита', category: 'feature', keywords: ['защита', 'щит', 'shield'] },
  { id: 'lucide:crown', name: 'crown', type: 'lucide', label: 'VIP / Премиум тариф', category: 'feature', keywords: ['премиум', 'вип', 'корона', 'лучший', 'элита', 'люкс', 'premium', 'vip', 'crown', 'elite'] },
  { id: 'lucide:sparkles', name: 'sparkles', type: 'lucide', label: 'Smart AI / Живые офферы', category: 'feature', keywords: ['ии', 'живые', 'умные', 'блеск', 'магия', 'sparkles', 'ai', 'smart', 'magic'] },
  { id: 'lucide:globe', name: 'globe', type: 'lucide', label: 'Весь мир / Worldwide / СНГ', category: 'feature', keywords: ['мир', 'глобус', 'весь мир', 'снг', 'интернациональный', 'globe', 'worldwide', 'global', 'cis'] },
  { id: 'lucide:map-pin', name: 'map-pin', type: 'lucide', label: 'Гео-таргетинг / РФ / Страны', category: 'feature', keywords: ['гео', 'таргетинг', 'россия', 'рф', 'страна', 'локация', 'geo', 'russia', 'target', 'map-pin'] },
  { id: 'lucide:bot', name: 'bot', type: 'lucide', label: 'Боты / Автоматизация', category: 'feature', keywords: ['боты', 'бот', 'автоматика', 'скрипт', 'bot', 'robot', 'automation'] },
  { id: 'lucide:trending-up', name: 'trending-up', type: 'lucide', label: 'Органический рост', category: 'feature', keywords: ['рост', 'органика', 'тренд', 'график', 'growth', 'trending-up', 'organic'] },
  { id: 'lucide:check-circle-2', name: 'check-circle-2', type: 'lucide', label: 'Проверенное качество', category: 'feature', keywords: ['проверено', 'галочка', 'надежно', 'качество', 'verified', 'check'] },
  { id: 'lucide:award', name: 'award', type: 'lucide', label: 'Награда / Топ выбор', category: 'feature', keywords: ['награда', 'топ', 'лучший', 'медаль', 'award', 'best'] },
  { id: 'lucide:refresh-cw', name: 'refresh-cw', type: 'lucide', label: 'Автодокрутка / Рефилл', category: 'feature', keywords: ['рефилл', 'автодокрутка', 'восстановление', 'повтор', 'refill', 'refresh', 'auto-refill'] },
  { id: 'lucide:tag', name: 'tag', type: 'lucide', label: 'Эконом / Скидки', category: 'feature', keywords: ['эконом', 'скидка', 'акция', 'дешево', 'бирка', 'discount', 'economy', 'cheap', 'tag'] },
  { id: 'lucide:gift', name: 'gift', type: 'lucide', label: 'Подарок / Бонус', category: 'feature', keywords: ['подарок', 'бонус', 'приз', 'gift', 'bonus'] },
  { id: 'lucide:cpu', name: 'cpu', type: 'lucide', label: 'Алгоритмы / Автопостинг', category: 'feature', keywords: ['алгоритм', 'процессор', 'чип', 'автопостинг', 'cpu', 'system'] },
  { id: 'lucide:lock', name: 'lock', type: 'lucide', label: 'Приватный / Закрытый', category: 'feature', keywords: ['замок', 'приватный', 'закрытый', 'секретный', 'lock', 'private'] }
];

export const ALL_ICONS: IconDefinition[] = [
  ...BRAND_ICONS,
  ...METRIC_ICONS,
  ...FEATURE_ICONS
];

export const ICONS_BY_ID = new Map<string, IconDefinition>(
  ALL_ICONS.map(icon => [icon.id, icon])
);

/**
 * Searches the icon registry with ranked query scoring (bilingual)
 */
export function searchIconRegistry(query: string, categoryFilter?: 'all' | 'social' | 'metric' | 'feature'): IconDefinition[] {
  const q = (query || '').trim().toLowerCase();
  
  let baseList = ALL_ICONS;
  if (categoryFilter && categoryFilter !== 'all') {
    baseList = baseList.filter(i => i.category === categoryFilter);
  }

  if (!q) return baseList;

  return baseList
    .map(icon => {
      let score = 0;
      if (icon.id.toLowerCase() === q || icon.name.toLowerCase() === q) score += 100;
      if (icon.label.toLowerCase().includes(q)) score += 50;
      if (icon.keywords.some(k => k === q)) score += 40;
      if (icon.keywords.some(k => k.includes(q))) score += 20;
      return { icon, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.icon);
}

/**
 * Automatically suggests top 3 matching icon descriptors based on entity name & context
 */
export function suggestIconsFromName(name: string, context?: 'network' | 'category' | 'service'): IconDefinition[] {
  if (!name || typeof name !== 'string') return [];
  const normalized = name.toLowerCase();

  // If network context
  if (context === 'network' || normalized.includes('telegram') || normalized.includes('вк') || normalized.includes('инста') || normalized.includes('ютуб')) {
    const brandMatches = BRAND_ICONS.filter(b => 
      b.keywords.some(k => normalized.includes(k)) || normalized.includes(b.name)
    );
    if (brandMatches.length > 0) return brandMatches.slice(0, 3);
  }

  // Keywords matcher
  const scored = ALL_ICONS.map(icon => {
    let score = 0;
    for (const kw of icon.keywords) {
      if (normalized.includes(kw)) {
        score += kw.length >= 4 ? 15 : 8;
      }
    }
    return { icon, score };
  })
  .filter(i => i.score > 0)
  .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    return scored.slice(0, 3).map(s => s.icon);
  }

  // Fallbacks by context
  if (context === 'category') {
    return [ICONS_BY_ID.get('lucide:users')!, ICONS_BY_ID.get('lucide:heart')!, ICONS_BY_ID.get('lucide:eye')!].filter(Boolean);
  }

  if (context === 'service') {
    return [ICONS_BY_ID.get('lucide:zap')!, ICONS_BY_ID.get('lucide:shield-check')!, ICONS_BY_ID.get('lucide:crown')!].filter(Boolean);
  }

  return [ICONS_BY_ID.get('brand:telegram')!, ICONS_BY_ID.get('lucide:zap')!, ICONS_BY_ID.get('lucide:shield-check')!].filter(Boolean);
}
