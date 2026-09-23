'use server';

// ==============================================================
// Telegram Enterprise Server Actions (OmniSMM 1.0 Facade)
// OWASP Top 10 2025 Compliant
// Decomposed into domain modules in './telegram-bot/'
// ==============================================================

import type { TelegramBotDiagnostics } from '@/types/telegram';
export type { TelegramBotDiagnostics };

import {
  getTelegramBotDiagnosticsAction as _getTelegramBotDiagnosticsAction,
  resetTelegramWebhookAction as _resetTelegramWebhookAction,
  sendTelegramTestAlertAction as _sendTelegramTestAlertAction,
  updateTelegramBotSettingsAction as _updateTelegramBotSettingsAction,
} from './telegram-bot/bot-diagnostics-actions';

import {
  listTelegramButtonsAction as _listTelegramButtonsAction,
  createTelegramButtonAction as _createTelegramButtonAction,
  updateTelegramButtonAction as _updateTelegramButtonAction,
  deleteTelegramButtonAction as _deleteTelegramButtonAction,
  reorderTelegramButtonsAction as _reorderTelegramButtonsAction,
} from './telegram-bot/bot-buttons-actions';

import {
  listTelegramTemplatesAction as _listTelegramTemplatesAction,
  getTelegramTemplateAction as _getTelegramTemplateAction,
  createTelegramTemplateAction as _createTelegramTemplateAction,
  updateTelegramTemplateAction as _updateTelegramTemplateAction,
  deleteTelegramTemplateAction as _deleteTelegramTemplateAction,
} from './telegram-bot/bot-templates-actions';

import {
  getTelegramEnterpriseConfigAction as _getTelegramEnterpriseConfigAction,
  saveTelegramMenuConfigAction as _saveTelegramMenuConfigAction,
  saveTelegramRatingReasonsAction as _saveTelegramRatingReasonsAction,
  saveTelegramTemplatesAction as _saveTelegramTemplatesAction,
} from './telegram-bot/bot-enterprise-config-actions';

import {
  listTelegramProxiesAction as _listTelegramProxiesAction,
  createTelegramProxyAction as _createTelegramProxyAction,
  updateTelegramProxyAction as _updateTelegramProxyAction,
  deleteTelegramProxyAction as _deleteTelegramProxyAction,
  testTelegramProxyAction as _testTelegramProxyAction,
  setActiveTelegramProxyAction as _setActiveTelegramProxyAction,
} from './telegram-bot/bot-proxies-actions';

import {
  listTelegramErrorsAction as _listTelegramErrorsAction,
  resolveTelegramErrorAction as _resolveTelegramErrorAction,
  massResolveTelegramErrorsAction as _massResolveTelegramErrorsAction,
  deleteTelegramErrorAction as _deleteTelegramErrorAction,
  logTelegramError as _logTelegramError,
} from './telegram-bot/bot-errors-actions';

import {
  getTelegramStatsAction as _getTelegramStatsAction,
  updateTelegramSecurityAction as _updateTelegramSecurityAction,
  getTicketFeedbackStatsAction as _getTicketFeedbackStatsAction,
  getTicketFeedbackListAction as _getTicketFeedbackListAction,
} from './telegram-bot/bot-stats-and-feedback-actions';

// ── Diagnostics Actions ──
export async function getTelegramBotDiagnosticsAction(...args: Parameters<typeof _getTelegramBotDiagnosticsAction>) {
  return _getTelegramBotDiagnosticsAction(...args);
}
export async function resetTelegramWebhookAction(...args: Parameters<typeof _resetTelegramWebhookAction>) {
  return _resetTelegramWebhookAction(...args);
}
export async function sendTelegramTestAlertAction(...args: Parameters<typeof _sendTelegramTestAlertAction>) {
  return _sendTelegramTestAlertAction(...args);
}
export async function updateTelegramBotSettingsAction(...args: Parameters<typeof _updateTelegramBotSettingsAction>) {
  return _updateTelegramBotSettingsAction(...args);
}

// ── Button Actions ──
export async function listTelegramButtonsAction(...args: Parameters<typeof _listTelegramButtonsAction>) {
  return _listTelegramButtonsAction(...args);
}
export async function createTelegramButtonAction(...args: Parameters<typeof _createTelegramButtonAction>) {
  return _createTelegramButtonAction(...args);
}
export async function updateTelegramButtonAction(...args: Parameters<typeof _updateTelegramButtonAction>) {
  return _updateTelegramButtonAction(...args);
}
export async function deleteTelegramButtonAction(...args: Parameters<typeof _deleteTelegramButtonAction>) {
  return _deleteTelegramButtonAction(...args);
}
export async function reorderTelegramButtonsAction(...args: Parameters<typeof _reorderTelegramButtonsAction>) {
  return _reorderTelegramButtonsAction(...args);
}

// ── Template Actions ──
export async function listTelegramTemplatesAction(...args: Parameters<typeof _listTelegramTemplatesAction>) {
  return _listTelegramTemplatesAction(...args);
}
export async function getTelegramTemplateAction(...args: Parameters<typeof _getTelegramTemplateAction>) {
  return _getTelegramTemplateAction(...args);
}
export async function createTelegramTemplateAction(...args: Parameters<typeof _createTelegramTemplateAction>) {
  return _createTelegramTemplateAction(...args);
}
export async function updateTelegramTemplateAction(...args: Parameters<typeof _updateTelegramTemplateAction>) {
  return _updateTelegramTemplateAction(...args);
}
export async function deleteTelegramTemplateAction(...args: Parameters<typeof _deleteTelegramTemplateAction>) {
  return _deleteTelegramTemplateAction(...args);
}

// ── Enterprise Config Actions ──
export async function getTelegramEnterpriseConfigAction(...args: Parameters<typeof _getTelegramEnterpriseConfigAction>) {
  return _getTelegramEnterpriseConfigAction(...args);
}
export async function saveTelegramMenuConfigAction(...args: Parameters<typeof _saveTelegramMenuConfigAction>) {
  return _saveTelegramMenuConfigAction(...args);
}
export async function saveTelegramRatingReasonsAction(...args: Parameters<typeof _saveTelegramRatingReasonsAction>) {
  return _saveTelegramRatingReasonsAction(...args);
}
export async function saveTelegramTemplatesAction(...args: Parameters<typeof _saveTelegramTemplatesAction>) {
  return _saveTelegramTemplatesAction(...args);
}

// ── Proxy Actions ──
export async function listTelegramProxiesAction(...args: Parameters<typeof _listTelegramProxiesAction>) {
  return _listTelegramProxiesAction(...args);
}
export async function createTelegramProxyAction(...args: Parameters<typeof _createTelegramProxyAction>) {
  return _createTelegramProxyAction(...args);
}
export async function updateTelegramProxyAction(...args: Parameters<typeof _updateTelegramProxyAction>) {
  return _updateTelegramProxyAction(...args);
}
export async function deleteTelegramProxyAction(...args: Parameters<typeof _deleteTelegramProxyAction>) {
  return _deleteTelegramProxyAction(...args);
}
export async function testTelegramProxyAction(...args: Parameters<typeof _testTelegramProxyAction>) {
  return _testTelegramProxyAction(...args);
}
export async function setActiveTelegramProxyAction(...args: Parameters<typeof _setActiveTelegramProxyAction>) {
  return _setActiveTelegramProxyAction(...args);
}

// ── Error Actions ──
export async function listTelegramErrorsAction(...args: Parameters<typeof _listTelegramErrorsAction>) {
  return _listTelegramErrorsAction(...args);
}
export async function resolveTelegramErrorAction(...args: Parameters<typeof _resolveTelegramErrorAction>) {
  return _resolveTelegramErrorAction(...args);
}
export async function massResolveTelegramErrorsAction(...args: Parameters<typeof _massResolveTelegramErrorsAction>) {
  return _massResolveTelegramErrorsAction(...args);
}
export async function deleteTelegramErrorAction(...args: Parameters<typeof _deleteTelegramErrorAction>) {
  return _deleteTelegramErrorAction(...args);
}
export async function logTelegramError(...args: Parameters<typeof _logTelegramError>) {
  return _logTelegramError(...args);
}

// ── Stats, Security & Feedback Actions ──
export async function getTelegramStatsAction(...args: Parameters<typeof _getTelegramStatsAction>) {
  return _getTelegramStatsAction(...args);
}
export async function updateTelegramSecurityAction(...args: Parameters<typeof _updateTelegramSecurityAction>) {
  return _updateTelegramSecurityAction(...args);
}
export async function getTicketFeedbackStatsAction(...args: Parameters<typeof _getTicketFeedbackStatsAction>) {
  return _getTicketFeedbackStatsAction(...args);
}
export async function getTicketFeedbackListAction(...args: Parameters<typeof _getTicketFeedbackListAction>) {
  return _getTicketFeedbackListAction(...args);
}
