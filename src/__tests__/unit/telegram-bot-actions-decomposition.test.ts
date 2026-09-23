import { describe, it, expect } from 'vitest';
import * as telegramBotActions from '@/actions/admin/telegram-bot';

describe('Wave 24: Telegram Bot Actions Decomposition (CDD-TDD)', () => {
  it('should export all diagnostics actions', () => {
    expect(typeof telegramBotActions.getTelegramBotDiagnosticsAction).toBe('function');
    expect(typeof telegramBotActions.resetTelegramWebhookAction).toBe('function');
    expect(typeof telegramBotActions.sendTelegramTestAlertAction).toBe('function');
    expect(typeof telegramBotActions.updateTelegramBotSettingsAction).toBe('function');
  });

  it('should export all button actions', () => {
    expect(typeof telegramBotActions.listTelegramButtonsAction).toBe('function');
    expect(typeof telegramBotActions.createTelegramButtonAction).toBe('function');
    expect(typeof telegramBotActions.updateTelegramButtonAction).toBe('function');
    expect(typeof telegramBotActions.deleteTelegramButtonAction).toBe('function');
    expect(typeof telegramBotActions.reorderTelegramButtonsAction).toBe('function');
  });

  it('should export all template and enterprise config actions', () => {
    expect(typeof telegramBotActions.listTelegramTemplatesAction).toBe('function');
    expect(typeof telegramBotActions.getTelegramTemplateAction).toBe('function');
    expect(typeof telegramBotActions.createTelegramTemplateAction).toBe('function');
    expect(typeof telegramBotActions.updateTelegramTemplateAction).toBe('function');
    expect(typeof telegramBotActions.deleteTelegramTemplateAction).toBe('function');
    expect(typeof telegramBotActions.getTelegramEnterpriseConfigAction).toBe('function');
    expect(typeof telegramBotActions.saveTelegramMenuConfigAction).toBe('function');
    expect(typeof telegramBotActions.saveTelegramRatingReasonsAction).toBe('function');
    expect(typeof telegramBotActions.saveTelegramTemplatesAction).toBe('function');
  });

  it('should export all proxy actions', () => {
    expect(typeof telegramBotActions.listTelegramProxiesAction).toBe('function');
    expect(typeof telegramBotActions.createTelegramProxyAction).toBe('function');
    expect(typeof telegramBotActions.updateTelegramProxyAction).toBe('function');
    expect(typeof telegramBotActions.deleteTelegramProxyAction).toBe('function');
    expect(typeof telegramBotActions.testTelegramProxyAction).toBe('function');
    expect(typeof telegramBotActions.setActiveTelegramProxyAction).toBe('function');
  });

  it('should export all stats, error, feedback and security actions', () => {
    expect(typeof telegramBotActions.getTelegramStatsAction).toBe('function');
    expect(typeof telegramBotActions.listTelegramErrorsAction).toBe('function');
    expect(typeof telegramBotActions.resolveTelegramErrorAction).toBe('function');
    expect(typeof telegramBotActions.massResolveTelegramErrorsAction).toBe('function');
    expect(typeof telegramBotActions.deleteTelegramErrorAction).toBe('function');
    expect(typeof telegramBotActions.logTelegramError).toBe('function');
    expect(typeof telegramBotActions.updateTelegramSecurityAction).toBe('function');
    expect(typeof telegramBotActions.getTicketFeedbackStatsAction).toBe('function');
    expect(typeof telegramBotActions.getTicketFeedbackListAction).toBe('function');
  });
});
