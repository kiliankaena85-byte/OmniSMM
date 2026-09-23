/**
 * QA-3: Provider Integration Engineer
 * Test Suite: SmartAnalyzerLogic — Data-Driven Classification
 * Standards: ISTQB §4.2.1 (Equivalence Partitioning), ISO 25010 §6.3.1
 * Coverage: Platform detection, Category detection, Geo, Warranty, Privacy
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the sanitizer dependency
vi.mock('@/utils/description-sanitizer', () => ({
  DescriptionSanitizer: {
    sanitize: (text: string) => text || '',
  },
}));

import { SmartAnalyzerLogic } from '@/services/providers/smart-analyzer.logic';

describe('SmartAnalyzerLogic (QA-3: Provider Integration Engineer)', () => {
  // ── Data-Driven: Platform Detection ──
  describe('Platform Detection', () => {
    const platformCases: Array<{ input: string; category: string; expected: string }> = [
      { input: 'Telegram Подписчики канала', category: 'Telegram', expected: 'TELEGRAM' },
      { input: 'Instagram Likes HQ Real', category: 'Instagram', expected: 'INSTAGRAM' },
      { input: 'YouTube Views Fast', category: 'YouTube', expected: 'YOUTUBE' },
      { input: 'TikTok Followers Premium', category: 'TikTok', expected: 'TIKTOK' },
      { input: 'VK Просмотры записи', category: 'ВКонтакте', expected: 'VK' },
      { input: 'Twitter Likes X.com', category: 'Twitter', expected: 'TWITTER' },
      { input: 'Facebook Page Likes', category: 'Facebook', expected: 'FACEBOOK' },
      { input: 'Discord Members Online', category: 'Discord', expected: 'DISCORD' },
      { input: 'Twitch Viewers Bot', category: 'Twitch', expected: 'TWITCH' },
      { input: 'Spotify Plays Premium', category: 'Spotify', expected: 'SPOTIFY' },
      { input: 'Unknown Service XYZ 123', category: 'Unknown', expected: 'OTHER' },
    ];

    it.each(platformCases)(
      'TC-PRV-011+: "$input" → platform=$expected',
      ({ input, category, expected }) => {
        const result = SmartAnalyzerLogic.detectSync(input, '', category);
        expect(result.platform).toBe(expected);
      }
    );
  });

  // ── Data-Driven: Category Detection ──
  describe('Category Detection', () => {
    const categoryCases: Array<{ input: string; category: string; expected: string }> = [
      { input: 'Telegram Подписчики', category: 'Telegram', expected: 'SUBSCRIBERS' },
      { input: 'Instagram Likes', category: 'Instagram', expected: 'LIKES' },
      { input: 'YouTube Views', category: 'YouTube', expected: 'VIEWS' },
      { input: 'Telegram Просмотры поста', category: 'Telegram', expected: 'VIEWS' },
      { input: 'VK Репосты записи', category: 'ВКонтакте', expected: 'REPOSTS' },
      { input: 'Telegram Реакции 🎭', category: 'Telegram', expected: 'REACTIONS' },
      { input: 'Telegram Комментарии', category: 'Telegram', expected: 'COMMENTS' },
      { input: 'Instagram Сторис просмотры', category: 'Instagram', expected: 'STORIES' },
      { input: 'Telegram Бусты канала', category: 'Telegram', expected: 'BOOSTS' },
      { input: 'VK Голоса в опросе', category: 'ВКонтакте', expected: 'POLLS' },
    ];

    it.each(categoryCases)(
      'TC-PRV-012+: "$input" → category=$expected',
      ({ input, category, expected }) => {
        const result = SmartAnalyzerLogic.detectSync(input, '', category);
        expect(result.category).toBe(expected);
      }
    );
  });

  // ── TC-PRV-016: Priority disambiguation (Views vs Reactions in name) ──
  it('TC-PRV-016: "Telegram Просмотры + Реакции" prioritizes VIEWS (earlier position)', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Просмотры + Реакции', '', 'Telegram');
    expect(result.category).toBe('VIEWS');
  });

  // ── TC-PRV-018: Bot detection takes priority ──
  it('TC-PRV-018: "Telegram Боты для канала" → BOTS (not SUBSCRIBERS)', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Боты для канала', '', 'Telegram');
    expect(result.category).toBe('BOTS');
  });

  // ── TC-PRV-019: Stories + target type ──
  it('TC-PRV-019: "Instagram Сторис" → category=STORIES, targetType=STORY', () => {
    const result = SmartAnalyzerLogic.detectSync('Instagram Сторис просмотры', '', 'Instagram');
    expect(result.category).toBe('STORIES');
    expect(result.targetType).toBe('STORY');
  });

  // ── TC-PRV-020: Warranty detection ──
  it('TC-PRV-020: "30 дней гарантия" → warranty=30', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Подписчики 30 дней гарантия', '', 'Telegram');
    expect(result.warranty).toBe(30);
  });

  it('TC-PRV-020b: "♻️" emoji → warranty=30 (default)', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Подписчики ♻️', '', 'Telegram');
    expect(result.warranty).toBe(30);
  });

  // ── TC-PRV-021: Geo detection Russia ──
  it('TC-PRV-021: "Россия 🇷🇺" → geo=Россия', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Подписчики Россия 🇷🇺', '', 'Telegram');
    expect(result.geo).toBe('Россия');
  });

  // ── TC-PRV-022: Geo detection USA ──
  it('TC-PRV-022: "USA Worldwide" → geo=США', () => {
    const result = SmartAnalyzerLogic.detectSync('Instagram Followers USA Worldwide', '', 'Instagram');
    expect(result.geo).toBe('США');
  });

  // ── TC-PRV-023: Private detection ──
  it('TC-PRV-023: "закрытый канал" → isPrivate=true', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Подписчики закрытый канал', '', 'Telegram');
    expect(result.isPrivate).toBe(true);
  });

  it('TC-PRV-023b: "private channel" → isPrivate=true', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Subscribers private channel', '', 'Telegram');
    expect(result.isPrivate).toBe(true);
  });

  // ── TC-PRV-024: Auto-subscription context ──
  it('TC-PRV-024: "Подписка на просмотры постов" → AUTO_VIEWS (not SUBSCRIBERS)', () => {
    const result = SmartAnalyzerLogic.detectSync('Подписка на просмотры постов', '', 'Telegram');
    expect(result.category).toBe('AUTO_VIEWS');
  });

  // ── Target Type Tests ──
  describe('Target Type Detection', () => {
    it('Telegram SUBSCRIBERS → targetType=CHANNEL', () => {
      const result = SmartAnalyzerLogic.detectSync('Telegram Подписчики', '', 'Telegram');
      expect(result.targetType).toBe('CHANNEL');
    });

    it('YouTube SUBSCRIBERS → targetType=CHANNEL', () => {
      const result = SmartAnalyzerLogic.detectSync('YouTube Подписчики', '', 'YouTube');
      expect(result.targetType).toBe('CHANNEL');
    });

    it('YouTube VIEWS → targetType=POST', () => {
      const result = SmartAnalyzerLogic.detectSync('YouTube Просмотры видео', '', 'YouTube');
      expect(result.targetType).toBe('POST');
    });

    it('Instagram SUBSCRIBERS → targetType=CHANNEL', () => {
      const result = SmartAnalyzerLogic.detectSync('Instagram Подписчики', '', 'Instagram');
      expect(result.targetType).toBe('CHANNEL');
    });

    it('VK FRIENDS → targetType=CHANNEL', () => {
      const result = SmartAnalyzerLogic.detectSync('VK Заявки в друзья на профиль', '', 'ВКонтакте');
      expect(result.category).toBe('FRIENDS');
      expect(result.targetType).toBe('CHANNEL');
    });

    it('Telegram Stars → targetType=CUSTOM', () => {
      const result = SmartAnalyzerLogic.detectSync('Telegram Stars покупка', '', 'Telegram');
      expect(result.category).toBe('STARS');
      expect(result.targetType).toBe('CUSTOM');
    });
  });

  // ── suggestedName strips brackets ──
  it('suggestedName strips [brackets] from name', () => {
    const result = SmartAnalyzerLogic.detectSync('[HQ] Instagram Likes [Fast]', '', 'Instagram');
    expect(result.suggestedName).toBe('Лайки / Нравится (Стандарт)');
  });

  // ── No warranty by default ──
  it('No warranty keywords → warranty=0', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Подписчики быстрые', '', 'Telegram');
    expect(result.warranty).toBe(0);
  });

  // ── Default geo ──
  it('No geo keywords → geo=Весь мир', () => {
    const result = SmartAnalyzerLogic.detectSync('Telegram Просмотры', '', 'Telegram');
    expect(result.geo).toBe('Весь мир');
  });
});
