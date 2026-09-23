/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Pure TargetType detection module for SmartAnalyzer.
 */
import type { Platform } from './platform-detector.pure';
import type { Category } from './category-detector.pure';

export const TARGET_TYPES = [
    'CHANNEL', 'POST', 'PROFILE', 'VIDEO', 'VK_VIDEO', 'VK_CLIP', 'VK_PLAY',
    'CHANNEL_POSTS', 'STORY', 'COMMENTS', 'POLL', 'PHOTO', 'MARKET', 'PLAYLIST',
    'ALBUM', 'EXTERNAL', 'CUSTOM'
];

export const TARGET_TYPE_LABELS: Record<string, string> = {
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

export function detectTargetType(
    effectivePlatform: Platform,
    category: Category,
    fullContent: string,
    isAutoMention: boolean
): { targetType: string; isPrivate: boolean } {
    const isPrivate = fullContent.includes('private') || fullContent.includes('закрыт') || fullContent.includes('приват');
    const isAuto = isAutoMention || fullContent.includes('последних') || fullContent.includes('последние') || fullContent.includes('будущие') || fullContent.includes('будущих');

    let targetType = 'POST';

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

    return { targetType, isPrivate };
}
