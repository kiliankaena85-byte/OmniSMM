import { describe, it, expect, vi } from 'vitest';
import { ensureCategoryForActivityType, inferCanonicalActivityType } from '@/services/admin/catalog.service';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    category: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    }
  }
}));

vi.mock('@/lib/logger', () => {
  const logMock = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  logMock.child.mockReturnValue(logMock);
  return { logger: logMock };
});

describe('Semantic Category Guard & Canonical Activity Inference', () => {
  describe('inferCanonicalActivityType', () => {
    it('identifies SUBSCRIBERS for various subscriber names', () => {
      expect(inferCanonicalActivityType(undefined, 'Telegram живые подписчики с рекламы [Россия]')).toBe('SUBSCRIBERS');
      expect(inferCanonicalActivityType(undefined, 'Telegram живые подписчики с рекламы [Россия+СНГ] [Мужчины👦🏻]')).toBe('SUBSCRIBERS');
      expect(inferCanonicalActivityType(undefined, 'Instagram Followers [Real]')).toBe('SUBSCRIBERS');
      expect(inferCanonicalActivityType(undefined, 'VK Подписчики в группу')).toBe('SUBSCRIBERS');
      expect(inferCanonicalActivityType(undefined, 'Members Global')).toBe('SUBSCRIBERS');
      expect(inferCanonicalActivityType(undefined, 'Random Name', 'CHANNEL')).toBe('SUBSCRIBERS');
      expect(inferCanonicalActivityType('SUBSCRIBERS', 'Random Name')).toBe('SUBSCRIBERS');
    });

    it('identifies VIEWS and AUTO_VIEWS for view names', () => {
      expect(inferCanonicalActivityType(undefined, 'Telegram Просмотры [Моментальные]')).toBe('VIEWS');
      expect(inferCanonicalActivityType(undefined, 'Rutube Просмотры на видео')).toBe('VIEWS');
      expect(inferCanonicalActivityType(undefined, 'Telegram Авто-просмотры на 25 постов')).toBe('AUTO_VIEWS');
      expect(inferCanonicalActivityType(undefined, 'Rutube Авто - Просмотры на 10 видео [Реальные]')).toBe('AUTO_VIEWS');
      expect(inferCanonicalActivityType('VIEWS', 'Random Name')).toBe('VIEWS');
    });

    it('identifies LIKES and AUTO_LIKES for like names', () => {
      expect(inferCanonicalActivityType(undefined, 'Instagram Лайки на фото')).toBe('LIKES');
      expect(inferCanonicalActivityType(undefined, 'YouTube Лайки на Shorts')).toBe('LIKES');
      expect(inferCanonicalActivityType(undefined, 'TikTok Лайки на комментарии')).toBe('LIKES');
      expect(inferCanonicalActivityType(undefined, 'Telegram Авто-лайки')).toBe('AUTO_LIKES');
    });

    it('identifies COMMENTS for comment names', () => {
      expect(inferCanonicalActivityType(undefined, 'VK Комментарии Кастомные')).toBe('COMMENTS');
      expect(inferCanonicalActivityType(undefined, 'Instagram Comments')).toBe('COMMENTS');
    });

    it('identifies REACTIONS for reaction names', () => {
      expect(inferCanonicalActivityType(undefined, 'Max Реакция [👍]')).toBe('REACTIONS');
      expect(inferCanonicalActivityType(undefined, 'Telegram Premium Реакции')).toBe('REACTIONS');
    });

    it('identifies STREAMS and BATTLE for stream and battle names', () => {
      expect(inferCanonicalActivityType(undefined, 'TikTok Баттл поинты [PK Battle Points] [Лучшая цена]')).toBe('STREAMS');
      expect(inferCanonicalActivityType(undefined, 'YouTube Стрим зрители [Live Stream]')).toBe('STREAMS');
      expect(inferCanonicalActivityType(undefined, 'Twitch Зрители на прямой эфир')).toBe('STREAMS');
    });

    it('identifies STARS for stars names', () => {
      expect(inferCanonicalActivityType(undefined, 'Telegram Звезды на посты')).toBe('STARS');
      expect(inferCanonicalActivityType(undefined, 'Telegram Stars [Official]')).toBe('STARS');
    });
  });

  describe('Semantic Mismatch Detection & Rerouting', () => {
    it('detects subscriber services misplaced in VIEWS categories', () => {
      const serviceName = 'Telegram живые подписчики с рекламы [Россия]';
      const canonicalType = inferCanonicalActivityType(undefined, serviceName);
      const targetCategoryActivityType = 'VIEWS' as string;
      const targetCategoryName = 'Просмотры';

      const isContradiction = canonicalType === 'SUBSCRIBERS' && (
        targetCategoryActivityType !== 'SUBSCRIBERS' || targetCategoryName.includes('просмотр')
      );
      expect(isContradiction).toBe(true);
    });

    it('detects subscriber services misplaced in LIKES categories', () => {
      const serviceName = 'Instagram Подписчики [США]';
      const canonicalType = inferCanonicalActivityType(undefined, serviceName);
      const targetCategoryActivityType = 'LIKES' as string;

      const isContradiction = canonicalType === 'SUBSCRIBERS' && targetCategoryActivityType !== 'SUBSCRIBERS';
      expect(isContradiction).toBe(true);
    });

    it('detects views services misplaced in SUBSCRIBERS categories', () => {
      const serviceName = 'Telegram Просмотры [10 в минуту]';
      const canonicalType = inferCanonicalActivityType(undefined, serviceName);
      const targetCategoryActivityType = 'SUBSCRIBERS';

      const isContradiction = (canonicalType === 'VIEWS' || canonicalType === 'AUTO_VIEWS') &&
        !['VIEWS', 'AUTO_VIEWS', 'AUTO_SERVICES'].includes(targetCategoryActivityType);
      expect(isContradiction).toBe(true);
    });

    it('detects stream and battle services misplaced in SUBSCRIBERS categories', () => {
      const serviceName = 'TikTok Баттл поинты [PK Battle Points] [Лучшая цена]';
      const canonicalType = inferCanonicalActivityType(undefined, serviceName);
      const targetCategoryActivityType = 'SUBSCRIBERS' as string;

      const isContradiction = canonicalType === 'STREAMS' && targetCategoryActivityType !== 'STREAMS';
      expect(isContradiction).toBe(true);
    });

    it('enforces CHANNEL targetType for subscriber services', () => {
      const canonicalType = inferCanonicalActivityType(undefined, 'Telegram живые подписчики с рекламы');
      let effectiveTargetType: string = 'POST'; // Initially set from wrong category

      if (canonicalType === 'SUBSCRIBERS') {
        effectiveTargetType = 'CHANNEL';
      }

      expect(effectiveTargetType).toBe('CHANNEL');
    });
  });

  describe('SmartAnalyzerLogic classification precision', () => {
    // Import SmartAnalyzerLogic dynamically or at top
    it('classifies auto-views with subscription note as AUTO_VIEWS, not SUBSCRIBERS', async () => {
      const { SmartAnalyzerLogic } = await import('@/services/providers/smart-analyzer.logic');
      const result = SmartAnalyzerLogic.detectSync('Telegram Авто - Просмотры [Подписка] [От 10]', 'Telegram');
      expect(result.category).toBe('AUTO_VIEWS');
    });

    it('classifies reactions with subscription note as REACTIONS, not SUBSCRIBERS', async () => {
      const { SmartAnalyzerLogic } = await import('@/services/providers/smart-analyzer.logic');
      const result = SmartAnalyzerLogic.detectSync('Telegram Микс позитивных реакций + Просмотры [Подписка]', 'Telegram');
      expect(result.category).toBe('REACTIONS');
    });

    it('classifies boosts with subscription note as BOOSTS, not SUBSCRIBERS', async () => {
      const { SmartAnalyzerLogic } = await import('@/services/providers/smart-analyzer.logic');
      const result = SmartAnalyzerLogic.detectSync('Telegram Бусты для канала (подписка)', 'Telegram');
      expect(result.category).toBe('BOOSTS');
    });

    it('classifies stars with subscription note as STARS, not SUBSCRIBERS', async () => {
      const { SmartAnalyzerLogic } = await import('@/services/providers/smart-analyzer.logic');
      const result = SmartAnalyzerLogic.detectSync('Telegram Звезды для новых постов (Подписка)', 'Telegram');
      expect(result.category).toBe('STARS');
    });

    it('correctly classifies real subscribers as SUBSCRIBERS', async () => {
      const { SmartAnalyzerLogic } = await import('@/services/providers/smart-analyzer.logic');
      const result = SmartAnalyzerLogic.detectSync('Telegram живые подписчики с рекламы [Россия]', 'Telegram');
      expect(result.category).toBe('SUBSCRIBERS');
    });
  });
});

