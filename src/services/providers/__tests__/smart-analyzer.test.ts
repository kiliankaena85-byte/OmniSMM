import { describe, it, expect } from 'vitest';
import { SmartAnalyzerLogic, DEFAULT_CATEGORY_METRICS } from '../smart-analyzer.logic';

describe('SmartAnalyzerLogic - 4-Tier Hybrid Execution Metrics', () => {
    it('should extract structured start_time, speed, and warranty from bracketed provider names and translate them to Russian', () => {
        const rawName = '🇺🇸 Instagram Followers [MIX USA] [Refill: 30D] [Start Time: 0 - 1 Hr] [Speed: 50K/D] ♻️🔥';
        const result = SmartAnalyzerLogic.detectSync(rawName, '', 'Instagram Followers');

        expect(result.platform).toBe('INSTAGRAM');
        expect(result.category).toBe('SUBSCRIBERS');
        expect(result.startTime).toBe('0–1 час');
        expect(result.speedText).toBe('до 50k / день');
        expect(result.warranty).toBe(30);
        expect(result.metrics?.hasRefill).toBe(true);
    });

    it('should extract start_time and speed from heuristic keywords in Russian', () => {
        const rawName = 'Telegram Просмотры на пост (Мгновенный старт, до 50k в день, гарантия 30 дней)';
        const result = SmartAnalyzerLogic.detectSync(rawName, '', 'Telegram Views');

        expect(result.platform).toBe('TELEGRAM');
        expect(result.category).toBe('VIEWS');
        expect(result.startTime).toBe('Мгновенно');
        expect(result.speedText).toBe('до 50k / день');
        expect(result.warranty).toBe(30);
    });

    it('should fallback to sensible category defaults when provider provides bare names', () => {
        const rawName = 'Просмотры видео';
        const result = SmartAnalyzerLogic.detectSync(rawName, '', 'YouTube Views');

        expect(result.category).toBe('VIEWS');
        expect(result.startTime).toBe(DEFAULT_CATEGORY_METRICS.VIEWS.startTime);
        expect(result.speedText).toBe(DEFAULT_CATEGORY_METRICS.VIEWS.speedText);
    });

    it('should assign correct default quality tiers based on category defaults', () => {
        const rawName = 'Живые подписчики на канал';
        const result = SmartAnalyzerLogic.detectSync(rawName, '', 'Telegram Subscribers', undefined, 2.5);

        expect(result.category).toBe('SUBSCRIBERS');
        expect(result.warranty).toBe(30);
        expect(result.qualityLabel).toBe('Живые');
    });

    it('should correctly tokenize velocity with multipliers (k/d, m/d)', () => {
        const rawName = 'VK Лайки [10k/d] [Быстрый старт]';
        const result = SmartAnalyzerLogic.detectSync(rawName, '', 'VK Likes');

        expect(result.platform).toBe('VK');
        expect(result.category).toBe('LIKES');
        expect(result.speedText).toBe('до 10k / день');
    });
});
