import { describe, it, expect } from 'vitest';
import { analyzeUrl } from '@/actions/order/analyze-url';
import { matchesSuggestedCategory } from '@/services/analyzer/category-matcher';
import { inferTargetTypeFromName, isTargetTypeCompatible, TargetTypeEnum } from '@/utils/target-type-mapper';

describe('Order Wizard Category Filtering (Smart Target Matching)', () => {
  const mockCategories = [
    { id: 'cat-subs', name: '👥 Подписчики на канал и в группу', analyzerTags: null },
    { id: 'cat-views', name: '👁️ Просмотры и охваты постов', analyzerTags: null },
    { id: 'cat-comm', name: '💬 Комментарии и отзывы', analyzerTags: null },
    { id: 'cat-vex', name: 'Просмотры Telegram (Vexboost Live)', analyzerTags: null },
    { id: 'cat-react', name: '❤️ Реакции на публикации', analyzerTags: null },
    { id: 'cat-boost', name: '🚀 Бусты канала (Stories & Levels)', analyzerTags: null },
    { id: 'cat-bot', name: '🤖 Запуск ботов и рефералы', analyzerTags: null },
  ];

  it('correctly filters categories for Telegram Channel link (https://t.me/smmMarket69)', async () => {
    const res = await analyzeUrl('https://t.me/smmMarket69');
    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('channel');

    const matched = mockCategories.filter(c =>
      matchesSuggestedCategory(c.name, res.data?.suggestedCategories || [], c.analyzerTags, res.data?.type)
    );

    const matchedNames = matched.map(m => m.name);
    // Channel-compatible categories should match (including hybrid views hosting auto-views / last-N-posts packages)
    expect(matchedNames).toContain('👥 Подписчики на канал и в группу');
    expect(matchedNames).toContain('🚀 Бусты канала (Stories & Levels)');
    expect(matchedNames).toContain('👁️ Просмотры и охваты постов');

    // Post-only (Reactions/Comments) or Bot-only categories must NOT match
    expect(matchedNames).not.toContain('❤️ Реакции на публикации');
    expect(matchedNames).not.toContain('💬 Комментарии и отзывы');
    expect(matchedNames).not.toContain('🤖 Запуск ботов и рефералы');
  });

  it('correctly filters categories for Telegram Post link (https://t.me/smmMarket69/123)', async () => {
    const res = await analyzeUrl('https://t.me/smmMarket69/123');
    expect(res.success).toBe(true);
    expect(res.data?.type).toBe('post');

    const matched = mockCategories.filter(c =>
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

  it('correctly isolates vendor names containing "boost" from real channel boosts', () => {
    const vexboostCategory = 'Просмотры Telegram (Vexboost Live)';
    const realBoostCategory = '🚀 Бусты канала (Stories & Levels)';

    const inferredVex = inferTargetTypeFromName(vexboostCategory);
    const inferredReal = inferTargetTypeFromName(realBoostCategory);

    expect(inferredVex).toBe(TargetTypeEnum.POST);
    expect(inferredReal).toBe(TargetTypeEnum.CHANNEL);

    expect(isTargetTypeCompatible('channel', inferredVex)).toBe(false);
    expect(isTargetTypeCompatible('channel', inferredReal)).toBe(true);
  });
});
