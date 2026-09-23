import { redis } from '@/lib/redis';
import { SecurityAlertService } from '@/services/security/security-alert.service';

export interface DLPCheckOptions {
  userId: string;
  userEmail: string;
  userRole: string;
  action: 'EXPORT_USERS' | 'EXPORT_ORDERS' | 'BULK_QUERY_USERS' | 'BULK_QUERY_ORDERS' | 'VIEW_CLIENT_DOSSIER';
  recordCount?: number;
  ipAddress?: string | null;
  tenantId?: string | null;
}

export interface DLPCheckResult {
  allowed: boolean;
  error?: string;
}

export class DataLossPreventionService {
  private static readonly RATE_WINDOW_SEC = 60; // 1 minute window
  private static readonly THRESHOLDS: Record<string, number> = {
    EXPORT_USERS: 3,        // Max 3 exports per minute
    EXPORT_ORDERS: 5,       // Max 5 exports per minute
    BULK_QUERY_USERS: 40,   // Max 40 paginated queries per minute
    BULK_QUERY_ORDERS: 60,  // Max 60 paginated queries per minute
    VIEW_CLIENT_DOSSIER: 50 // Max 50 client profiles inspected per minute
  };

  /**
   * Evaluates if a staff member is conducting suspicious bulk scraping or data exfiltration.
   * If threshold exceeded, immediately issues P0 CRITICAL Telegram alert and blocks the request.
   */
  static async checkStaffDataAccess(opts: DLPCheckOptions): Promise<DLPCheckResult> {
    const { userId, userEmail, userRole, action, recordCount = 1, ipAddress = 'unknown', tenantId = 'smmplan' } = opts;

    // OWNER is exempt from automated blocking, but high volume is logged
    const isOwner = userRole === 'OWNER';

    const maxAllowed = this.THRESHOLDS[action] || 30;
    const redisKey = `dlp:staff:${userId}:${action}`;

    try {
      let currentCount: number;
      if (typeof (redis as any).incrby === 'function') {
        currentCount = await (redis as any).incrby(redisKey, recordCount);
      } else {
        const raw = await redis.get(redisKey);
        const val = (Number(raw) || 0) + recordCount;
        await redis.set(redisKey, String(val));
        currentCount = val;
      }

      if (typeof (redis as any).expire === 'function') {
        await (redis as any).expire(redisKey, this.RATE_WINDOW_SEC).catch(() => {});
      }

      if (currentCount > maxAllowed) {
        // Trigger P0 Security Alert for suspected insider data theft / scraping
        await SecurityAlertService.record({
          event: 'INSIDER_DATA_SCRAPING_ANOMALY',
          severity: 'CRITICAL',
          ip: ipAddress,
          tenantId,
          details: {
            staffUserId: userId,
            staffEmail: userEmail,
            role: userRole,
            action,
            currentQueryCount: currentCount,
            limitPerMinute: maxAllowed,
            threat: 'Suspected automated scraping or unauthorized customer database exfiltration',
            recommendation: 'Verify employee credentials and consider immediate session revocation'
          }
        });

        if (!isOwner) {
          return {
            allowed: false,
            error: `Превышен порог выгрузки данных (${currentCount}/${maxAllowed} за мин). Запрос заблокирован системой DLP.`
          };
        }
      }

      return { allowed: true };
    } catch (err) {
      console.error('[DLP] Error checking data access rate:', err);
      // Fail-open for benign Redis blips on normal reads, but log
      return { allowed: true };
    }
  }
}
