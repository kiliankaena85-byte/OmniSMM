import { describe, it, expect } from 'vitest';
import { analyzeUrl } from '@/actions/order/analyze-url';
import { matchesSuggestedCategory } from '@/services/analyzer/category-matcher';
import { isTargetTypeCompatible, TargetTypeEnum } from '@/utils/target-type-mapper';
import { isHybridViewCategory, inferTargetTypeFromCategory } from '@/utils/target-type';

describe('Unified Views Category Filtering & Partitioning', () => {
  const canonicalCategories = [
    { id: 'cat-subs', name: '👥 Подписчики на канал и в группу', analyzerTags: null },
    { id: 'cat-views', name: '👁️ Просмотры и охваты постов', analyzerTags: null },
    { id: 'cat-comm', name: '💬 Комментарии и отзывы', analyzerTags: null },
    { id: 'cat-react', name: '❤️ Реакции на публикации', analyzerTags: null },
    { id: 'cat-boost', name: '🚀 Бусты канала (Stories & Levels)', analyzerTags: null },
    { id: 'cat-bot', name: '🤖 Запуск ботов и рефералы', analyzerTags: null },
  ];

  it('identifies hybrid view categories correctly', () => {
    expect(isHybridViewCategory('👁️ Просмотры и охваты постов')).toBe(true);
    expect(isHybridViewCategory('Просмотры Telegram')).toBe(true);
    expect(isHybridViewCategory('Охват публикаций')).toBe(true);
    expect(isHybridViewCategory('Telegram Views')).toBe(true);

    expect(isHybridViewCategory('👥 Подписчики на канал')).toBe(false);
    expect(isHybridViewCategory('❤️ Реакции на публикации')).toBe(false);
    expect(isHybridViewCategory('💬 Комментарии и отзывы')).toBe(false);
    expect(isHybridViewCategory('🚀 Бусты канала')).toBe(false);
    expect(isHybridViewCategory('Просмотры историй (Stories)')).toBe(false);
  });

  it('infers CUSTOM targetType for hybrid view category container', () => {
    expect(inferTargetTypeFromCategory('👁️ Просмотры и охваты постов')).toBe(TargetTypeEnum.CUSTOM);
    expect(isTargetTypeCompatible('channel', TargetTypeEnum.CUSTOM)).toBe(true);
    expect(isTargetTypeCompatible('post', TargetTypeEnum.CUSTOM)).toBe(true);
  });

  it('matches hybrid view category when user inputs a Telegram Channel link', async () => {
    const res = await analyzeUrl('https://t.me/smmMarket69');
    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('channel');

    const matched = canonicalCategories.filter(c =>
      matchesSuggestedCategory(c.name, res.data?.suggestedCategories || [], c.analyzerTags, res.data?.type)
    );

    const matchedNames = matched.map(m => m.name);
    expect(matchedNames).toContain('👁️ Просмотры и охваты постов');
    expect(matchedNames).toContain('👥 Подписчики на канал и в группу');
    expect(matchedNames).toContain('🚀 Бусты канала (Stories & Levels)');

    expect(matchedNames).not.toContain('❤️ Реакции на публикации');
    expect(matchedNames).not.toContain('💬 Комментарии и отзывы');
    expect(matchedNames).not.toContain('🤖 Запуск ботов и рефералы');
  });

  it('matches hybrid view category when user inputs a Telegram Post link', async () => {
    const res = await analyzeUrl('https://t.me/smmMarket69/123');
    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('post');

    const matched = canonicalCategories.filter(c =>
      matchesSuggestedCategory(c.name, res.data?.suggestedCategories || [], c.analyzerTags, res.data?.type)
    );

    const matchedNames = matched.map(m => m.name);
    expect(matchedNames).toContain('👁️ Просмотры и охваты постов');
    expect(matchedNames).toContain('❤️ Реакции на публикации');
    expect(matchedNames).toContain('💬 Комментарии и отзывы');

    expect(matchedNames).not.toContain('👥 Подписчики на канал и в группу');
    expect(matchedNames).not.toContain('🚀 Бусты канала (Stories & Levels)');
    expect(matchedNames).not.toContain('🤖 Запуск ботов и рефералы');
  });
});