import 'server-only';
import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { redis } from '@/lib/redis';
import { type SecurityEvent } from '@prisma/client';

export type SecuritySeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface SecurityEventInput {
  event: string;
  severity: SecuritySeverity;
  ip?: string | null;
  tenantId?: string | null;
  details?: Record<string, unknown>;
}

export interface SecurityStatsSummary {
  total24h: number;
  critical24h: number;
  high24h: number;
  warning24h: number;
  uniqueIpsCount: number;
  topEvents: Array<{ event: string; count: number }>;
  topIps: Array<{ ip: string; count: number }>;
}

export class SecurityAlertService {
  private static readonly THROTTLE_PREFIX = 'security:alert:throttle:';
  private static readonly THROTTLE_TTL_SEC = 60; // 1 alert per minute per event+ip pair
  private static readonly STREAM_CHANNEL = 'security:events:stream';

  /**
   * Records a security event to DB, broadcasts via Redis Pub/Sub,
   * and sends an immediate Telegram alert to admins if CRITICAL/HIGH (with anti-flooding).
   */
  static async record(input: SecurityEventInput): Promise<SecurityEvent | null> {
    const { event, severity, ip, tenantId = 'smmplan', details = {} } = input;

    let created: SecurityEvent | null = null;

    try {
      if (db.securityEvent) {
        created = await db.securityEvent.create({
          data: {
            event,
            severity,
            ip: ip || null,
            tenantId: tenantId || 'smmplan',
            details: details ? (details as unknown as object) : undefined,
          },
        });
      }
    } catch (err) {
      console.error('[SecurityAlertService] Failed to insert securityEvent into DB:', err);
    }

    // 1. Broadcast to Redis Pub/Sub for live real-time admin interfaces
    try {
      const payload = JSON.stringify({
        id: created?.id || `temp-${Date.now()}`,
        event,
        severity,
        ip: ip || null,
        tenantId: tenantId || 'smmplan',
        details,
        createdAt: created?.createdAt || new Date().toISOString(),
      });
      await redis.publish(this.STREAM_CHANNEL, payload).catch(() => {});
    } catch {
      // Redis broadcast is best-effort
    }

    // 2. Real-Time Admin Alerting (Telegram) for HIGH and CRITICAL events
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      await this.dispatchRealtimeAlert(event, severity, ip, tenantId, details).catch((err) => {
        console.error('[SecurityAlertService] Failed to dispatch admin alert:', err);
      });
    }

    return created;
  }

  private static escapeHtml(str: string): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Dispatches formatted Telegram alert with anti-flooding guard.
   */
  private static async dispatchRealtimeAlert(
    event: string,
    severity: SecuritySeverity,
    ip: string | null | undefined,
    tenantId: string | null | undefined,
    details: Record<string, unknown>
  ): Promise<void> {
    const cleanIp = ip || 'unknown';
    const throttleKey = `${this.THROTTLE_PREFIX}${event}:${cleanIp}`;

    try {
      // Check if alert was recently sent for this event + ip
      const isThrottled = await redis.get(throttleKey);
      if (isThrottled) {
        // Increment suppressed count in Redis
        await redis.incr(`${throttleKey}:suppressed`).catch(() => {});
        return;
      }

      // Set lock for 60s
      await redis.set(throttleKey, '1', 'EX', this.THROTTLE_TTL_SEC);
    } catch {
      // If Redis fails, continue sending alert to ensure safety
    }

    const gateway = String(details?.gateway || details?.provider || 'api');
    const moscowTime = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
    const emoji = severity === 'CRITICAL' ? '🚨' : '⚠️';

    const safeDetailsStr = JSON.stringify(details, null, 2);
    const truncatedDetails = safeDetailsStr.length > 500 ? `${safeDetailsStr.slice(0, 500)}...` : safeDetailsStr;

    // OWASP A03 / Telegram HTML Injection Defense (P2-15)
    const cleanEvent = this.escapeHtml(event);
    const cleanGateway = this.escapeHtml(gateway);
    const cleanEscapedIp = this.escapeHtml(cleanIp);
    const cleanTenant = this.escapeHtml(tenantId || 'smmplan');
    const cleanDetails = this.escapeHtml(truncatedDetails);

    const isConfigWarning = event === 'MISCONFIGURED_WEBHOOK_SECRET';
    const alertTitle = isConfigWarning
      ? `[${severity}] ТРЕБУЕТСЯ НАСТРОЙКА: Секретный ключ ${cleanGateway.toUpperCase()}`
      : `[${severity}] ПРЕДУПРЕЖДЕНИЕ БЕЗОПАСНОСТИ: ${cleanEvent}`;

    const message = [
      `${emoji} <b>${alertTitle}</b>`,
      '',
      `<b>Событие:</b> <code>${cleanEvent}</code>`,
      `<b>Шлюз/Модуль:</b> <code>${cleanGateway}</code>`,
      `<b>IP источника:</b> <code>${cleanEscapedIp}</code>`,
      `<b>Сайт/Тенант:</b> <code>${cleanTenant}</code>`,
      `<b>Детали:</b> <pre>${cleanDetails}</pre>`,
      '',
      isConfigWarning
        ? '💡 <i>Для автоматического зачисления платежей укажите секретный ключ вебхука в настройках.</i>'
        : '🛡️ <i>Запрос отклонен системой защиты.</i>',
      '',
      `<i>Фиксация: ${moscowTime}</i>`,
    ].join('\n');

    sendAdminAlert(message, severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING');
  }

  /**
   * Fetches paginated security events for the admin panel.
   */
  static async getRecentEvents(options?: {
    limit?: number;
    offset?: number;
    severity?: string;
    event?: string;
    ip?: string;
    tenantId?: string;
  }): Promise<{ events: SecurityEvent[]; total: number }> {
    const { limit = 50, offset = 0, severity, event, ip, tenantId } = options || {};

    const where: Record<string, unknown> = {};
    if (severity && severity !== 'ALL') where.severity = severity;
    if (event && event !== 'ALL') where.event = event;
    if (ip) where.ip = { contains: ip };
    if (tenantId && tenantId !== 'ALL') where.tenantId = tenantId;

    try {
      const [events, total] = await Promise.all([
        db.securityEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 100),
          skip: offset,
        }),
        db.securityEvent.count({ where }),
      ]);

      return { events, total };
    } catch (err) {
      console.error('[SecurityAlertService] Failed to query security events:', err);
      return { events: [], total: 0 };
    }
  }

  /**
   * Returns aggregated statistics for security events in the past 24 hours.
   */
  static async getSecurityDashboardStats(tenantId?: string): Promise<SecurityStatsSummary> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const isSingleTenant = tenantId && tenantId !== 'all';
    const whereClause: Record<string, unknown> = { createdAt: { gte: since } };
    if (isSingleTenant) {
      whereClause.tenantId = tenantId;
    }

    try {
      const [total24h, critical24h, high24h, warning24h, recentEvents] = await Promise.all([
        db.securityEvent.count({ where: whereClause }),
        db.securityEvent.count({ where: { ...whereClause, severity: 'CRITICAL' } }),
        db.securityEvent.count({ where: { ...whereClause, severity: 'HIGH' } }),
        db.securityEvent.count({ where: { ...whereClause, severity: 'WARNING' } }),
        db.securityEvent.findMany({
          where: whereClause,
          select: { event: true, ip: true },
          take: 1000,
        }),
      ]);

      const eventMap = new Map<string, number>();
      const ipMap = new Map<string, number>();

      for (const item of recentEvents) {
        eventMap.set(item.event, (eventMap.get(item.event) || 0) + 1);
        if (item.ip) {
          ipMap.set(item.ip, (ipMap.get(item.ip) || 0) + 1);
        }
      }

      const topEvents = Array.from(eventMap.entries())
        .map(([event, count]) => ({ event, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const topIps = Array.from(ipMap.entries())
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        total24h,
        critical24h,
        high24h,
        warning24h,
        uniqueIpsCount: ipMap.size,
        topEvents,
        topIps,
      };
    } catch (err) {
      console.error('[SecurityAlertService] Failed to calculate dashboard stats:', err);
      return {
        total24h: 0,
        critical24h: 0,
        high24h: 0,
        warning24h: 0,
        uniqueIpsCount: 0,
        topEvents: [],
        topIps: [],
      };
    }
  }
}
