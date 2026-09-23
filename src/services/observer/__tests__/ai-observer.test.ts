import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiObserverSanitizer, type RawObserverPayload } from '../ai-observer-sanitizer';
import { AiObserverService } from '../ai-observer.service';

describe('AiObserverSanitizer (Zero-Data-Leak Guard)', () => {
  it('should completely strip emails, IP addresses, tokens and UUIDs', () => {
    const dirtyText = 'User john.doe@smmplan.ru from 192.168.1.55 with token Bearer secret_token_1234567890abcdef and uuid 123e4567-e89b-12d3-a456-426614174000';
    const cleaned = AiObserverSanitizer.cleanText(dirtyText);

    expect(cleaned).not.toContain('john.doe@smmplan.ru');
    expect(cleaned).toContain('[EMAIL_REDACTED]');

    expect(cleaned).not.toContain('192.168.1.55');
    expect(cleaned).toContain('[IP_REDACTED]');

    expect(cleaned).not.toContain('secret_token_1234567890abcdef');
    expect(cleaned).toContain('[TOKEN_REDACTED]');

    expect(cleaned).not.toContain('123e4567-e89b-12d3-a456-426614174000');
    expect(cleaned).toContain('[UUID_REDACTED]');
  });

  it('should cleanly sanitize full aggregated payload into safe immutable DTO', () => {
    const rawPayload: RawObserverPayload = {
      period: '2026-08-25 from admin@smmplan.pro',
      financials: {
        grossRevenueRub: 452300.75,
        cogsRub: 248100.25,
        netProfitRub: 204200.5,
        marginPercent: 45.148,
        ledgerDiscrepanciesCount: 0,
      },
      operations: {
        totalOrders: 3410,
        completedOrders: 3212,
        canceledOrders: 198,
        successRatePercent: 94.193,
        stormAlertsCount: 1,
        problematicProviders: [
          { name: 'Vexboost (key: secret_12345678901234567890)', category: 'Telegram Views', failureRate: 28 },
        ],
      },
      support: {
        openedTickets: 14,
        closedTickets: 13,
        avgFirstResponseMin: 4.23,
        escalatedCount: 1,
      },
      security: {
        blockedIntrusions24h: 8,
        criticalEvents: 0,
        uniqueAttackIpsCount: 3,
      },
    };

    const sanitized = AiObserverSanitizer.sanitizePayload(rawPayload);

    expect(sanitized.period).toContain('[EMAIL_REDACTED]');
    expect(sanitized.financials.grossRevenueRub).toBe(452301);
    expect(sanitized.financials.marginPercent).toBe(45.1);
    expect(sanitized.operations.problematicProviders[0].name).not.toContain('secret_12345678901234567890');
    expect(sanitized.operations.problematicProviders[0].name).toContain('[TOKEN_REDACTED]');
  });
});

describe('AiObserverService (Deterministic Fallback & Fail-Safe)', () => {
  const mockPayload: RawObserverPayload = {
    period: '2026-08-25 - 2026-08-26',
    financials: {
      grossRevenueRub: 500000,
      cogsRub: 250000,
      netProfitRub: 250000,
      marginPercent: 50.0,
      ledgerDiscrepanciesCount: 0,
    },
    operations: {
      totalOrders: 2000,
      completedOrders: 1900,
      canceledOrders: 100,
      successRatePercent: 95.0,
      stormAlertsCount: 0,
      problematicProviders: [],
    },
    support: {
      openedTickets: 10,
      closedTickets: 10,
      avgFirstResponseMin: 3.5,
      escalatedCount: 0,
    },
    security: {
      blockedIntrusions24h: 5,
      criticalEvents: 0,
      uniqueAttackIpsCount: 2,
    },
  };

  it('should generate valid deterministic fallback HTML report from raw metrics', () => {
    const report = AiObserverService.generateFallbackReport(mockPayload).replace(/\u00A0/g, ' ');

    expect(report).toContain('🌅 <b>[SMMpanel 1.0] Утренний Дайджест за 2026-08-25 - 2026-08-26</b>');
    expect(report).toContain('Выручка: 500 000 ₽');
    expect(report).toContain('Чистая прибыль: <b>+250 000 ₽</b>');
    expect(report).toContain('Маржа: 50%');
    expect(report).toContain('100% сходится (0 расхождений)');
    expect(report).toContain('Заказов: 2 000');
    expect(report).toContain('Атак отражено: 5');
  });

  it('should respect Master Kill-Switch and return early without LLM calls when disabled', async () => {
    vi.spyOn(AiObserverService, 'isKillswitchActive').mockResolvedValue(true);

    const result = await AiObserverService.runObserverPipeline({ forceRun: false });

    expect(result.success).toBe(false);
    expect(result.isKillswitchActive).toBe(true);
    expect(result.source).toBe('DISABLED');
    expect(result.digestMarkdown).toContain('отключен в системных настройках');
  });
});
