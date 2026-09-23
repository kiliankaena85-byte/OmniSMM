/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Pure Category detection module for SmartAnalyzer.
 */
import type { Platform } from './platform-detector.pure';

export type Category = string;

export const CATEGORIES = [
    'SUBSCRIBERS', 'GROUPS', 'LIKES', 'VIEWS', 'COMMENTS', 'REACTIONS', 'REPOSTS',
    'AUTO_VIEWS', 'AUTO_LIKES', 'AUTO_REACTIONS', 'AUTO_REPOSTS', 'AUTO_COMMENTS',
    'BOOSTS', 'POLLS', 'STORIES', 'BOTS', 'REFERRALS', 'FRIENDS', 'PLAYS', 'TRAFFIC',
    'DISLIKES', 'STARS', 'SAVES', 'COMPLAINTS', 'STREAMS', 'PREMIUM', 'RECOVER', 'OTHER'
];

export const CATEGORY_LABELS: Record<string, string> = {
    SUBSCRIBERS: 'Подписчики / Участники',
    GROUPS: 'Вступление в группы / чаты',
    LIKES: 'Лайки / Нравится',
    VIEWS: 'Просмотры / Охват',
    COMMENTS: 'Комментарии / Отзывы',
    REACTIONS: 'Реакции / Эмодзи',
    REPOSTS: 'Репосты / Поделиться',
    AUTO_VIEWS: 'Автопросмотры',
    AUTO_LIKES: 'Автолайки',
    AUTO_REACTIONS: 'Автореакции',
    AUTO_REPOSTS: 'Авторепосты',
    AUTO_COMMENTS: 'Автокомментарии',
    BOOSTS: 'Бусты (Telegram Levels)',
    POLLS: 'Голоса / Опросы',
    STORIES: 'Сториз / Истории',
    BOTS: 'Роботы / Боты',
    REFERRALS: 'Рефералы (Apps/Bots)',
    FRIENDS: 'Заявки в друзья',
    PLAYS: 'Прослушивания (Music)',
    TRAFFIC: 'Трафик / Посещения',
    DISLIKES: 'Дизлайки',
    STARS: 'Звезды (Telegram Stars)',
    SAVES: 'Сохранения / Saves',
    COMPLAINTS: 'Жалобы / Reports',
    STREAMS: 'Стримы',
    PREMIUM: 'Premium Подписчики',
    RECOVER: 'Восстановление / Докрутка',
    OTHER: 'Другое / Разное',
};

export const DEFAULT_CATEGORY_METRICS: Record<string, { startTime: string; speedText: string; warranty: number; qualityLabel: string }> = {
    VIEWS: { startTime: '5–15 мин', speedText: 'до 50k / день', warranty: 0, qualityLabel: 'Высокое' },
    AUTO_VIEWS: { startTime: 'Мгновенно', speedText: 'Высокая', warranty: 0, qualityLabel: 'Стандарт' },
    LIKES: { startTime: '10–30 мин', speedText: 'до 10k / день', warranty: 0, qualityLabel: 'Стандарт' },
    SUBSCRIBERS: { startTime: '0–2 часа', speedText: '1–5k / день', warranty: 30, qualityLabel: 'Реальные' },
    GROUPS: { startTime: '0–2 часа', speedText: '1–5k / день', warranty: 30, qualityLabel: 'Реальные' },
    COMMENTS: { startTime: '15–60 мин', speedText: 'Плавная', warranty: 0, qualityLabel: 'Живые' },
    REACTIONS: { startTime: '5–15 мин', speedText: 'Быстрая', warranty: 0, qualityLabel: 'Стандарт' },
    REPOSTS: { startTime: '10–30 мин', speedText: 'до 10k / день', warranty: 0, qualityLabel: 'Стандарт' },
    STORIES: { startTime: 'Мгновенно', speedText: 'до 20k / день', warranty: 0, qualityLabel: 'Стандарт' },
    BOOSTS: { startTime: '0–1 час', speedText: 'до 1k / день', warranty: 30, qualityLabel: 'Премиум' },
    OTHER: { startTime: '15–60 мин', speedText: 'Стандартная', warranty: 0, qualityLabel: 'Стандарт' },
};

export const CATEGORY_MAP: Record<string, string[]> = {
    SUBSCRIBERS: ['subscriber', 'member', 'follow', 'participant', 'reader', 'подписчики', 'подписчик', 'участники', 'участник', 'фолловер'],
    VIEWS: ['view', 'eye', 'watch', 'просмотр', 'гляделок', 'глаз', 'посещен', 'охват', 'стат', 'visit', 'reach', 'stat', 'impressions', 'hour', 'watch time', 'время просмотр', 'часы просмотр'],
    BOTS: ['bot', 'бот'],
    LIKES: ['like', 'fav', 'heart', 'лайк', 'сердечк', 'классы', 'мне нравится'],
    COMMENTS: ['comment', 'review', 'коммент', 'отзыв'],
    REACTIONS: ['reaction', 'emoji', 'реакци', 'эмодзи'],
    REPOSTS: ['repost', 'share', 'репост', 'поделиться'],
    POLLS: ['poll', 'vote', 'опрос', 'голос', 'викторин'],
    STORIES: ['story', 'stories', 'сторис', 'истори'],
    BOOSTS: ['boost', 'буст', 'level', 'уровень'],
    REFERRALS: ['referral', 'реферал'],
    FRIENDS: ['friend', 'друг', 'друзья'],
    RECOVER: ['recover', 'восстанов', 'refill', 'докрут'],
    TRAFFIC: ['traffic', 'website', 'трафик'],
    DISLIKES: ['dislike', 'дизлайк'],
    GROUPS: ['group', 'chat', 'channel', 'чат', 'группа', 'канал', 'сообщест', 'паблик'],
    PLAYS: ['play', 'слуш', 'прослуш'],
    STARS: ['star', 'звезд'],
    SAVES: ['save', 'сохранен', 'сохр', 'bookmark'],
    PREMIUM: ['premium', 'премиум'],
    STREAMS: ['viewer', 'stream', 'зрител', 'стрим', 'online', 'онлайн'],
    COMPLAINTS: ['жалоба', 'report', 'complaint', 'claim', 'насилие', 'спам', 'порнография', 'авторское право', 'фейк'],
    OTHER: []
};

export function detectCategory(nameNode: string, fullContent: string, platform: Platform): Category {
    let category: Category = 'OTHER';

    const isAutoMention = fullContent.includes('подписк') || fullContent.includes('auto') || fullContent.includes('subscription') || fullContent.includes('будущ') || fullContent.includes('авто');
    const isViewMention = fullContent.includes('просмотр') || fullContent.includes('view') || fullContent.includes('eye');
    const isLikeMention = fullContent.includes('лайк') || fullContent.includes('like') || fullContent.includes('heart');
    const isReactionMention = fullContent.includes('реакци') || fullContent.includes('reaction');
    const isRepostMention = fullContent.includes('репост') || fullContent.includes('share');
    const isCommentMention = fullContent.includes('коммент') || fullContent.includes('comment');
    const isPostModifier = fullContent.includes('пост') || fullContent.includes('запис') || fullContent.includes('публикац') || fullContent.includes('future') || nameNode.includes('авто');

    if (isAutoMention && (isViewMention || isLikeMention || isReactionMention || isRepostMention || isCommentMention) && isPostModifier) {
        if (isViewMention) category = 'AUTO_VIEWS';
        else if (isLikeMention) category = 'AUTO_LIKES';
        else if (isReactionMention) category = 'AUTO_REACTIONS';
        else if (isRepostMention) category = 'AUTO_REPOSTS';
        else if (isCommentMention) category = 'AUTO_COMMENTS';
    } else if ((nameNode.includes('бот') || nameNode.includes(' bot')) && !nameNode.includes('подпис') && !nameNode.includes('участник')) {
        category = 'BOTS';
    } else {
        let bestCatMatch: { category: Category; index: number } | null = null;
        for (const [c, keywords] of Object.entries(CATEGORY_MAP)) {
            for (const k of keywords) {
                const idx = fullContent.indexOf(k);
                if (idx !== -1) {
                    if (!bestCatMatch || idx < bestCatMatch.index) {
                        bestCatMatch = { category: c as Category, index: idx };
                    }
                }
            }
        }
        if (bestCatMatch) category = bestCatMatch.category;
    }

    // Platform-specific category refinements
    return refineCategoryByPlatform(category, nameNode, fullContent, platform);
}

function refineCategoryByPlatform(cat: Category, nameNode: string, fullContent: string, platform: Platform): Category {
    if (platform === 'VK') {
        if (fullContent.includes('в друзья') || fullContent.includes('на профиль')) return 'FRIENDS';
        if (fullContent.includes('групп') || fullContent.includes('сообщест')) return 'GROUPS';
        if (fullContent.includes('прослуш') || fullContent.includes('плейлист')) return 'PLAYS';
        if (fullContent.includes('глазик') || fullContent.includes('на запись')) return 'VIEWS';
        if (fullContent.includes('опрос') || fullContent.includes('голос')) return 'POLLS';
    } else if (platform === 'FACEBOOK') {
        if (fullContent.includes('group') || fullContent.includes('групп')) return 'SUBSCRIBERS';
        if (fullContent.includes('reel') || fullContent.includes('video')) return 'VIEWS';
    } else if (platform === 'TELEGRAM') {
        return refineTelegramCategory(nameNode, fullContent);
    } else if (platform === 'YOUTUBE') {
        if ((fullContent.includes('час') && !fullContent.includes('участник')) || fullContent.includes('hour')) return 'VIEWS';
        if (fullContent.includes('short')) return 'VIEWS';
        if (nameNode.includes('лайк') || nameNode.includes('like')) return 'LIKES';
    } else if (platform === 'DZEN') {
        if (fullContent.includes('стать') || fullContent.includes('article')) return 'VIEWS';
    } else if (platform === 'INSTAGRAM') {
        if (nameNode.includes('story') || nameNode.includes('сторис')) return 'STORIES';
        if (/подписч|follow/i.test(nameNode)) return 'SUBSCRIBERS';
        if (nameNode.includes('лайк') || nameNode.includes('like')) return 'LIKES';
        if (nameNode.includes(' reels') || nameNode.includes('просмотр') || nameNode.includes('view')) return 'VIEWS';
    }
    return cat;
}

function refineTelegramCategory(nameNode: string, fullContent: string): Category {
    const vIdx = nameNode.indexOf('просмотр');
    const vIdx2 = nameNode.indexOf('view');
    const rIdx = nameNode.indexOf('реакци');
    const rIdx2 = nameNode.indexOf('reaction');
    const minV = Math.min(vIdx === -1 ? Infinity : vIdx, vIdx2 === -1 ? Infinity : vIdx2);
    const minR = Math.min(rIdx === -1 ? Infinity : rIdx, rIdx2 === -1 ? Infinity : rIdx2);
    const isReactionsPrimary = minR < minV;

    const isStory = nameNode.includes('истори') || nameNode.includes('story');
    const isAutoViews = !isReactionsPrimary && (nameNode.includes('подписк') || nameNode.includes('auto') || nameNode.includes('авто')) && (nameNode.includes('просмотр') || nameNode.includes('view') || nameNode.includes('глаз'));
    const isSubscribers = (/подписч|member|follower|читател|фолловер/i.test(nameNode) || (nameNode.includes('участник') && !nameNode.includes('опрос') && !nameNode.includes('голос'))) && !isAutoViews;
    const isBoost = (nameNode.includes('boost') || nameNode.includes('буст') || fullContent.includes('голос для буст') || fullContent.includes('голоса для буст')) && !isSubscribers;
    const isStars = (fullContent.includes('stars') || nameNode.includes('звезд') || nameNode.includes('star')) && !isSubscribers;

    if (isStars) return 'STARS';
    if (fullContent.includes('жалоба') || fullContent.includes('report')) return 'COMPLAINTS';
    if (isBoost) return 'BOOSTS';
    if (isStory) return 'STORIES';
    if (isAutoViews) return 'AUTO_VIEWS';
    if (isSubscribers) return 'SUBSCRIBERS';
    if (nameNode.includes('реакци') || nameNode.includes('reaction')) {
        return minV < minR ? 'VIEWS' : 'REACTIONS';
    }
    if (nameNode.includes('просмотр') || nameNode.includes('view') || nameNode.includes('глаз') || nameNode.includes('гляделок')) {
        return 'VIEWS';
    }
    return 'OTHER';
}
