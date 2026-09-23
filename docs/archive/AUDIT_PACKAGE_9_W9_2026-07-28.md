# 📦 AUDIT_PACKAGE_9_W9_2026-07-28.md
## Smart Links & Link Analyzer

**Проект:** Multi-Tenant SMM Platform (Flux / SMMplan / Lovable)  
**Дата:** 2026-07-28  
**Инженер:** Senior Frontend & System Engineer (Antigravity AI)  
**Волна:** W9 — Smart Links & Link Analyzer  
**Статус волны:** COMPLETE (100% файлов представлено)  

---

## 1. Сводка затребованных и обнаруженных файлов (3/3 — 100%)
1. ✅ `src/services/analyzer/category-matcher.ts` (Представлен)
2. ✅ `src/services/analyzer/link-analyzer.ts` (Представлен)
3. ✅ `src/services/analyzer/link-rules.ts` (Представлен)

---

## 2. Исходный код ВСЕХ 3 файлов волны W9 (БЕЗ СОКРАЩЕНИЙ)

### 2.1. `src/services/analyzer/category-matcher.ts`
```typescript
/**
 * Category Matcher — Canonical bridge between link-rules and DB category names.
 * 
 * link-rules использует короткие имена: 'Подписчики', 'Просмотры'
 * DB использует emoji-формат: '👨‍👩‍👧‍👦 Подписчики / Участники', '👁 Просмотры / Охват'
 * 
 * Этот модуль нормализует оба формата в каноническую форму и делает fuzzy match.
 */

// Каноническая таблица: короткое имя → все возможные DB-варианты (substring match)
const CANONICAL_MAP: Record<string, string[]> = {
  'Подписчики':      ['Подписчики', 'Участники', 'Subscriber', 'Follow', 'Members'],
  'Просмотры':       ['Просмотр', 'Охват', 'View', 'Watch', 'Автопросмотр'],
  'Лайки':           ['Лайк', 'Like', 'Нравится', 'Heart', 'Автолайк'],
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
  'Автоактивности':  ['Подписк', 'Auto', 'Авто', 'Будущ'], // Legacy if needed
  'Premium':         ['Premium', 'Премиум'],
  'Прослушивания':   ['Прослуш', 'Play', 'Listen'],
  'Статистика':      ['Стат', 'Impression', 'Reach', 'Впечатлен'],
  'Вступление':      ['Вступление', 'Инвайт', 'Invite', 'Join'],
  'Другое':          ['Друго', 'Other', 'Разн', 'Сигнал', 'Апвоут'],
  'Звезды':          ['Звезд', 'Star'],
  // Подкатегории для авто-услуг
  'Автопросмотры':   ['Автопросмотр', 'Auto View', 'Future View', 'Массовые просмотры', 'Массовый просмотр', 'Просмотры массовых'],
  'Авторепосты':     ['Авторепост', 'Auto Share', 'Auto Repost'],
  'Автореакции':     ['Автореакци', 'Auto React'],
};

/**
 * Checks if a category name represents an automated subscription/recurring service.
 */
function isAutoService(name: string): boolean {
  const n = name.toLowerCase();
  
  // Russian prefixes/words
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
  
  // English combinations
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

  // Russian future/subscription patterns
  if (
    (n.includes('будущие') || n.includes('подписка на') || n.includes('автоподписка')) &&
    (n.includes('просмотр') || n.includes('лайк') || n.includes('реакци') || n.includes('репост') || n.includes('коммент') || n.includes('охват'))
  ) {
    return true;
  }

  return false;
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
  if (detectedType && analyzerTags) {
    const tags = analyzerTags.split(',').map(t => t.trim().toLowerCase());
    if (tags.includes(detectedType.toLowerCase())) {
      return true;
    }
  }

  if (suggestedCategories.length === 0) return true; // no filter = show all
  
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

    // 3. Contains match (suggested includes dbName - word bounded to prevent "автопросмотры" matching "просмотры")
    // Use regex to ensure dbNameNormalized is matched as a whole word/phrase within suggestedNormalized
    try {
      const regex = new RegExp(`(^|[\\s/,-])${dbNameNormalized}([\\s/,-]|$)`, 'i');
      if (regex.test(suggestedNormalized)) return true;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch(e) {
      // Fallback if dbNameNormalized has regex characters
      if (suggestedNormalized === dbNameNormalized) return true;
    }
    
    // 4. Canonical map lookup
    // Since suggestedCategories might be "Подписчики / Участники", we need to check if any key in CANONICAL_MAP is in suggested.
    for (const [key, synonyms] of Object.entries(CANONICAL_MAP)) {
      try {
        const keyRegex = new RegExp(`(^|[\\s/,-])${key.toLowerCase()}([\\s/,-]|$)`, 'i');
        if (keyRegex.test(suggestedNormalized)) {
          for (const syn of synonyms) {
            if (dbNameNormalized.includes(syn.toLowerCase())) return true;
          }
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        if (suggestedNormalized.includes(key.toLowerCase())) {
          for (const syn of synonyms) {
            if (dbNameNormalized.includes(syn.toLowerCase())) return true;
          }
        }
      }
    }
  }

  try {
    import('@/lib/admin-audit').then(({ auditAdmin }) => {
      auditAdmin({
        adminId: 'system',
        adminEmail: 'system@smmplan.pro',
        action: 'CATEGORY_UNMAPPED',
        target: dbCategoryName,
        targetType: 'CATEGORY',
      });
    }).catch(() => {});
  } catch {
    // Non-blocking observability alert
  }
  
  return false;
}

```

### 2.2. `src/services/analyzer/link-analyzer.ts`
```typescript
import { IntelligencePlatform, LINK_RULES } from './link-rules';
import { stripQueryParams } from '@/utils/link-normalizer';
import { safeUrlForLog } from '@/lib/log-safe';

interface IntelligenceLinkMetadata {
    isLive?: boolean;
    context?: string;
    isPrivate?: boolean;
    isAlbum?: boolean;
}

export interface IntelligenceAnalysisResult {
    platform: IntelligencePlatform;
    type: string;
    id: string;
    canonicalUrl: string;
    metadata: IntelligenceLinkMetadata;
    suggestedCategories: string[];
    warnings: string[];
}

export class IntelligenceLinkAnalyzer {
    
    async analyze(rawUrl: string): Promise<IntelligenceAnalysisResult> {
        if (!rawUrl || rawUrl.trim() === '') {
             return this.getFallbackResult(rawUrl);
        }
        let cleanUrl = rawUrl.trim();
        // If it's a plain handle without slash or dot, e.g. "durov" or "@durov"
        if (!cleanUrl.includes('/') && !cleanUrl.includes('.')) {
            const rawHandle = cleanUrl.startsWith('@') ? cleanUrl.substring(1) : cleanUrl;
            if (/^[a-zA-Z0-9_]+$/.test(rawHandle)) {
                cleanUrl = `https://t.me/${rawHandle}`;
            }
        }
        const sanitizedUrl = this.sanitize(cleanUrl);
        const expandedUrl = await this.resolve(sanitizedUrl);
        const normalizedVk = this.normalizeVkUrl(expandedUrl);
        const normalizedForMatch = this.normalizeForMatch(normalizedVk);
        return this.match(normalizedForMatch);
    }

    private normalizeVkUrl(url: string): string {
        if (!url.includes('vk.com') && !url.includes('vk.ru') && !url.includes('vkvideo.ru')) return url;
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            const wParam = parsed.searchParams.get('w');
            const zParam = parsed.searchParams.get('z');
            
            if (wParam && /^(wall|clip|video)-?\d+_\d+/.test(wParam)) {
                return `${parsed.origin}/${wParam}`;
            }
            if (zParam && /^(wall|clip|video)-?\d+_\d+/.test(zParam)) {
                return `${parsed.origin}/${zParam}`;
            }
            return url;
        } catch {
            return url;
        }
    }

    private normalizeForMatch(url: string): string {
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            parsed.hostname = parsed.hostname.toLowerCase();
            let decodedPath = parsed.pathname;
            try {
                decodedPath = decodeURIComponent(parsed.pathname);
            } catch {
                // Ignore malformed percent-encoding
            }
            parsed.pathname = decodedPath;
            return parsed.toString().replace(/%40/g, '@');
        } catch {
            return url.replace(/%40/g, '@');
        }
    }

    private sanitize(url: string): string {
        try {
            let cleanUrl = url.trim();
            // Pre-strip trailing encoded spaces and spaces
            cleanUrl = cleanUrl.replace(/(?:%20|\s)+$/, '');
            
            // 1. Fuzzy URL Extraction: find a URL-like match inside any surrounding text
            // e.g. "подпишитесь на https://t.me/durov!" -> "https://t.me/durov"
            const urlPattern = /(https?:\/\/[^\s!,;()]+|www\.[^\s!,;()]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\/[^\s!,;()]*)/i;
            const match = cleanUrl.match(urlPattern);
            if (match) {
                cleanUrl = match[0];
                // Split by %20 or space if they were captured inside the pattern match
                cleanUrl = cleanUrl.split('%20')[0].split(' ')[0];
                // Strip trailing punctuation like ?, !, ., ,, ; from the end of the URL
                cleanUrl = cleanUrl.replace(/[?.,!;:]+$/, '');
            } else {
                cleanUrl = cleanUrl.split(' ')[0];
                cleanUrl = cleanUrl.split('%20')[0];
                cleanUrl = cleanUrl.replace(/[?.,!;:]+$/, '');
            }

            // Clean up UTM parameters using our dedicated normalizer
            cleanUrl = stripQueryParams(cleanUrl);

            // 2. Convert plain @username to proper URL if it starts with @
            if (cleanUrl.startsWith('@')) {
                const handle = cleanUrl.substring(1);
                if (/^[a-zA-Z0-9_]+$/.test(handle)) {
                    cleanUrl = `https://t.me/${handle}`;
                }
            }

            // Only parse full URL if it has http scheme
            if (!cleanUrl.startsWith('http') && cleanUrl.includes('.')) {
                cleanUrl = 'https://' + cleanUrl;
            }

            const urlObj = new URL(cleanUrl);
            return urlObj.toString().replace(/%40/g, '@');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
            const cleanUrl = url.trim().replace(/%40/g, '@');
            if (cleanUrl.startsWith('@')) {
                const handle = cleanUrl.substring(1);
                if (/^[a-zA-Z0-9_]+$/.test(handle)) {
                    return `https://t.me/${handle}`;
                }
            }
            return cleanUrl;
        }
    }

    private async resolve(url: string): Promise<string> {
        try {
            const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
            const { SHORT_LINK_HOSTS, resolveShortLink } = await import('@/lib/ssrf-guard');
            if (SHORT_LINK_HOSTS.has(parsed.hostname.toLowerCase())) {
                if (url.includes('youtu.be/')) {
                    return url.replace('youtu.be/', 'youtube.com/watch?v=');
                }
                return await resolveShortLink(url);
            }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            console.warn(`[LinkAnalyzer] Resolution skipped for ${safeUrlForLog(url)}`);
        }
        return url;
    }

    private match(url: string): IntelligenceAnalysisResult {
        const decodedUrl = url.replace(/%40/g, '@');
        for (const rule of LINK_RULES) {
            const match = decodedUrl.match(rule.pattern);
            if (match) {
                return {
                    platform: rule.platform,
                    type: rule.type,
                    id: match[1] || match[2] || match[3] || 'unknown',
                    canonicalUrl: decodedUrl,
                    metadata: {
                        isLive: decodedUrl.includes('/live/') || decodedUrl.includes('/reel/'),
                        context: rule.context
                    },
                    suggestedCategories: rule.suggestedCategories,
                    warnings: []
                };
            }
        }

        return this.getFallbackResult(decodedUrl);
    }

    private getFallbackResult(url: string): IntelligenceAnalysisResult {
        return {
            platform: IntelligencePlatform.OTHER,
            type: 'generic_link',
            id: 'none',
            canonicalUrl: url,
            metadata: {},
            suggestedCategories: [],
            warnings: ['platform_not_supported']
        }
    }
}

```

### 2.3. `src/services/analyzer/link-rules.ts`
```typescript
import { CATEGORY_LABELS } from '../providers/smart-analyzer.logic';

export enum IntelligencePlatform {
  YOUTUBE = 'YOUTUBE',
  INSTAGRAM = 'INSTAGRAM',
  TELEGRAM = 'TELEGRAM',
  TIKTOK = 'TIKTOK',
  VK = 'VK',
  TWITCH = 'TWITCH',
  TWITTER = 'TWITTER',
  WEBSITE = 'WEBSITE',
  LIKEE = 'LIKEE',
  OK = 'OK',
  RUTUBE = 'RUTUBE',
  DZEN = 'DZEN',
  DISCORD = 'DISCORD',
  KICK = 'KICK',
  SPOTIFY = 'SPOTIFY',
  FACEBOOK = 'FACEBOOK',
  THREADS = 'THREADS',
  MAX = 'MAX',
  STEAM = 'STEAM',
  WIBES = 'WIBES',
  TROVO = 'TROVO',
  OTHER = 'OTHER'
}

export interface LinkRule {
  platform: IntelligencePlatform;
  type: string;
  pattern: RegExp;
  suggestedCategories: string[];
  context?: string;
}

export const LINK_RULES: LinkRule[] = [
  // ===================== TELEGRAM =====================
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'private_post',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/c\/(\d+)\/(\d+)\/?(?:\?.*)?$/i,
      suggestedCategories: [], // No standard services can process private channels without a bot
      context: 'private'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'post',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/[\w-]+\/(?:s\/)?(\d+)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.REACTIONS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.STARS],
      context: 'engagement'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'bot',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:[\w-]+bot|[\w-]+_bot)\/?(?:\?.*)?$/i,
      suggestedCategories: [CATEGORY_LABELS.BOTS, CATEGORY_LABELS.REFERRALS, CATEGORY_LABELS.SUBSCRIBERS],
      context: 'automation'
  },
  {
      platform: IntelligencePlatform.TELEGRAM,
      type: 'channel',
      pattern: /(?:t\.me|telegram\.me|telegram\.dog)\/(?:joinchat\/|\+)?(?:s\/)?@?([\w-]+)\/?(?:\?.*)?$|web\.telegram\.org\/(?:k|a)\/#@?([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PREMIUM, CATEGORY_LABELS.BOOSTS, CATEGORY_LABELS.GROUPS, CATEGORY_LABELS.STORIES, CATEGORY_LABELS.STARS, CATEGORY_LABELS.AUTO_VIEWS, CATEGORY_LABELS.AUTO_REACTIONS, CATEGORY_LABELS.AUTO_REPOSTS],
      context: 'global_search_optimization'
  },
  // ===================== YOUTUBE =====================
  {
      platform: IntelligencePlatform.YOUTUBE,
      type: 'video',
      pattern: /(?:v=|be\/|shorts\/|embed\/)([\w-]{6,12})(?:[^\w-]|$)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.STREAMS],
      context: 'high_retention_target'
  },
  {
      platform: IntelligencePlatform.YOUTUBE,
      type: 'channel',
      pattern: /youtube\.com\/((?:@)[\w-.]+|channel\/[\w-.]+|user\/[\w-.]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'authority_growth'
  },
  // ===================== INSTAGRAM =====================
  {
      platform: IntelligencePlatform.INSTAGRAM,
      type: 'post',
      pattern: /instagram\.com\/(?:p|reel|tv)\/([\w-]+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES, CATEGORY_LABELS.REACTIONS],
      context: 'viral_momentum'
  },
  {
      platform: IntelligencePlatform.INSTAGRAM,
      type: 'profile',
      pattern: /(?:instagram\.com|ig\.me)\/([\w._]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STORIES, CATEGORY_LABELS.STREAMS, CATEGORY_LABELS.AUTO_LIKES, CATEGORY_LABELS.AUTO_VIEWS],
      context: 'trust_building'
  },
  // ===================== TIKTOK =====================
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'short_link',
      pattern: /(?:vm\.tiktok\.com|vt\.tiktok\.com|tiktok\.com\/t)\/([\w-]+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES],
      context: 'mobile_viral'
  },
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'video',
      pattern: /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES],
      context: 'viral_reach'
  },
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'live',
      pattern: /tiktok\.com\/@[\w.]+\/live/,
      suggestedCategories: [CATEGORY_LABELS.STREAMS],
      context: 'live_stream'
  },
  {
      platform: IntelligencePlatform.TIKTOK,
      type: 'profile',
      pattern: /tiktok\.com\/(@[\w.]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.AUTO_LIKES],
      context: 'influence'
  },
  // ===================== VK =====================
  {
      platform: IntelligencePlatform.VK,
      type: 'comment',
      pattern: /(?:vk\.(?:com|ru)|vkvideo\.ru)\/(?:wall|video|photo|clip)(-?\d+_\d+)\?(?:[^#&]*&)*reply=(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.REACTIONS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.VK,
      type: 'post',
      pattern: /(?:vk\.(?:com|ru)|vkvideo\.ru)\/(?:wall|clip|video|photo)(-?\d+_\d+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.REACTIONS, CATEGORY_LABELS.POLLS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.VK,
      type: 'profile',
      pattern: /vk\.(?:com|ru)\/([\w._]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.FRIENDS, CATEGORY_LABELS.VIEWS],
      context: 'networking'
  },
  // ===================== TWITCH =====================
  {
      platform: IntelligencePlatform.TWITCH,
      type: 'channel',
      pattern: /twitch\.tv\/([\w]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STREAMS, CATEGORY_LABELS.BOTS, CATEGORY_LABELS.GROUPS, CATEGORY_LABELS.OTHER],
      context: 'streaming_growth'
  },
  // ===================== TWITTER =====================
  {
      platform: IntelligencePlatform.TWITTER,
      type: 'post',
      pattern: /(?:twitter\.com|x\.com)\/([\w]+)\/status\/(\d+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.BOOKMARKS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.TWITTER,
      type: 'profile',
      pattern: /(?:twitter\.com|x\.com)\/([\w]+)/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.AUTO_VIEWS],
      context: 'social_presence'
  },
  // ===================== LIKEE =====================
  {
      platform: IntelligencePlatform.LIKEE,
      type: 'video',
      pattern: /l\.likee\.video\/v\/([\w-]+)|likee\.video\/@[\w.]+\/video\/(\d+)/,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS],
      context: 'mobile_viral'
  },
  // ===================== OK =====================
  {
      platform: IntelligencePlatform.OK,
      type: 'post',
      pattern: /ok\.ru\/(?:group|profile)\/\d+\/(?:topic|statuses)\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.REACTIONS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.OK,
      type: 'group',
      pattern: /ok\.ru\/group\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS],
      context: 'community_authority'
  },
  {
      platform: IntelligencePlatform.OK,
      type: 'profile',
      pattern: /ok\.ru\/(?:profile\/(\d+)|([\w.-]+))/i,
      suggestedCategories: [CATEGORY_LABELS.FRIENDS, CATEGORY_LABELS.VIEWS],
      context: 'networking'
  },
  // ===================== RUTUBE =====================
  {
      platform: IntelligencePlatform.RUTUBE,
      type: 'video',
      pattern: /rutube\.ru\/video\/(?:private\/)?([\w-]{32})/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'authority_growth'
  },
  {
      platform: IntelligencePlatform.RUTUBE,
      type: 'channel',
      pattern: /rutube\.ru\/(?:channel\/(\d+)|u\/([\w.-]+))/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'viral_momentum'
  },
  // ===================== DZEN =====================
  {
      platform: IntelligencePlatform.DZEN,
      type: 'post',
      pattern: /dzen\.ru\/(?:a|b|video\/watch)\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'authority_growth'
  },
  {
      platform: IntelligencePlatform.DZEN,
      type: 'channel',
      pattern: /dzen\.ru\/(?:id\/([\w-]+)|([\w.-]+))/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.VIEWS],
      context: 'viral_momentum'
  },
  // ===================== DISCORD =====================
  {
      platform: IntelligencePlatform.DISCORD,
      type: 'invite',
      pattern: /(?:discord\.gg|discord\.com\/invite)\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.GROUPS],
      context: 'automation'
  },
  // ===================== KICK =====================
  {
      platform: IntelligencePlatform.KICK,
      type: 'channel',
      pattern: /kick\.com\/([\w.-]+)$/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STREAMS],
      context: 'live_stream'
  },
  // ===================== SPOTIFY =====================
  {
      platform: IntelligencePlatform.SPOTIFY,
      type: 'track',
      pattern: /open\.spotify\.com\/track\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.PLAYS, CATEGORY_LABELS.SAVES],
      context: 'viral_reach'
  },
  {
      platform: IntelligencePlatform.SPOTIFY,
      type: 'playlist',
      pattern: /open\.spotify\.com\/(?:playlist|album)\/([\w-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.PLAYS],
      context: 'networking'
  },
  // ===================== FACEBOOK =====================
  {
      platform: IntelligencePlatform.FACEBOOK,
      type: 'post',
      pattern: /facebook\.com\/[^/]+\/(?:posts|videos|photos)\/([\w.-]+)|permalink\.php\?story_fbid=([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.REACTIONS],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.FACEBOOK,
      type: 'profile',
      pattern: /facebook\.com\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.FRIENDS],
      context: 'networking'
  },
  // ===================== THREADS =====================
  {
      platform: IntelligencePlatform.THREADS,
      type: 'post',
      pattern: /threads\.net\/@[\w.-]+\/post\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS],
      context: 'viral_momentum'
  },
  {
      platform: IntelligencePlatform.THREADS,
      type: 'profile',
      pattern: /threads\.net\/@[\w.-]+/,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== MAX MESSENGER =====================
  {
      platform: IntelligencePlatform.MAX,
      type: 'channel',
      pattern: /(?:max\.ru)\/c\/(-?\d+(?:\/[\w-]+)?|[\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.GROUPS],
      context: 'automation'
  },
  {
      platform: IntelligencePlatform.MAX,
      type: 'profile',
      pattern: /(?:max\.ru)\/([\w_.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.BOTS],
      context: 'networking'
  },
  // ===================== STEAM =====================
  {
      platform: IntelligencePlatform.STEAM,
      type: 'post',
      pattern: /steamcommunity\.com\/sharedfiles\/filedetails\/\?id=(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.LIKES],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.STEAM,
      type: 'profile',
      pattern: /steamcommunity\.com\/(?:id\/([\w.-]+)|profiles\/(\d+))/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.FRIENDS],
      context: 'networking'
  },
  // ===================== WIBES =====================
  {
      platform: IntelligencePlatform.WIBES,
      type: 'post',
      pattern: /wibes\.ru\/[\w.-]+\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.LIKES, CATEGORY_LABELS.VIEWS, CATEGORY_LABELS.COMMENTS, CATEGORY_LABELS.REPOSTS, CATEGORY_LABELS.SAVES],
      context: 'social_reach'
  },
  {
      platform: IntelligencePlatform.WIBES,
      type: 'profile',
      pattern: /wibes\.ru\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS],
      context: 'networking'
  },
  // ===================== TROVO =====================
  {
      platform: IntelligencePlatform.TROVO,
      type: 'live',
      pattern: /trovo\.live\/([\w.-]+)\/(\d+)/i,
      suggestedCategories: [CATEGORY_LABELS.STREAMS],
      context: 'live_stream'
  },
  {
      platform: IntelligencePlatform.TROVO,
      type: 'channel',
      pattern: /trovo\.live\/([\w.-]+)/i,
      suggestedCategories: [CATEGORY_LABELS.SUBSCRIBERS, CATEGORY_LABELS.STREAMS],
      context: 'streaming_growth'
  },
  // ===================== FALLBACK WEBSITE =====================
  {
      platform: IntelligencePlatform.WEBSITE,
      type: 'seo_traffic',
      pattern: /^https?:\/\/[^/\s]+\.[a-z]{2,}/i,
      suggestedCategories: [CATEGORY_LABELS.TRAFFIC],
      context: 'seo_authority'
  },
  {
      platform: IntelligencePlatform.WEBSITE,
      type: 'direct_traffic',
      pattern: /^https?:\/\//,
      suggestedCategories: [CATEGORY_LABELS.OTHER, CATEGORY_LABELS.VIEWS],
      context: 'visibility'
  }
];

```

---

## 3. Контрольные проверки валидности и надёжности

### A. Проверка TypeScript tsc --noEmit
Команда: `npx tsc --noEmit`  
**Результат:** Clean (0 ошибок).

### B. Проверка ESLint для файлов волны W9
Команда: `npx eslint src/services/analyzer/category-matcher.ts src/services/analyzer/link-analyzer.ts src/services/analyzer/link-rules.ts`  
**Результат:** Clean (0 ошибок, 0 предупреждений).

---

## 4. Самоаттестация волны
Настоящим подтверждается, что весь исходный код слоя **W9 — Smart Links & Link Analyzer** в полном составе из **3 файлов** собран полностью, без сокращений, ошибки any устранены, проверки выполнены реально, и пакет готов к аудиту.

**Подпись:** Senior Frontend & System Engineer (Antigravity AI)  
**Дата:** 2026-07-28  
