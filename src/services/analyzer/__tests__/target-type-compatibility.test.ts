import { describe, it, expect } from 'vitest';
import { TargetTypeEnum, normalizeTargetType, isTargetTypeCompatible, inferTargetTypeFromName } from '@/utils/target-type';
import { matchesSuggestedCategory } from '../category-matcher';

describe('TargetTypeMapper & Normalization Layer (Stage 2 Core Logic)', () => {
  it('correctly normalizes lowercase link types to uppercase TargetTypeEnum', () => {
    expect(normalizeTargetType('channel')).toBe(TargetTypeEnum.CHANNEL);
    expect(normalizeTargetType('post')).toBe(TargetTypeEnum.POST);
    expect(normalizeTargetType('private_post')).toBe(TargetTypeEnum.POST);
    expect(normalizeTargetType('video')).toBe(TargetTypeEnum.VIDEO);
    expect(normalizeTargetType('profile')).toBe(TargetTypeEnum.PROFILE);
    expect(normalizeTargetType('story')).toBe(TargetTypeEnum.STORY);
    expect(normalizeTargetType('poll')).toBe(TargetTypeEnum.POLL);
    expect(normalizeTargetType('comment')).toBe(TargetTypeEnum.COMMENTS);
    expect(normalizeTargetType('comments')).toBe(TargetTypeEnum.COMMENTS);
    expect(normalizeTargetType('bot')).toBe(TargetTypeEnum.BOT);
    expect(normalizeTargetType('channel_posts')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(normalizeTargetType('unknown_foo')).toBe(TargetTypeEnum.CUSTOM);
  });

  it('correctly infers TargetTypeEnum from service names', () => {
    expect(inferTargetTypeFromName('Telegram Подписчики на канал')).toBe(TargetTypeEnum.CHANNEL);
    expect(inferTargetTypeFromName('Просмотры на пост')).toBe(TargetTypeEnum.POST);
    expect(inferTargetTypeFromName('Автопросмотры на будущие 10 постов')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('Лайки на рилс / Reels / Shorts')).toBe(TargetTypeEnum.VIDEO);
    expect(inferTargetTypeFromName('Зрители в прямой эфир / Стрим')).toBe(TargetTypeEnum.VIDEO);
    expect(inferTargetTypeFromName('Просмотры историй / Stories')).toBe(TargetTypeEnum.STORY);
    expect(inferTargetTypeFromName('Голоса в опрос Telegram')).toBe(TargetTypeEnum.POLL);
    expect(inferTargetTypeFromName('Пользовательские комментарии')).toBe(TargetTypeEnum.COMMENTS);
    // [BUG-FIX] "Последних N постов" — auto-views on last N posts of a channel, must be CHANNEL_POSTS not POST
    expect(inferTargetTypeFromName('Telegram Просмотры на 5 последних постов [Пакет охвата]')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('🇷🇺 Просмотры [Последних 50 постов]')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('Просмотры последних 10 постов')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('Пакет охвата канала')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('Пакет просмотров на канал')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    // [AUTO-SERVICES with hyphens/spaces and subscriptions]
    expect(inferTargetTypeFromName('Telegram Авто - Просмотры [Подписка] [От 10]')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('Telegram Микс позитивных реакций [👍 ❤️ 🔥 🎉 😁] + Просмотры [Подписка]')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('🇷🇺 Telegram Авто - Просмотры в статистику [Россия]')).toBe(TargetTypeEnum.CHANNEL_POSTS);
    expect(inferTargetTypeFromName('Telegram Подписчики [7 Дней без списаний♻️]')).toBe(TargetTypeEnum.CHANNEL);
  });

  it('correctly checks compatibility between URL types and Service types', () => {
    // Channel URL can accept channel and channel_posts
    expect(isTargetTypeCompatible('channel', 'CHANNEL')).toBe(true);
    expect(isTargetTypeCompatible('channel', 'CHANNEL_POSTS')).toBe(true);
    expect(isTargetTypeCompatible('channel', 'POST')).toBe(false);

    // Post URL can ONLY accept POST / VIDEO / COMMENTS, never CHANNEL or CHANNEL_POSTS
    expect(isTargetTypeCompatible('post', 'POST')).toBe(true);
    expect(isTargetTypeCompatible('post', 'VIDEO')).toBe(true);
    expect(isTargetTypeCompatible('post', 'COMMENTS')).toBe(true);
    expect(isTargetTypeCompatible('post', 'CHANNEL')).toBe(false);
    expect(isTargetTypeCompatible('post', 'CHANNEL_POSTS')).toBe(false);

    // Profile URL accepts PROFILE and CHANNEL, but not POST
    expect(isTargetTypeCompatible('profile', 'PROFILE')).toBe(true);
    expect(isTargetTypeCompatible('profile', 'CHANNEL')).toBe(true);
    expect(isTargetTypeCompatible('profile', 'POST')).toBe(false);

    // Story URL only accepts STORY
    expect(isTargetTypeCompatible('story', 'STORY')).toBe(true);
    expect(isTargetTypeCompatible('story', 'POST')).toBe(false);

    // Fallbacks
    expect(isTargetTypeCompatible(null, 'POST')).toBe(true);
    expect(isTargetTypeCompatible('post', null)).toBe(true);
    expect(isTargetTypeCompatible('custom', 'POST')).toBe(true);
  });

  it('matchesSuggestedCategory enforces strict compatibility with detectedType', () => {
    // A single POST link should NOT match "Подписчики" category
    expect(matchesSuggestedCategory('👨‍👩‍👧‍👦 Подписчики / Участники', ['Подписчики'], null, 'post')).toBe(false);

    // A single POST link SHOULD match "Просмотры / Охват" category
    expect(matchesSuggestedCategory('👁 Просмотры / Охват', ['Просмотры / Охват'], null, 'post')).toBe(true);

    // A CHANNEL link SHOULD match "Подписчики" category
    expect(matchesSuggestedCategory('👨‍👩‍👧‍👦 Подписчики / Участники', ['Подписчики'], null, 'channel')).toBe(true);

    // A CHANNEL link SHOULD match "Автопросмотры" (CHANNEL_POSTS)
    expect(matchesSuggestedCategory('🤖 Автопросмотры', ['Автопросмотры'], null, 'channel')).toBe(true);

    // Even if suggestedCategories is empty, POST link rejects "Подписчики"
    expect(matchesSuggestedCategory('👨‍👩‍👧‍👦 Подписчики / Участники', [], null, 'post')).toBe(false);
  });
});
