/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Created by Artem (http://artmspektr.ru)
 * Unauthorized copying of this file is strictly prohibited.
 */
export type Platform = string;
export type Category = string;
import { DescriptionSanitizer } from '@/utils/description-sanitizer';

export interface ProcurementMetrics {
    quality: 'PREMIUM' | 'HIGH' | 'MEDIUM' | 'LOW' | 'BOTS' | 'UNKNOWN';
    velocity: number | null; // Max items per day
    geo: string;
    dropRate: number | null; // e.g. 5 for 5%
    hasRefill: boolean;
    anomalyScore: number;
    startTime?: string;
    speedText?: string;
    warrantyDays?: number;
    qualityLabel?: string;
}

export interface AnalyzedService {
    platform: Platform;
    platformSlug: string;
    category: Category;
    targetType: string;
    isPrivate: boolean;
    description_ru: string;
    suggestedName?: string;
    requirements?: string;
    geo?: string;
    warranty?: number;
    startTime?: string;
    speedText?: string;
    qualityLabel?: string;
        metrics?: ProcurementMetrics;
    cleanName?: string;
    customDataType?: 'NONE' | 'TEXTAREA' | 'NUMBER';
    isMediaGroupAware?: boolean;
}

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PLATFORMS = ['TELEGRAM', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'VK', 'TWITCH', 'DISCORD', 'TWITTER', 'FACEBOOK', 'THREADS', 'REDDIT', 'RUTUBE', 'DZEN', 'MUSIC', 'OK', 'KICK', 'LIKEE', 'WHATSAPP', 'SPOTIFY', 'SOUNDCLOUD', 'LINKEDIN', 'PINTEREST', 'SNAPCHAT', 'TROVO', 'KWAI', 'MAX', 'GOOGLE', 'APPLE', 'YANDEX', 'STEAM', 'WIBES', 'RUMBLE', 'TUMBLR', 'VIMEO', 'SHAZAM', 'QUORA', 'MEDIUM', 'WEBSITE', 'PERISCOPE', 'CLOUDHUB', 'AUDIOMACK', 'DATPIFF', 'OTHER'];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CATEGORIES = ['SUBSCRIBERS', 'GROUPS', 'LIKES', 'VIEWS', 'COMMENTS', 'REACTIONS', 'REPOSTS', 'AUTO_VIEWS', 'AUTO_LIKES', 'AUTO_REACTIONS', 'AUTO_REPOSTS', 'AUTO_COMMENTS', 'BOOSTS', 'POLLS', 'STORIES', 'BOTS', 'REFERRALS', 'FRIENDS', 'PLAYS', 'TRAFFIC', 'DISLIKES', 'STARS', 'SAVES', 'COMPLAINTS', 'STREAMS', 'PREMIUM', 'RECOVER', 'OTHER'];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TARGET_TYPES = ['CHANNEL', 'POST', 'PROFILE', 'VIDEO', 'VK_VIDEO', 'VK_CLIP', 'VK_PLAY', 'CHANNEL_POSTS', 'STORY', 'COMMENTS', 'POLL', 'PHOTO', 'MARKET', 'PLAYLIST', 'ALBUM', 'EXTERNAL', 'CUSTOM'];

const PLATFORM_LABELS: Record<string, string> = {
    TELEGRAM: 'Telegram',
    INSTAGRAM: 'Instagram',
    TIKTOK: 'TikTok',
    YOUTUBE: 'YouTube',
    VK: 'ВКонтакте',
    TWITCH: 'Twitch',
    DISCORD: 'Discord',
    TWITTER: 'Twitter (X)',
    FACEBOOK: 'Facebook',
    THREADS: 'Threads',
    REDDIT: 'Reddit',
    RUTUBE: 'Rutube',
    DZEN: 'Дзен',
    MUSIC: 'Музыка (Spotify/Apple)',
    OK: 'Одноклассники',
    KICK: 'Kick',
    LIKEE: 'Likee',
    WHATSAPP: 'WhatsApp',
    SPOTIFY: 'Spotify',
    SOUNDCLOUD: 'SoundCloud',
    LINKEDIN: 'LinkedIn',
    PINTEREST: 'Pinterest',
    SNAPCHAT: 'Snapchat',
    TROVO: 'Trovo',
    KWAI: 'Kwai',
    MAX: 'Max Messenger',
    GOOGLE: 'Google',
    APPLE: 'Apple Music/Podcast',
    YANDEX: 'Яндекс (Дзен/Maps/Music)',
    STEAM: 'Steam',
    WIBES: 'Wibes',
    RUMBLE: 'Rumble',
    TUMBLR: 'Tumblr',
    VIMEO: 'Vimeo',
    SHAZAM: 'Shazam',
    QUORA: 'Quora',
    MEDIUM: 'Medium',
    WEBSITE: 'Website Traffic',
    PERISCOPE: 'Periscope',
    CLOUDHUB: 'CloudHub',
    AUDIOMACK: 'Audiomack',
    DATPIFF: 'DatPiff',
    OTHER: 'Другое',
};

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TARGET_TYPE_LABELS: Record<string, string> = {
    CHANNEL: 'Канал/Группа',
    POST: 'Пост/Публикация',
    PROFILE: 'Профиль/Аккаунт',
    VIDEO: 'Видео/Reels',
    VK_VIDEO: 'VK Видео',
    VK_CLIP: 'VK Клип',
    VK_PLAY: 'VK Play Стрим',
    CHANNEL_POSTS: 'Посты канала (Авто)',
    STORY: 'Сторис',
    COMMENTS: 'Комментарии',
    POLL: 'Опрос',
    PHOTO: 'Фото',
    MARKET: 'Товар/Маркет',
    PLAYLIST: 'Плейлист',
    ALBUM: 'Альбом',
    EXTERNAL: 'Внешняя ссылка',
    CUSTOM: 'Свой тип (API)',
};

const PLATFORM_KEYWORDS: Record<string, string[]> = {
    TELEGRAM: ['telegram', 'tg', 'телеграм', 'тг', 'запуск бота', 'рефералы'],
    INSTAGRAM: ['instagram', 'inst', 'инстаграм', 'инста'],
    VK: ['vk', 'вк', 'vkontakte', 'вконтакте'],
    YOUTUBE: ['youtube', 'yt', 'ютуб'],
    TIKTOK: ['tiktok', 'тикток', 'тт'],
    FACEBOOK: ['facebook', 'фейсбук'],
    TWITTER: ['twitter', 'x.com', 'твиттер'],
    DISCORD: ['discord', 'дискорд'],
    THREADS: ['threads'],
    REDDIT: ['reddit'],
    TWITCH: ['twitch', 'твич'],
    KICK: ['kick'],
    RUTUBE: ['rutube', 'рутуб'],
    DZEN: ['dzen', 'дзен'],
    MUSIC: ['music', 'музыка'],
    OK: ['ok', 'одноклассники', 'ок'],
    LIKEE: ['likee'],
    WHATSAPP: ['whatsapp', 'ватсап'],
    SPOTIFY: ['spotify', 'спотифай'],
    SOUNDCLOUD: ['soundcloud'],
    LINKEDIN: ['linkedin'],
    PINTEREST: ['pinterest'],
    SNAPCHAT: ['snapchat'],
    TROVO: ['trovo'],
    KWAI: ['kwai'],
    MAX: ['messenger', 'max', 'макс'],
    GOOGLE: ['google', 'гугл', 'gmap', 'review', 'отзыв'],
    APPLE: ['apple', 'podcast', 'itunes'],
    YANDEX: ['yandex', 'яндекс', 'ya.ru'],
    STEAM: ['steam', 'стим'],
    WIBES: ['wibes', 'вайбс'],
    RUMBLE: ['rumble'],
    TUMBLR: ['tumblr'],
    VIMEO: ['vimeo'],
    SHAZAM: ['shazam'],
    QUORA: ['quora'],
    MEDIUM: ['medium'],
    WEBSITE: ['website', 'traffic', 'трафик', 'site', 'сайт'],
    PERISCOPE: ['periscope'],
    CLOUDHUB: ['cloudhub'],
    AUDIOMACK: ['audiomack'],
    DATPIFF: ['datpiff'],
    OTHER: []
};

const CATEGORY_MAP: Record<string, string[]> = {
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

import { GEO_MAP } from '@/constants/geo-registry';
import { NameTokenizerService } from './name-tokenizer.service';
import { compileServiceMetrics, normalizeGeo } from '@/utils/translation-dictionary';

export const SmartAnalyzerLogic = class {
    static detectSync(name: string, description: string = '', categoryInput: string = '', dynamicPlatforms?: Array<{ slug: string, keywords: string[], name: string }>, basePriceUsd: number = 0): AnalyzedService {
        const sanitizedDescription = DescriptionSanitizer.sanitize(description);
        const nameNode = name.toLowerCase();
        
        // Tokenize Name
        const tokenized = NameTokenizerService.tokenize(name, categoryInput);
        const safeCategoryInput = String(categoryInput || '');
        const catInputLower = safeCategoryInput.toLowerCase();
        const fullContent = (name + ' ' + sanitizedDescription + ' ' + safeCategoryInput).toLowerCase();

        // 0. Detect Geo & Warranty (with Strict Anti-Contradiction Negative Guard)
        let geo = 'WORLDWIDE';
        for (const [code, keywords] of Object.entries(GEO_MAP)) {
            if (keywords.some(k => fullContent.includes(k))) {
                geo = code;
                break;
            }
        }

        const isExplicitNoWarranty =
            fullContent.includes('без гарантии') ||
            fullContent.includes('без гарантий') ||
            fullContent.includes('без автодокрутки') ||
            fullContent.includes('no refill') ||
            fullContent.includes('no-refill') ||
            fullContent.includes('norefill') ||
            /\b0\s*(?:d|day|days)\s*refill/i.test(fullContent) ||
            /\bnon[\s-]refill/i.test(fullContent) ||
            fullContent.includes('no warranty') ||
            fullContent.includes('without warranty') ||
            fullContent.includes('no drop guarantee') ||
            fullContent.includes('no drop protection') ||
            fullContent.includes('без восстановления');

        let warranty = 0;
        if (!isExplicitNoWarranty) {
            const warrantyMatch = name.match(/(\d+)\s*(?:дней|дня|день|day|d|days)/i);
            if (warrantyMatch) {
                warranty = parseInt(warrantyMatch[1], 10);
            } else if (fullContent.includes('♻️') || fullContent.includes('с гарантией') || fullContent.includes('гарантия') || fullContent.includes('гарантией')) {
                warranty = 30; // Default warranty if icon present or positive guarantee text
            }
        }

        // 1. Detect Platform
        let platformEnum: Platform = 'OTHER';
        let platformSlug: string = 'other';

        // Weight-based platform detection
        const platformScores: Record<string, number> = {};
        for (const [p, keywords] of Object.entries(PLATFORM_KEYWORDS)) {
            platformScores[p] = 0;
            for (const k of keywords) {
                const isShort = k.length <= 2;
                const match = (text: string, key: string) => {
                    if (isShort) {
                        const rex = new RegExp(`\\b${key}\\b`, 'i');
                        return rex.test(text);
                    }
                    return text.includes(key);
                };

                if (match(catInputLower, k)) platformScores[p] += 10;
                if (match(nameNode, k)) platformScores[p] += 5;
                if (match(sanitizedDescription.toLowerCase(), k)) platformScores[p] += 1;
            }
        }

        let bestPlatformCode = 'OTHER';
        let maxPlatformScore = 0;
        for (const [p, score] of Object.entries(platformScores)) {
            if (score > maxPlatformScore) {
                maxPlatformScore = score;
                bestPlatformCode = p;
            }
        }

        if (bestPlatformCode !== 'OTHER') {
            platformEnum = bestPlatformCode as Platform;
            platformSlug = bestPlatformCode.toLowerCase();
        }

        // Override with dynamic if match found
        if (dynamicPlatforms && dynamicPlatforms.length > 0) {
            for (const p of dynamicPlatforms) {
                if (p.keywords.some(k => fullContent.includes(k.toLowerCase()))) {
                    platformSlug = p.slug.toLowerCase();
                    const upperSlug = p.slug.toUpperCase();
                    if (Object.keys(PLATFORM_KEYWORDS).includes(upperSlug)) {
                        platformEnum = upperSlug as Platform;
                    }
                    break;
                }
            }
        }

        // 2. Detect Category
        let category: Category = 'OTHER';

        // Context-aware logic for "Subscription" (Подписка)
        const isAutoMention = fullContent.includes('подписк') || fullContent.includes('auto') || fullContent.includes('subscription') || fullContent.includes('будущ') || fullContent.includes('авто');
        const isViewMention = fullContent.includes('просмотр') || fullContent.includes('view') || fullContent.includes('eye');
        const isLikeMention = fullContent.includes('лайк') || fullContent.includes('like') || fullContent.includes('heart');
        const isReactionMention = fullContent.includes('реакци') || fullContent.includes('reaction');
        const isRepostMention = fullContent.includes('репост') || fullContent.includes('share');
        const isCommentMention = fullContent.includes('коммент') || fullContent.includes('comment');

        // isPostModifier detects if the text targets "future posts" rather than the channel itself 
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
            let bestCatMatch: { category: Category, index: number } | null = null;
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

        const effectivePlatform = platformEnum; 

        // Specific refinements
        if (effectivePlatform === 'VK') {
            if (fullContent.includes('в друзья') || fullContent.includes('на профиль')) category = 'FRIENDS';
            else if (fullContent.includes('групп') || fullContent.includes('сообщест')) category = 'GROUPS';
            else if (fullContent.includes('прослуш') || fullContent.includes('плейлист')) category = 'PLAYS';
            else if (fullContent.includes('глазик') || fullContent.includes('на запись')) category = 'VIEWS';
            else if (fullContent.includes('опрос') || fullContent.includes('голос')) category = 'POLLS';
        } else if (effectivePlatform === 'FACEBOOK') {
            if (fullContent.includes('group') || fullContent.includes('групп')) category = 'SUBSCRIBERS';
            else if (fullContent.includes('reel') || fullContent.includes('video')) category = 'VIEWS';
        } else if (effectivePlatform === 'TELEGRAM') {
            const isStory = nameNode.includes('истори') || nameNode.includes('story');
            const isAutoViews = (nameNode.includes('подписк') || nameNode.includes('auto') || nameNode.includes('авто')) && (nameNode.includes('просмотр') || nameNode.includes('view') || nameNode.includes('глаз'));
            
            if (fullContent.includes('stars')) category = 'STARS';
            else if (fullContent.includes('жалоба') || fullContent.includes('report')) category = 'COMPLAINTS';
            else if (fullContent.includes('boost') || fullContent.includes('буст')) category = 'BOOSTS';
            else if (isStory) category = 'STORIES';
            else if (isAutoViews) category = 'AUTO_VIEWS';
            else if (nameNode.includes('реакци') || nameNode.includes('reaction')) {
                // Earliest match check within name for views vs reactions
                const vIdx = nameNode.indexOf('просмотр');
                const vIdx2 = nameNode.indexOf('view');
                const rIdx = nameNode.indexOf('реакци');
                const rIdx2 = nameNode.indexOf('reaction');
                
                const minV = Math.min(vIdx === -1 ? Infinity : vIdx, vIdx2 === -1 ? Infinity : vIdx2);
                const minR = Math.min(rIdx === -1 ? Infinity : rIdx, rIdx2 === -1 ? Infinity : rIdx2);
                
                if (minV < minR) category = 'VIEWS';
                else category = 'REACTIONS';
            }
            else if (nameNode.includes('подпис') || nameNode.includes('member')) {
                // ПРИОРИТЕТ: "Подписчики" (Subscribers) > "Подписка" (Boosts/Auto)
                category = 'SUBSCRIBERS';
            }
            else if (nameNode.includes('просмотр') || nameNode.includes('view')) category = 'VIEWS';
        } else if (effectivePlatform === 'YOUTUBE') {
            if ((fullContent.includes('час') && !fullContent.includes('участник')) || fullContent.includes('hour')) category = 'VIEWS';
            if (fullContent.includes('short')) category = 'VIEWS';
            if (nameNode.includes('лайк') || nameNode.includes('like')) category = 'LIKES';
        } else if (effectivePlatform === 'DZEN') {
            if (fullContent.includes('стать') || fullContent.includes('article')) category = 'VIEWS';
        } else if (effectivePlatform === 'INSTAGRAM') {
            if (nameNode.includes('story') || nameNode.includes('сторис')) category = 'STORIES';
            else if (nameNode.includes('подпис') || nameNode.includes('follow')) category = 'SUBSCRIBERS';
            else if (nameNode.includes('лайк') || nameNode.includes('like')) category = 'LIKES';
            else if (nameNode.includes(' reels') || nameNode.includes('просмотр')) category = 'VIEWS';
        }

        // 3. Target Type
        let targetType: string;
        const isPrivate = fullContent.includes('private') || fullContent.includes('закрыт') || fullContent.includes('приват');
        const isAuto = isAutoMention || fullContent.includes('последних') || fullContent.includes('последние') || fullContent.includes('будущие') || fullContent.includes('будущих');

        if (effectivePlatform === 'TELEGRAM') {
            if (category === 'STARS') targetType = 'CUSTOM';
            else if (category === 'BOTS' || category === 'REFERRALS') targetType = 'CHANNEL';
            else if (category === 'STORIES') targetType = 'STORY';
            else if (isAuto) targetType = 'CHANNEL_POSTS';
            else if (['SUBSCRIBERS', 'GROUPS', 'BOOSTS', 'PREMIUM', 'FRIENDS'].includes(category)) targetType = 'CHANNEL';
            else targetType = 'POST';
        } else if (effectivePlatform === 'YOUTUBE') {
            if (isAuto) targetType = 'CHANNEL_POSTS';
            else if (['SUBSCRIBERS', 'FRIENDS', 'GROUPS'].includes(category)) targetType = 'CHANNEL';
            else targetType = 'POST';
        } else if (effectivePlatform === 'INSTAGRAM') {
            if (isAuto) targetType = 'CHANNEL_POSTS';
            else if (['SUBSCRIBERS', 'FRIENDS', 'GROUPS'].includes(category)) targetType = 'CHANNEL';
            else if (category === 'STORIES') targetType = 'STORY';
            else if (fullContent.includes('reel') || fullContent.includes('video')) targetType = 'POST'; 
            else targetType = 'POST';
        } else if (effectivePlatform === 'VK') {
            if (isAuto) targetType = 'CHANNEL_POSTS';
            else if (fullContent.includes('stream') || fullContent.includes('зрител')) targetType = 'POST'; 
            else if (category === 'POLLS') targetType = 'POLL';
            else if (['FRIENDS', 'GROUPS', 'SUBSCRIBERS'].includes(category)) targetType = 'CHANNEL';
            else if (fullContent.includes('clip') || fullContent.includes('клип')) targetType = 'POST';
            else if (fullContent.includes('video') || fullContent.includes('видео')) targetType = 'POST';
            else targetType = 'POST';
        } else if (effectivePlatform === 'DZEN') {
            if (isAuto) targetType = 'CHANNEL_POSTS';
            else if (fullContent.includes('стать') || fullContent.includes('article')) targetType = 'POST';
            else if (category === 'SUBSCRIBERS') targetType = 'CHANNEL';
            else targetType = 'POST'; 
        } else {
            if (isAuto) targetType = 'CHANNEL_POSTS';
            else if (['SUBSCRIBERS', 'GROUPS', 'FRIENDS', 'PREMIUM'].includes(category)) {
                 targetType = 'CHANNEL'; 
            } else if (fullContent.includes('video') || fullContent.includes('reel') || fullContent.includes('shorts')) {
                targetType = 'POST'; 
            } else {
                targetType = 'POST';
            }
        }

        // 4. Descriptions & Requirements
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const isFast = fullContent.includes('fast') || fullContent.includes('быстр');
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const isHQ = fullContent.includes('hq') || fullContent.includes('high quality');
        
        const desc = (sanitizedDescription && sanitizedDescription.length > 20) 
            ? sanitizedDescription 
            : `Услуга продвижения для ${PLATFORM_LABELS[effectivePlatform] || 'соцсетей'}.`;

        let requirements = '';
        const reqKeywords = ['link:', 'url:', 'формат:', 'link format:', 'требование:', 'пример:', 'ссылка:', 'example:', 'requirement:'];
        const lines = (sanitizedDescription || '').split('\n');
        for (const line of lines) {
            const lowLine = line.toLowerCase();
            if (reqKeywords.some(k => lowLine.includes(k))) {
                requirements += line.trim() + ' ';
            }
        }

        // 5. Custom Data & Media Group Detection
        let customDataType: 'NONE' | 'TEXTAREA' | 'NUMBER' = 'NONE';
        if (category === 'POLLS' || fullContent.includes('номер ответ') || fullContent.includes('за вариант')) {
            customDataType = 'NUMBER';
        } else if (
            fullContent.includes('свой текст') || 
            fullContent.includes('свои комментари') || 
            fullContent.includes('кастомные комментари') || 
            (fullContent.includes('кастомн') && fullContent.includes('коммент')) || 
            (fullContent.includes('по списку') && (fullContent.includes('коммент') || fullContent.includes('текст'))) || 
            (fullContent.includes('custom') && (fullContent.includes('comment') || fullContent.includes('text') || fullContent.includes('msg') || fullContent.includes('reply')))
        ) {
            customDataType = 'TEXTAREA';
        }

        let isMediaGroupAware = false;
        if (fullContent.includes('медиагрупп') || fullContent.includes('media group') || fullContent.includes('альбом')) {
            isMediaGroupAware = true;
        }

        // 6. Anti-Liar Dictionary Translation
        const geoTagMatch = name.match(/\[(.*?)\]/);
        let rawGeo = geoTagMatch ? geoTagMatch[1] : undefined;
        if (rawGeo && (rawGeo.includes('|') || rawGeo.length > 20)) {
            // Complex bracket like Stream-Promotion: [UHQ | Россия | 10К/Д]
            // We rely on the GEO_MAP 'geo' variable we already detected above
            rawGeo = undefined;
        }
        const compiledGeo = rawGeo ? normalizeGeo(rawGeo) : normalizeGeo(geo);
        const metricsCompiler = compileServiceMetrics(name, basePriceUsd);
        const tagsStr = metricsCompiler.translatedTags.filter(Boolean).join('. ');
        let finalDescription = tagsStr ? `${tagsStr}. Гео: ${compiledGeo}.` : `Гео: ${compiledGeo}.`;
        if (requirements.trim()) {
            finalDescription += `\nТребования: ${requirements.trim()}`;
        }
        if (!metricsCompiler.isRefill) {
            finalDescription += `\nВнимание: Возможны отписки. Без гарантии восстановления.`;
        }
        
        // Anti-Liar: Возвращаем оригинальное описание провайдера, чтобы оно не "обрезалось"
        if (desc && desc.length > 5) {
            finalDescription += `\n\n--- Оригинальное описание провайдера ---\n${desc}`;
        }
        
        // 7. Structured Execution Metrics Extraction (Start Time, Speed, Warranty, Quality)
        const catDefaults = DEFAULT_CATEGORY_METRICS[category] || DEFAULT_CATEGORY_METRICS.OTHER;

        // Start Time detection & Russian localization
        let detectedStartTime: string | undefined;
        const startTimeMatch = name.match(/\[?(?:start(?:\s*time)?|старт)\s*:\s*([^\]\s]+(?:\s+[^\]]+)?)\]?/i);
        if (startTimeMatch) {
            const raw = startTimeMatch[1].trim().toLowerCase();
            if (raw.includes('instant') || raw.includes('мгновенн') || raw.includes('моментальн') || raw.includes('автостарт')) detectedStartTime = 'Мгновенно';
            else if (raw.includes('0-1') || raw.includes('0 - 1') || raw.includes('1 hour') || raw.includes('1 hr')) detectedStartTime = '0–1 час';
            else if (raw.includes('0-2') || raw.includes('0 - 2') || raw.includes('2 hour') || raw.includes('2 hr')) detectedStartTime = '0–2 часа';
            else if (raw.includes('0-3') || raw.includes('0 - 3') || raw.includes('3 hour') || raw.includes('3 hr')) detectedStartTime = '0–3 часа';
            else if (raw.includes('0-8') || raw.includes('0 - 8') || raw.includes('8 hour') || raw.includes('8 hr')) detectedStartTime = '0–8 часов';
            else if (raw.includes('0-24') || raw.includes('0 - 24') || raw.includes('24 hour') || raw.includes('24 hr')) detectedStartTime = '0–24 часа';
            else if (raw.includes('48 hour') || raw.includes('48 hr')) detectedStartTime = 'до 48 часов';
            else if (raw.includes('5-15') || raw.includes('5 - 15') || raw.includes('15 min') || raw.includes('15 мин')) detectedStartTime = '5–15 мин';
            else if (raw.includes('30 min') || raw.includes('30 мин')) detectedStartTime = 'до 30 мин';
            else detectedStartTime = startTimeMatch[1].trim();
        } else if (fullContent.includes('instant') || fullContent.includes('мгновенн') || fullContent.includes('моментальн') || fullContent.includes('автостарт')) {
            detectedStartTime = 'Мгновенно';
        } else if (fullContent.includes('0-1') || fullContent.includes('0 - 1')) {
            detectedStartTime = '0–1 час';
        } else if (fullContent.includes('0-24') || fullContent.includes('0 - 24')) {
            detectedStartTime = '0–24 часа';
        } else {
            detectedStartTime = catDefaults.startTime;
        }

        // Speed detection & Russian localization
        let detectedSpeedText: string | undefined;
        const speedMatch = name.match(/\[?(?:speed|скорость)\s*:\s*([^\]]+)\]?/i);
        if (speedMatch) {
            let s = speedMatch[1].trim();
            s = s.replace(/up\s*to\s*/i, 'до ');
            s = s.replace(/(\d+(?:\.\d+)?)\s*([kmкм])?\s*\/\s*(?:d|day|days|сут|сутки|день)/i, (_, num, mult) => {
                const m = (mult || '').toLowerCase();
                const mStr = m === 'k' || m === 'к' ? 'k' : m === 'm' || m === 'м' ? ' млн' : '';
                return `до ${num}${mStr} / день`;
            });
            if (s.toLowerCase() === 'fast' || s.toLowerCase().includes('быстр')) s = 'Быстрая';
            else if (s.toLowerCase() === 'gradual' || s.toLowerCase().includes('плавн')) s = 'Плавная';
            else if (s.toLowerCase() === 'slow' || s.toLowerCase().includes('медленн')) s = 'Плавная';
            detectedSpeedText = s;
        } else if (tokenized.metrics?.velocity) {
            const v = tokenized.metrics.velocity;
            detectedSpeedText = v >= 1000 ? `до ${v / 1000}k / день` : `до ${v} / день`;
        } else if (fullContent.includes('fast') || fullContent.includes('быстр') || fullContent.includes('⚡')) {
            detectedSpeedText = 'Быстрая';
        } else if (fullContent.includes('gradual') || fullContent.includes('плавн') || fullContent.includes('drip')) {
            detectedSpeedText = 'Плавная';
        } else {
            detectedSpeedText = catDefaults.speedText;
        }

        // Warranty & Refill (with Strict Anti-Contradiction Negative Guard)
        const finalWarranty = isExplicitNoWarranty
            ? 0
            : (metricsCompiler.warrantyDays || warranty || catDefaults.warranty);
        const hasRefillBadge = !isExplicitNoWarranty && (metricsCompiler.isRefill || warranty > 0 || tokenized.metrics?.hasRefill || catDefaults.warranty > 0);

        // Quality Label
        const qualityMap: Record<string, string> = {
            PREMIUM: 'Премиум',
            HIGH: 'Живые',
            MEDIUM: 'Стандарт',
            LOW: 'Эконом',
            BOTS: 'Боты',
            UNKNOWN: 'Стандарт'
        };
        const tokenQuality = tokenized.metrics?.quality ? qualityMap[tokenized.metrics.quality] : undefined;
        const finalQuality = (metricsCompiler.tier && metricsCompiler.tier !== 'Эконом')
            ? metricsCompiler.tier
            : (tokenQuality || catDefaults.qualityLabel);

        const categoryLabel = CATEGORY_LABELS[category] || 'Продвижение';
        const finalName = `${categoryLabel} (${finalQuality})`;

        const enrichedMetrics: ProcurementMetrics = {
            ...tokenized.metrics,
            startTime: detectedStartTime,
            speedText: detectedSpeedText,
            warrantyDays: finalWarranty,
            qualityLabel: finalQuality,
            hasRefill: hasRefillBadge
        };

        return {
            platform: platformEnum,
            platformSlug,
                        category: category as Category,
            targetType,
            isPrivate,
            description_ru: finalDescription,
            suggestedName: finalName,
            cleanName: tokenized.cleanName,
            requirements: requirements.trim() || undefined,
            geo: compiledGeo,
            warranty: finalWarranty,
            startTime: detectedStartTime,
            speedText: detectedSpeedText,
            qualityLabel: finalQuality,
            customDataType,
            isMediaGroupAware,
            metrics: enrichedMetrics
        };
    }

    static suggestTargetType(name: string, category: string, description: string = ''): string {
        return this.detectSync(name, description, category).targetType;
    }

    static suggestIsPrivate(name: string): boolean {
        return this.detectSync(name).isPrivate;
    }

    static suggestCategory(name: string, category: string = ''): Category {
        return this.detectSync(name, '', category).category;
    }
}
