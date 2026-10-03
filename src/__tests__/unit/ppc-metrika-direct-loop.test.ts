/**
 * src/__tests__/integration/ppc-metrika-direct-loop.test.ts
 *
 * Интеграционный тест сквозного OODA-цикла PPC Growth Agent.
 * Спецификация: docs/specs/SPEC-2026-10-01-AUTONOMOUS-PPC-GROWTH-AGENT.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import { AutonomousPpcAgent } from '@/services/ppc/autonomous-ppc-agent';
import { YandexDirectClient } from '@/services/ppc/yandex-direct-client';
import { YandexMetrikaClient } from '@/services/ppc/yandex-metrika-client';
import { ClickFraudSentinel } from '@/services/ppc/clickfraud-sentinel';
import { CroRetentionWebhook } from '@/services/ppc/cro-retention-webhook';

describe('Autonomous PPC Growth Agent — Integration OODA Loop', () => {
  const testLogFile = path.resolve(process.cwd(), '.planning', 'TEST_ACTION_DECISIONS_LOG.md');

  beforeEach(() => {
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
  });

  it('should run full OODA cycle end-to-end with mock clients', async () => {
    // 1. Mock Direct Client
    const mockDirectClient = new YandexDirectClient({ token: 'mock-token-1234567890' });
    vi.spyOn(mockDirectClient, 'isAuthorized').mockReturnValue(true);
    vi.spyOn(mockDirectClient, 'getCampaigns').mockResolvedValue([
      { Id: 101, Name: 'SMMplan Telegram Core Search', State: 'ON', Status: 'ACCEPTED' },
      { Id: 102, Name: 'SMMplan VK Search', State: 'ON', Status: 'ACCEPTED' },
    ]);
    const appendMinusSpy = vi.spyOn(mockDirectClient, 'appendMinusKeywords').mockResolvedValue(true);

    // 2. Mock Metrika Client with 10 typical phrases
    const mockMetrikaClient = new YandexMetrikaClient({ token: 'mock-token-1234567890' });
    vi.spyOn(mockMetrikaClient, 'isAuthorized').mockReturnValue(true);
    vi.spyOn(mockMetrikaClient, 'getSearchPhrasesWithBounceRate').mockResolvedValue([
      {
        phrase: 'купить подписчиков телеграм дешево',
        visits: 42,
        bounceRate: 15.0,
        pageviews: 120,
        avgDurationSeconds: 110,
        isHighBounce: false,
      },
      {
        phrase: 'продвижение сообщества вк панель',
        visits: 25,
        bounceRate: 20.0,
        pageviews: 65,
        avgDurationSeconds: 95,
        isHighBounce: false,
      },
      {
        phrase: 'скачать бесплатно взлом подписчиков apk',
        visits: 14,
        bounceRate: 92.0,
        pageviews: 14,
        avgDurationSeconds: 2,
        isHighBounce: true,
      },
      {
        phrase: 'смотреть фильм безумный макс бесплатно онлайн',
        visits: 8,
        bounceRate: 100.0,
        pageviews: 8,
        avgDurationSeconds: 1,
        isHighBounce: true,
      },
      {
        phrase: 'работа ставить лайки без вложений клики',
        visits: 18,
        bounceRate: 85.0,
        pageviews: 20,
        avgDurationSeconds: 3,
        isHighBounce: true,
      },
    ]);

    // 3. Mock Sentinel & CRO Webhook
    const sentinel = new ClickFraudSentinel();
    const croWebhook = new CroRetentionWebhook();
    vi.spyOn(croWebhook, 'findZeroBalanceRegistrations').mockResolvedValue([]);

    // 4. Initialize Agent
    const agent = new AutonomousPpcAgent({
      directClient: mockDirectClient,
      metrikaClient: mockMetrikaClient,
      clickFraudSentinel: sentinel,
      croWebhook,
      maxDailyBudgetRub: 4000,
      logFilePath: testLogFile,
    });

    // 5. Execute Cycle in Live Mode (!dryRun)
    const result = await agent.runOodaCycle({ dryRun: false });

    // Assertions:
    expect(result.campaignsAnalyzed).toBe(2);
    expect(result.phrasesAnalyzed).toBe(5);
    expect(result.commercialPhrasesCount).toBeGreaterThanOrEqual(2);

    // Negative keywords identified:
    expect(result.newMinusWordsIdentified).toEqual(
      expect.arrayContaining(['бесплатно', 'взлом', 'фильм'])
    );

    // Click fraud alert detected for high bounce short visits:
    expect(result.clickFraudAlerts.length).toBeGreaterThanOrEqual(1);

    // Direct API appendMinusKeywords should be called for both campaigns:
    expect(appendMinusSpy).toHaveBeenCalledTimes(2);
    expect(appendMinusSpy).toHaveBeenCalledWith(
      101,
      expect.arrayContaining(['бесплатно', 'взлом', 'фильм'])
    );

    // Audit log should be written to test log file:
    expect(fs.existsSync(testLogFile)).toBe(true);
    const logContent = fs.readFileSync(testLogFile, 'utf8');
    expect(logContent).toContain('Autonomous PPC Cycle');
    expect(logContent).toContain('Commercial Phrases');

    // Clean up
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
  });

  it('should not call Direct API mutations when running in dry-run mode', async () => {
    const mockDirectClient = new YandexDirectClient({ token: 'mock-token-1234567890' });
    vi.spyOn(mockDirectClient, 'isAuthorized').mockReturnValue(true);
    vi.spyOn(mockDirectClient, 'getCampaigns').mockResolvedValue([
      { Id: 101, Name: 'SMMplan Telegram Core Search', State: 'ON', Status: 'ACCEPTED' },
    ]);
    const appendMinusSpy = vi.spyOn(mockDirectClient, 'appendMinusKeywords').mockResolvedValue(true);

    const mockMetrikaClient = new YandexMetrikaClient({ token: 'mock-token-1234567890' });
    vi.spyOn(mockMetrikaClient, 'isAuthorized').mockReturnValue(true);
    vi.spyOn(mockMetrikaClient, 'getSearchPhrasesWithBounceRate').mockResolvedValue([
      {
        phrase: 'скачать бесплатно взлом',
        visits: 5,
        bounceRate: 100.0,
        pageviews: 5,
        avgDurationSeconds: 1,
        isHighBounce: true,
      },
    ]);

    const croWebhook = new CroRetentionWebhook();
    vi.spyOn(croWebhook, 'findZeroBalanceRegistrations').mockResolvedValue([]);

    const agent = new AutonomousPpcAgent({
      directClient: mockDirectClient,
      metrikaClient: mockMetrikaClient,
      croWebhook,
      logFilePath: testLogFile,
    });

    const result = await agent.runOodaCycle({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(appendMinusSpy).not.toHaveBeenCalled();

    // Clean up
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile);
    }
  });
});
