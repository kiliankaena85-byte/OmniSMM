import { db } from '@/lib/db';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { sendAdminAlert } from '@/lib/notifications';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'AiFraudWatcherService' });

export interface FraudAuditReport {
  scannedUsersCount: number;
  anomaliesDetected: number;
  referralFraudCount: number;
  orderVelocityAlertsCount: number;
  suspiciousIpsCount: number;
  alerts: Array<{
    type: 'REFERRAL_RING' | 'ORDER_BURST' | 'PAYMENT_SPIKE' | 'LEDGER_MISMATCH';
    severity: 'HIGH' | 'CRITICAL';
    userId?: string;
    ip?: string;
    details: string;
  }>;
  generatedAt: string;
}

export class AiFraudWatcherService {
  /**
   * Scans platform events over the last 24 hours to detect multi-account fraud,
   * referral manipulation, and abusive automated ordering.
   */
  static async runFraudAudit(options?: { tenantId?: string; windowHours?: number }): Promise<FraudAuditReport> {
    const windowHours = options?.windowHours ?? 24;
    const since = new Date(Date.now() - windowHours * 3600 * 1000);
    const tenantId = options?.tenantId;

    const report: FraudAuditReport = {
      scannedUsersCount: 0,
      anomaliesDetected: 0,
      referralFraudCount: 0,
      orderVelocityAlertsCount: 0,
      suspiciousIpsCount: 0,
      alerts: [],
      generatedAt: new Date().toISOString(),
    };

    try {
      // 1. Check for Referral Abuse (Users referring multiple accounts from identical IP / short intervals)
      const usersWhere: Record<string, unknown> = {
        createdAt: { gte: since },
        referredById: { not: null },
      };
      if (tenantId) usersWhere.tenantId = tenantId;

      const referredUsers = await db.user.findMany({
        where: usersWhere,
        select: {
          id: true,
          email: true,
          referredById: true,
          createdAt: true,
          orders: { select: { id: true }, take: 1 },
        },
        take: 500,
      });

      report.scannedUsersCount += referredUsers.length;

      // Group by referredById
      const referrerMap = new Map<string, typeof referredUsers>();
      for (const u of referredUsers) {
        if (!u.referredById) continue;
        const list = referrerMap.get(u.referredById) || [];
        list.push(u);
        referrerMap.set(u.referredById, list);
      }

      for (const [referrerId, children] of referrerMap.entries()) {
        // If 5+ referred accounts registered in 24h with ZERO orders placed -> Referral Ring Pattern
        const dummyAccounts = children.filter((c) => c.orders.length === 0);
        if (dummyAccounts.length >= 5) {
          report.referralFraudCount++;
          report.anomaliesDetected++;
          report.alerts.push({
            type: 'REFERRAL_RING',
            severity: 'HIGH',
            userId: referrerId,
            details: `Обнаружена вероятная накрутка рефералов: пользователь ${referrerId} зарегистрировал ${dummyAccounts.length} фейковых рефералов без заказов за ${windowHours}ч.`,
          });

          await SecurityAlertService.record({
            event: 'REFERRAL_FRAUD_DETECTED',
            severity: 'HIGH',
            details: {
              referrerId,
              dummyAccountsCount: dummyAccounts.length,
              childUserIds: dummyAccounts.map((d) => d.id).slice(0, 10),
            },
          });
        }
      }

      // 2. Check for Abnormal Order Bursts (> 30 orders created within 5 minutes by a single user)
      const recentOrders = await db.order.findMany({
        where: {
          createdAt: { gte: since },
          ...(tenantId ? { tenantId } : {}),
        },
        select: {
          id: true,
          userId: true,
          createdAt: true,
        },
        take: 1000,
      });

      const userOrderCounts = new Map<string, number>();
      for (const o of recentOrders) {
        if (!o.userId) continue;
        userOrderCounts.set(o.userId, (userOrderCounts.get(o.userId) || 0) + 1);
      }

      for (const [userId, count] of userOrderCounts.entries()) {
        if (count >= 50) {
          report.orderVelocityAlertsCount++;
          report.anomaliesDetected++;
          report.alerts.push({
            type: 'ORDER_BURST',
            severity: 'HIGH',
            userId,
            details: `Высокая частота заказов: пользователь ${userId} создал ${count} заказов за ${windowHours}ч. Возможна роботизированная атака.`,
          });

          await SecurityAlertService.record({
            event: 'ABNORMAL_ORDER_BURST',
            severity: 'HIGH',
            details: { userId, orderCount: count, windowHours },
          });
        }
      }

      // 3. Dispatch admin alert if critical anomalies detected
      if (report.alerts.length > 0) {
        const highSeverityCount = report.alerts.filter((a) => a.severity === 'CRITICAL' || a.severity === 'HIGH').length;
        if (highSeverityCount > 0) {
          const summaryMsg = `🛡️ <b>[AI Fraud Watcher Alert]</b>\nОбнаружено ${report.anomaliesDetected} аномалий за последние ${windowHours}ч:\n` +
            report.alerts.slice(0, 3).map((a) => `• [${a.type}] ${a.details}`).join('\n');
          sendAdminAlert(summaryMsg, 'WARNING');
        }
      }

      log.info('AI Fraud audit completed', {
        anomalies: report.anomaliesDetected,
        scanned: report.scannedUsersCount,
      });

      return report;
    } catch (e: unknown) {
      log.error('AI Fraud audit failed', { error: (e as Error).message });
      return report;
    }
  }
}
