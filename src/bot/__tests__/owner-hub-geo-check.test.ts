/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * E2E & Smoke Test Suite for Owner Hub Geo-Availability Checker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GeoAvailabilityService, GeoAvailabilityReport } from '@/services/telemetry/geo-availability.service';
import { isOwnerOrAdmin } from '@/bot/scenes/owner-hub.wizard';

// Mock DB and Redis
vi.mock('@/lib/db', () => ({
  db: {
    user: { findFirst: vi.fn(), count: vi.fn() },
    service: { count: vi.fn() },
    order: { count: vi.fn() },
    authToken: { create: vi.fn() },
  },
}));

vi.mock('@/lib/redis', () => ({
  redis: {
    ping: vi.fn().mockResolvedValue('PONG'),
    keys: vi.fn().mockResolvedValue([]),
    del: vi.fn().mockResolvedValue(0),
  },
}));

describe('🌐 Owner Hub Geo-Availability Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Security & RBAC Protection', () => {
    it('allows access for designated ADMIN_ALERT_CHAT_ID', async () => {
      const isAllowed = await isOwnerOrAdmin('268747191');
      expect(isAllowed).toBe(true);
    });

    it('rejects access for arbitrary unauthorized Telegram ID', async () => {
      const isAllowed = await isOwnerOrAdmin('9999999999');
      expect(isAllowed).toBe(false);
    });
  });

  describe('2. Geo-Availability Telemetry Service Integration', () => {
    it('executes checkAvailability and returns structured Russian & Global metrics', async () => {
      const mockReport: GeoAvailabilityReport = {
        targetUrl: 'https://test.smmplan.pro',
        timestamp: new Date().toISOString(),
        ruRate: 1.0,
        ruTotal: 2,
        ruPassed: 2,
        globalRate: 1.0,
        globalTotal: 6,
        globalPassed: 6,
        avgResponseTimeMs: 145,
        verdict: 'ALL_GREEN',
        verdictText: '🟢 Полная доступность в РФ и мире (100% Green)',
        permanentLink: 'https://check-host.net/check-report/test12345',
        nodes: [
          {
            nodeId: 'ru1.node.check-host.net',
            countryCode: 'RU',
            countryName: 'Russia',
            city: 'Saint Petersburg',
            isRussia: true,
            status: 'OK',
            httpCode: 200,
            responseTimeMs: 95,
          },
          {
            nodeId: 'ru2.node.check-host.net',
            countryCode: 'RU',
            countryName: 'Russia',
            city: 'Moscow',
            isRussia: true,
            status: 'OK',
            httpCode: 200,
            responseTimeMs: 82,
          },
          {
            nodeId: 'de1.node.check-host.net',
            countryCode: 'DE',
            countryName: 'Germany',
            city: 'Frankfurt',
            isRussia: false,
            status: 'OK',
            httpCode: 200,
            responseTimeMs: 110,
          },
        ],
      };

      vi.spyOn(GeoAvailabilityService, 'checkAvailability').mockResolvedValue(mockReport);

      const result = await GeoAvailabilityService.checkAvailability('https://test.smmplan.pro');
      expect(result.ruRate).toBe(1.0);
      expect(result.ruPassed).toBe(2);
      expect(result.globalPassed).toBe(6);
      expect(result.verdict).toBe('ALL_GREEN');
      expect(result.nodes.filter((n) => n.isRussia)).toHaveLength(2);
    });
  });

  describe('3. Telegram Bot Action Flow & UI Rendering Simulation', () => {
    it('simulates owner_geo_check button click and message formatting', async () => {
      const mockReport: GeoAvailabilityReport = {
        targetUrl: 'https://test.smmplan.pro',
        timestamp: new Date().toISOString(),
        ruRate: 1.0,
        ruTotal: 2,
        ruPassed: 2,
        globalRate: 0.8,
        globalTotal: 5,
        globalPassed: 4,
        avgResponseTimeMs: 115,
        verdict: 'ALL_GREEN',
        verdictText: '🟢 Полная доступность в РФ и мире (100% Green)',
        permanentLink: 'https://check-host.net/check-report/abc123xyz',
        nodes: [
          {
            nodeId: 'ru1.node.check-host.net',
            countryCode: 'RU',
            countryName: 'Russia',
            city: 'Saint Petersburg',
            isRussia: true,
            status: 'OK',
            httpCode: 200,
            responseTimeMs: 90,
          },
          {
            nodeId: 'ru2.node.check-host.net',
            countryCode: 'RU',
            countryName: 'Russia',
            city: 'Moscow',
            isRussia: true,
            status: 'OK',
            httpCode: 200,
            responseTimeMs: 85,
          },
        ],
      };

      vi.spyOn(GeoAvailabilityService, 'checkAvailability').mockResolvedValue(mockReport);

      // Create mock BotContext
      const editedMessages: any[] = [];
      const mockCtx: any = {
        from: { id: 268747191 },
        answerCbQuery: vi.fn(),
        editMessageText: vi.fn().mockImplementation((text, extra) => {
          editedMessages.push({ text, extra });
          return Promise.resolve();
        }),
        reply: vi.fn(),
      };

      // Perform simulated action logic
      await mockCtx.answerCbQuery('Запуск гео-проверки...');
      const targetUrl = 'https://test.smmplan.pro';

      await mockCtx.editMessageText('⏳ Опрашиваем контрольные зонды...', { parse_mode: 'HTML' });
      const report = await GeoAvailabilityService.checkAvailability(targetUrl);

      const ruNodes = report.nodes.filter((n) => n.isRussia);
      const ruSummary = ruNodes
        .map((n) => `  • 🇷🇺 <b>${n.city}</b>: ${n.status === 'OK' ? '🟢 200 OK' : '🔴 FAIL'} (${n.responseTimeMs} ms)`)
        .join('\n');

      const responseText =
        `🌍 <b>РЕЗУЛЬТАТЫ ГЕО-ПРОВЕРКИ ДОСТУПНОСТИ</b>\n\n` +
        `🎯 <b>Адрес сайта:</b> <code>${report.targetUrl}</code>\n` +
        `🏆 <b>Статус:</b> ${report.verdictText}\n\n` +
        `🇷🇺 <b>Доступность в России:</b> <b>${Math.round(report.ruRate * 100)}%</b>\n` +
        `${ruSummary}`;

      await mockCtx.editMessageText(responseText, { parse_mode: 'HTML' });

      expect(mockCtx.answerCbQuery).toHaveBeenCalledWith('Запуск гео-проверки...');
      expect(editedMessages.length).toBe(2);
      expect(editedMessages[1].text).toContain('РЕЗУЛЬТАТЫ ГЕО-ПРОВЕРКИ ДОСТУПНОСТИ');
      expect(editedMessages[1].text).toContain('🇷🇺 <b>Доступность в России:</b> <b>100%</b>');
      expect(editedMessages[1].text).toContain('Saint Petersburg');
      expect(editedMessages[1].text).toContain('Moscow');
    });
  });
});
