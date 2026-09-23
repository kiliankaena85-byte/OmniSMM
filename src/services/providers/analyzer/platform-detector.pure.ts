/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Pure Platform detection module for SmartAnalyzer.
 */

export type Platform = string;

export const PLATFORMS = [
    'TELEGRAM', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'VK', 'TWITCH', 'DISCORD', 'TWITTER',
    'FACEBOOK', 'THREADS', 'REDDIT', 'RUTUBE', 'DZEN', 'MUSIC', 'OK', 'KICK', 'LIKEE',
    'WHATSAPP', 'SPOTIFY', 'SOUNDCLOUD', 'LINKEDIN', 'PINTEREST', 'SNAPCHAT', 'TROVO',
    'KWAI', 'MAX', 'GOOGLE', 'APPLE', 'YANDEX', 'STEAM', 'WIBES', 'RUMBLE', 'TUMBLR',
    'VIMEO', 'SHAZAM', 'QUORA', 'MEDIUM', 'WEBSITE', 'PERISCOPE', 'CLOUDHUB', 'AUDIOMACK',
    'DATPIFF', 'OTHER'
];

export const PLATFORM_LABELS: Record<string, string> = {
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

export const PLATFORM_KEYWORDS: Record<string, string[]> = {
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

export interface DynamicPlatformInput {
    slug: string;
    keywords: string[];
    name: string;
}

export function detectPlatform(
    nameLower: string,
    sanitizedDescriptionLower: string,
    catInputLower: string,
    fullContent: string,
    dynamicPlatforms?: DynamicPlatformInput[]
): { platformEnum: Platform; platformSlug: string } {
    let platformEnum: Platform = 'OTHER';
    let platformSlug = 'other';

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
            if (match(nameLower, k)) platformScores[p] += 5;
            if (match(sanitizedDescriptionLower, k)) platformScores[p] += 1;
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

    return { platformEnum, platformSlug };
}
