/**
 * Category Matcher — Canonical bridge between link-rules and DB category names.
 * 
 * link-rules использует короткие имена: 'Подписчики', 'Просмотры'
 * DB использует emoji-формат: '👨‍👩‍👧‍👦 Подписчики / Участники', '👁 Просмотры / Охват'
 * 
 * Этот модуль нормализует оба формата в каноническую форму и делает fuzzy match.
 */

import { normalizeTargetType, isTargetTypeCompatible, inferTargetTypeFromCategory, isHybridViewCategory } from '@/utils/target-type';

// Каноническая таблица: короткое имя → все возможные DB-варианты (substring match)
const CANONICAL_MAP: Record<string, string[]> = {
  'Подписчики':      ['Подписчики', 'Участники', 'Subscriber', 'Follow', 'Members'],
  'Просмотры':       ['Просмотр', 'Охват', 'View', 'Watch'],
  'Лайки':           ['Лайк', 'Like', 'Нравится', 'Heart'],
  'Комментарии':     ['Коммент', 'Comment', 'Отзыв', 'Review'],
  'Реакции':         ['Реакци', 'Reaction', 'Emoji', 'Эмоции'],
  'Репосты':         ['Репост', 'Repost', 'Share', 'Поделиться'],
  'Бусты':           ['Буст', 'Boost', 'Level'],
  'Голосования':     ['Голос', 'Опрос', 'Poll', 'Vote'],
  'Сториз':          ['Стори', 'Story', 'Истори'],
  'Боты':            ['Бот', 'Bot', 'Робот'],
  'Стримы':          ['Стрим', 'Stream', 'Зрител', 'Эфир', 'Viewer', 'Live'],
  'Сохранения':      ['Сохранен', 'Save', 'Bookmark', 'Закладк'],
  'Трафик':          ['Трафик', 'Traffic', 'Посещен', 'Organic', 'Keyword'],
  'Жалобы':          ['Жалоб', 'Report', 'Complaint', 'Репорт'],
  'Автоактивности':  ['Подписк', 'Auto', 'Авто', 'Будущ'],
  'Premium':         ['Premium', 'Премиум'],
  'Прослушивания':   ['Прослуш', 'Play', 'Listen'],
  'Статистика':      ['Стат', 'Impression', 'Reach', 'Впечатлен'],
  'Вступление':      ['Вступление', 'Инвайт', 'Invite', 'Join'],
  'Другое':          ['Друго', 'Other', 'Разн', 'Сигнал', 'Апвоут'],
  'Звезды':          ['Звезд', 'Star'],
  // Подкатегории для авто-услуг
  'Автопросмотры':   ['Автопросмотр', 'Auto View', 'Future View', 'Массовые просмотры', 'Массовый просмотр', 'Просмотры массовых', 'Просмотры на будущие', 'Просмотры на новые', 'Просмотры на последние'],
  'Автолайки':       ['Автолайк', 'Auto Like', 'Future Like', 'Лайки на будущие', 'Лайки на новые'],
  'Авторепосты':     ['Авторепост', 'Auto Share', 'Auto Repost', 'Репосты на будущие', 'Репосты на новые'],
  'Автореакции':     ['Автореакци', 'Auto React', 'Future React', 'Реакции на будущие', 'Реакции на новые'],
};

/**
 * Checks if a category name represents an automated subscription/recurring service.
 */
function isAutoService(name: string): boolean {
  const n = name.toLowerCase();
  
  if (
    n.includes('автопросмотр') ||
    n.includes('автолайк') ||
    n.includes('автореакци') ||
    n.includes('авторепост') ||
    n.includes('автокоммент') ||
    n.includes('автоактивно') ||
    n.includes('автопрослуш') ||
    n.includes('автоопрос') ||
    n.includes('автоголос')
  ) {
    return true;
  }
  
  if (
    n.includes('auto view') ||
    n.includes('auto-view') ||
    n.includes('auto like') ||
    n.includes('auto-like') ||
    n.includes('auto react') ||
    n.includes('auto-react') ||
    n.includes('auto share') ||
    n.includes('auto-share') ||
    n.includes('auto repost') ||
    n.includes('auto-repost') ||
    n.includes('auto comment') ||
    n.includes('auto-comment') ||
    n.includes('future view') ||
    n.includes('future-view') ||
    n.includes('future like') ||
    n.includes('future-like') ||
    n.includes('future react') ||
    n.includes('future-react') ||
    n.includes('future share') ||
    n.includes('future-share') ||
    n.includes('future repost') ||
    n.includes('future-repost') ||
    n.includes('future comment') ||
    n.includes('future-comment')
  ) {
    return true;
  }

  if (
    (n.includes('будущие') || n.includes('подписка на') || n.includes('автоподписка')) &&
    (n.includes('просмотр') || n.includes('лайк') || n.includes('реакци') || n.includes('репост') || n.includes('коммент') || n.includes('охват'))
  ) {
    return true;
  }

  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface PrecompiledCanonical {
  key: string;
  regex: RegExp;
  synonymsLower: string[];
}

const PRECOMPILED_CANONICAL_MAP: PrecompiledCanonical[] = Object.entries(CANONICAL_MAP).map(
  ([key, synonyms]) => ({
    key: key.toLowerCase(),
    regex: new RegExp('(^|[\\s/,-])' + escapeRegex(key.toLowerCase()) + '([\\s/,-]|$)', 'i'),
    synonymsLower: synonyms.map((s) => s.toLowerCase()),
  })
);

// LRU cache for dynamic category regexes (O(1) fast lookup, avoids allocating RegExp in hot-loop)
const DYNAMIC_REGEX_CACHE = new Map<string, RegExp>();
const MAX_DYNAMIC_REGEX_CACHE = 500;

function getCachedDynamicRegex(escapedTerm: string): RegExp {
  let re = DYNAMIC_REGEX_CACHE.get(escapedTerm);
  if (!re) {
    if (DYNAMIC_REGEX_CACHE.size >= MAX_DYNAMIC_REGEX_CACHE) {
      const oldestKey = DYNAMIC_REGEX_CACHE.keys().next().value;
      if (oldestKey) DYNAMIC_REGEX_CACHE.delete(oldestKey);
    }
    re = new RegExp('(^|[\\s/,-])' + escapedTerm + '([\\s/,-]|$)', 'i');
    DYNAMIC_REGEX_CACHE.set(escapedTerm, re);
  }
  return re;
}

/**
 * Matches a database category string like '👨‍👩‍👧‍👦 Подписчики / Участники'
 * against an array of suggested short categories like ['Подписчики', 'Автоактивности']
 */
export function matchesSuggestedCategory(
  dbCategoryName: string, 
  suggestedCategories: string[],
  analyzerTags?: string | null,
  detectedType?: string | null
): boolean {
  // 1. Enforce Link Target Compatibility if detectedType is provided
  if (detectedType) {
    const categoryTargetType = inferTargetTypeFromCategory(dbCategoryName);
    if (!isTargetTypeCompatible(detectedType, categoryTargetType)) {
      if (analyzerTags) {
        const tags = analyzerTags.split(',').map(t => t.trim().toLowerCase());
        const normalized = normalizeTargetType(detectedType).toLowerCase();
        if (!tags.includes(normalized) && !tags.includes(detectedType.toLowerCase())) {
          return false;
        }
      } else {
        return false;
      }
    }
  }

  if (detectedType && analyzerTags) {
    const tags = analyzerTags.split(',').map(t => t.trim().toLowerCase());
    const normalized = normalizeTargetType(detectedType).toLowerCase();
    if (tags.includes(normalized) || tags.includes(detectedType.toLowerCase())) {
      return true;
    }
  }

  if (!suggestedCategories || suggestedCategories.length === 0) return true; // no filter = show all
  
  // Special Handling for Hybrid View Categories (e.g. "👁️ Просмотры и охваты постов"):
  // In modern catalogs, views/reach categories host both single post views and channel auto-views / package reach.
  // If the suggested list contains ANY views/reach or auto-views keyword, match this category!
  if (isHybridViewCategory(dbCategoryName)) {
    const hasViewOrAutoView = suggestedCategories.some(s => {
      const sn = s.toLowerCase();
      return sn.includes('просмотр') || sn.includes('view') || sn.includes('охват');
    });
    if (hasViewOrAutoView) {
      return true;
    }
  }

  const dbIsAuto = isAutoService(dbCategoryName);
  
  const dbNameNormalized = dbCategoryName.toLowerCase()
    .replace(/[^\p{L}\p{N}\s/]/gu, '') // Strip emoji
    .trim();
  
  for (const suggested of suggestedCategories) {
    const suggestedIsAuto = isAutoService(suggested);
    
    // Mismatch guard: prevent regular targets (like single posts) matching automated monitoring categories
    if (dbIsAuto !== suggestedIsAuto) {
      continue;
    }

    const suggestedNormalized = suggested.toLowerCase()
      .replace(/[^\p{L}\p{N}\s/]/gu, '')
      .trim();

    // 1. Exact match (unlikely but fast path)
    if (dbCategoryName === suggested) return true;
    
    // 2. Contains match (dbName includes suggested)
    if (dbNameNormalized.includes(suggestedNormalized)) return true;

    // 3. Contains match (suggested includes dbName)
    try {
      const escaped = escapeRegex(dbNameNormalized);
      const regex = getCachedDynamicRegex(escaped);
      if (regex.test(suggestedNormalized)) return true;
    } catch {
      if (suggestedNormalized === dbNameNormalized) return true;
    }
    
    // 4. Canonical map lookup (O(1) precompiled regexes)
    for (const item of PRECOMPILED_CANONICAL_MAP) {
      if (item.regex.test(suggestedNormalized) || suggestedNormalized.includes(item.key)) {
        for (const syn of item.synonymsLower) {
          if (dbNameNormalized.includes(syn)) return true;
        }
      }
    }
  }

  return false;
}
