import { EmergencyEmailService } from '@/lib/emergency-email';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'DirectEmergencyAlertService' });

export interface AlertOptions {
  title: string;
  details: string;
  severity?: 'WARNING' | 'CRITICAL';
  metadata?: Record<string, unknown>;
  cooldownKey?: string;
  cooldownMs?: number;
}

export class DirectEmergencyAlertService {
  private static alertCooldowns = new Map<string, { lastSent: number; suppressedCount: number }>();
  private static readonly DEFAULT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Dispatches a direct emergency alert across multiple channels (Telegram + Email)
   * Completely bypasses BullMQ and Redis queues to avoid circular failures.
   */
  static async sendAlert(options: AlertOptions): Promise<{ success: boolean; suppressed?: boolean }> {
    const {
      title,
      details,
      severity = 'CRITICAL',
      metadata,
      cooldownKey = title,
      cooldownMs = this.DEFAULT_COOLDOWN_MS
    } = options;

    const now = Date.now();
    const existing = this.alertCooldowns.get(cooldownKey);

    if (existing && now - existing.lastSent < cooldownMs) {
      existing.suppressedCount++;
      log.info(`[DirectAlert] Alert '${cooldownKey}' suppressed by cooldown. Suppressed count: ${existing.suppressedCount}`);
      return { success: true, suppressed: true };
    }

    const suppressedInfo = existing && existing.suppressedCount > 0
      ? `\n<i>(Подавлено повторов за 5 мин: ${existing.suppressedCount})</i>`
      : '';

    this.alertCooldowns.set(cooldownKey, { lastSent: now, suppressedCount: 0 });

    const moscowTime = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const emoji = severity === 'CRITICAL' ? '🚨' : '⚠️';

    // 1. Direct Telegram Notification via HTTP Fetch
    const telegramSuccess = await this.sendDirectTelegram({
      title,
      details: details + suppressedInfo,
      severity,
      moscowTime,
      metadata
    });

    // 2. Direct SMTP Email Notification (P0 Cascade)
    if (severity === 'CRITICAL') {
      EmergencyEmailService.sendAlert({
        severity,
        title: `${emoji} [${severity}] ${title}`,
        details: `${details}${suppressedInfo}\n\nВремя: ${moscowTime} МСК`,
        metadata
      }).catch((err) => {
        log.error('[DirectAlert] Emergency email cascade failed:', { err });
      });
    }

    return { success: telegramSuccess };
  }

  /**
   * Specialized alert: Worker Process is Down or Heartbeat Missing
   */
  static async sendWorkerDownAlert(lastSeenSeconds: number | null, waitingJobsCount: number): Promise<void> {
    const timeStr = lastSeenSeconds !== null ? `${lastSeenSeconds} сек назад` : 'никогда';
    await this.sendAlert({
      cooldownKey: 'worker_down_alert',
      severity: 'CRITICAL',
      title: 'ФОНОВЫЙ ВОРКЕР ОЧЕРЕДЕЙ ОСТАНОВЛЕН ИЛИ ЗАВИС',
      details: `Воркер очередей (smmplan_lite_worker) перестал обновлять пульс!\n` +
        `• Последний heartbeat: ${timeStr}\n` +
        `• Заказов в очереди ожидания: ${waitingJobsCount}\n` +
        `• Влияние: Новые заказы клиентов не отправляются провайдерам!\n` +
        `• Рекомендуемое действие: Проверить логи контейнера (docker logs smmplan_lite_worker) и статус Redis.`,
      metadata: { lastSeenSeconds, waitingJobsCount }
    });
  }

  /**
   * Specialized alert: Orders stuck in PENDING queue
   */
  static async sendStuckOrdersAlert(
    stuckOrdersCount: number,
    oldestOrderMinutes: number,
    sampleOrderIds: (string | number)[],
    options?: { delta?: number; isReminder?: boolean; isEscalation?: boolean }
  ): Promise<void> {
    const deltaStr = options?.delta && options.delta > 0 ? `\n• Динамика: ⚠️ Рост +${options.delta} новых заказов!` : '';
    const typeStr = options?.isReminder ? ' [НАПОМИНАНИЕ]' : (options?.isEscalation ? ' [ЭСКАЛАЦИЯ]' : '');

    if (options?.isEscalation) {
      // If escalation due to spike in stuck orders, bypass cooldown immediately
      this.alertCooldowns.delete('stuck_orders_alert');
    }

    await this.sendAlert({
      cooldownKey: 'stuck_orders_alert',
      cooldownMs: 2 * 60 * 60 * 1000, // 2 hour cooldown instead of 5m
      severity: 'CRITICAL',
      title: `ОБНАРУЖЕНЫ ЗАВИСШИЕ ЗАКАЗЫ В ОЧЕРЕДИ${typeStr}`,
      details: `Обнаружены заказы со статусом PENDING, ожидающие более ${oldestOrderMinutes} минут!\n` +
        `• Количество зависших заказов: ${stuckOrdersCount}${deltaStr}\n` +
        `• Примеры заказов: #${sampleOrderIds.join(', #')}\n` +
        `• Причина: Очередь BullMQ не вычитывается или сбоит провайдер.\n` +
        `• Рекомендуемое действие: Откройте панель заказов и проверьте состояние воркера.`,
      metadata: { stuckOrdersCount, oldestOrderMinutes, sampleOrderIds, ...options }
    });
  }

  /**
   * Specialized alert: Stuck orders resolved / queue clear
   */
  static async sendStuckOrdersResolvedAlert(clearedCount: number): Promise<void> {
    this.alertCooldowns.delete('stuck_orders_alert'); // Reset stuck orders cooldown

    await this.sendAlert({
      cooldownKey: 'stuck_orders_resolved',
      cooldownMs: 30 * 60 * 1000, // 30m cooldown
      severity: 'WARNING',
      title: 'ЗАВИСШИЕ ЗАКАЗЫ УСПЕШНО ОБРАБОТАНЫ',
      details: `Все ранее зависшие заказы (${clearedCount} шт.) успешно обработаны или отправлены поставщику.\n` +
        `• Состояние очереди: В норме (0 зависших)\n` +
        `• Инцидент исчерпан.`,
      metadata: { clearedCount }
    });
  }

  /**
   * Specialized alert: Redis connection failure
   */
  static async sendRedisFailureAlert(errorMessage: string): Promise<void> {
    await this.sendAlert({
      cooldownKey: 'redis_failure_alert',
      severity: 'CRITICAL',
      title: 'ОТКАЗ ПОДКЛЮЧЕНИЯ К REDIS',
      details: `Сервер платформы не может подключиться к Redis:\n` +
        `• Ошибка: ${errorMessage}\n` +
        `• Влияние: Очереди BullMQ, кэш каталога и сессии заблокированы!`,
      metadata: { error: errorMessage }
    });
  }

  private static async sendDirectTelegram(params: {
    title: string;
    details: string;
    severity: 'WARNING' | 'CRITICAL';
    moscowTime: string;
    metadata?: Record<string, unknown>;
  }): Promise<boolean> {
    const token = process.env.ADMIN_ALERT_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.ADMIN_ALERT_CHAT_ID;

    if (!token || !chatId) {
      log.warn('[DirectAlert] Telegram credentials not configured in environment.');
      return false;
    }

    const emoji = params.severity === 'CRITICAL' ? '🚨' : '⚠️';
    const text = `${emoji} <b>[OmniSMM 1.0 — ${params.severity}]</b>\n` +
      `<b>${params.title}</b>\n\n` +
      `${params.details}\n\n` +
      `<i>🕒 ${params.moscowTime} МСК | Сервер: ${process.env.APP_URL || 'smmplan.pro'}</i>`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        }),
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) {
        const body = await res.text();
        log.error('[DirectAlert] Telegram API responded with error:', { status: res.status, body });
        return false;
      }

      return true;
    } catch (fetchErr) {
      log.error('[DirectAlert] Direct Telegram HTTP fetch failed:', { error: (fetchErr as Error).message });
      return false;
    }
  }
}
