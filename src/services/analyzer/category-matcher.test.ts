import { describe, it, expect } from 'vitest';
import { matchesSuggestedCategory } from './category-matcher';

describe('matchesSuggestedCategory', () => {
  it('correctly matches regular categories with regular suggested', () => {
    // 👁 Просмотры / Охват
    expect(matchesSuggestedCategory('👁 Просмотры / Охват', ['Просмотры / Охват'])).toBe(true);
    expect(matchesSuggestedCategory('👨‍👩‍👧‍👦 Подписчики / Участники', ['Подписчики / Участники'])).toBe(true);
  });

  it('prevents regular suggested categories from matching auto database categories', () => {
    // A post link suggests regular views, but should NOT match auto views (Автопросмотры)
    expect(matchesSuggestedCategory('🤖 Автопросмотры', ['Просмотры / Охват'])).toBe(false);
    expect(matchesSuggestedCategory('🤖 Автолайки', ['Лайки / Нравится'])).toBe(false);
    expect(matchesSuggestedCategory('🤖 Автореакции', ['Реакции / Эмодзи'])).toBe(false);
    expect(matchesSuggestedCategory('🤖 Авторепосты', ['Репосты / Поделиться'])).toBe(false);
    expect(matchesSuggestedCategory('Будущие просмотры', ['Просмотры / Охват'])).toBe(false);
  });

  it('correctly matches auto suggested categories with auto database categories', () => {
    // A channel link suggests auto views, which should match auto views (Автопросмотры)
    expect(matchesSuggestedCategory('🤖 Автопросмотры', ['Автопросмотры'])).toBe(true);
    expect(matchesSuggestedCategory('🤖 Авторепосты', ['Авторепосты'])).toBe(true);
  });

  it('prevents auto suggested categories from matching regular database categories', () => {
    // A channel link suggesting auto views should NOT match regular views
    expect(matchesSuggestedCategory('👁 Просмотры / Охват', ['Автопросмотры'])).toBe(false);
  });
});
