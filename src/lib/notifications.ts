/**
 * Lightweight Telegram Bot notification service for critical admin alerts.
 * Uses raw fetch() — no external dependencies required.
 * 
 * Setup:
 * 1. Create a bot via @BotFather
 * 2. Create a private channel/group for alerts
 * 3. Add bot to the channel as admin
 * 4. Set ADMIN_ALERT_BOT_TOKEN and ADMIN_ALERT_CHAT_ID in .env
 */

function getTelegramConfig() {
  const token = process.env.ADMIN_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_ALERT_CHAT_ID;
  if (!chatId && process.env.NODE_ENV === 'production' && process.env.APP_ENV !== 'test') {
    console.error('🚨 [SECURITY CONFIG] ADMIN_ALERT_CHAT_ID is missing in production environment!');
  }
  return { token, chatId };
}

type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

const SEVERITY_EMOJI: Record<AlertSeverity, string> = {
  INFO: 'ℹ️',
  WARNING: '⚠️',
  CRITICAL: '🚨',
};

import { telegramQueue } from '@/lib/queue-manager';
import { EmergencyEmailService } from '@/lib/emergency-email';

/**
 * Queues or dispatches a formatted alert to the admin Telegram channel.
 * Non-blocking (fire-and-forget). Never throws.
 */
export function sendAdminAlert(message: string, severity: AlertSeverity = 'INFO', tenantId?: string | null) {
  const { token, chatId } = getTelegramConfig();
  if (!token || !chatId) {
    // If Telegram not configured, send directly via Email for CRITICAL/WARNING
    if (severity === 'CRITICAL' || severity === 'WARNING') {
      EmergencyEmailService.sendAlert({
        severity,
        title: `[${severity}] OmniSMM Alert (Telegram Unset)`,
        details: message,
      }).catch(() => {});
    }
    return;
  }
  
  // Direct async dispatch ensures alerts arrive immediately even if BullMQ worker is paused
  sendAdminAlertSync(message, severity, tenantId).catch((err) => {
    console.error('[NotificationService] Failed to dispatch Telegram alert:', err);
  });
}

import { ErrorInterpreter } from '@/lib/telemetry/error-interpreter';

/**
 * Worker-only method to actually execute the HTTP request to Telegram.
 */
export async function sendAdminAlertSync(message: string, severity: AlertSeverity = 'INFO', tenantId?: string | null) {
  const { token, chatId } = getTelegramConfig();
  
  // Multi-Channel Cascade: Always send emergency email for CRITICAL incidents
  if (severity === 'CRITICAL') {
    EmergencyEmailService.sendAlert({
      severity: 'CRITICAL',
      title: 'P0 Critical Incident Detected',
      details: message,
    }).catch((err) => {
      console.error('[NotificationService] Emergency email cascade failed:', err);
    });
  }

  if (!token || !chatId) {
    if (severity === 'CRITICAL' || severity === 'WARNING') {
      await EmergencyEmailService.sendAlert({
        severity,
        title: `[${severity}] OmniSMM Alert (Telegram Unset)`,
        details: message,
      }).catch(() => {});
    }
    return;
  }

  try {
    const text = message.startsWith('🚨 <b>[P0 CRITICAL:')
      ? message
      : ErrorInterpreter.formatTelegramMessage(message, severity, tenantId);

    const { getTelegramDispatcher } = await import('@/lib/telegram-agent');
    const dispatcher = getTelegramDispatcher();

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // @ts-expect-error Node.js undici dispatcher support
      dispatcher,
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error(`[NotificationService] Telegram API error (${res.status}):`, errBody);

      await EmergencyEmailService.sendAlert({
        severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
        title: `Telegram Delivery Failed (${res.status})`,
        details: `${message}\n\nTelegram Error Details: ${errBody}`,
      }).catch(() => {});
    }
  } catch (err: unknown) {
    console.error('[NotificationService] Telegram alert sync failed:', err);
    await EmergencyEmailService.sendAlert({
      severity: severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
      title: 'Telegram Network Connection Error',
      details: `${message}\n\nNetwork Error: ${(err as Error).message}`,
    }).catch(() => {});
  }
}

export interface P0EmergencyAlertPayload {
  code: string;
  title: string;
  details: string;
  actionPlan: string;
}

/**
 * High-Priority P0 Emergency Alert Dispatcher.
 * Formats structured alert with Title, Threat Details, and Actionable Plan.
 */
export async function sendP0EmergencyAlert(payload: P0EmergencyAlertPayload): Promise<void> {
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const formattedMessage = [
    `🚨 <b>[P0 CRITICAL: ${escapeHtml(payload.code)}]</b>`,
    `<b>${escapeHtml(payload.title)}</b>\n`,
    `⚠️ <b>Угроза бизнесу:</b>\n${escapeHtml(payload.details)}\n`,
    `🛠️ <b>Что сделать (Action Plan):</b>\n${escapeHtml(payload.actionPlan)}`,
  ].join('\n');

  sendAdminAlert(formattedMessage, 'CRITICAL');
}

