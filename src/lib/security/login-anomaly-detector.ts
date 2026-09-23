import { db } from '@/lib/db';
import { sendAdminAlert } from '@/lib/notifications';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'LoginAnomalyDetector' });

export interface AnomalyReport {
  scannedTokens: number;
  anomaliesDetected: number;
  flaggedEmails: string[];
}

/**
 * Hourly detection job to spot credential stuffing, distributed brute-force,
 * or concurrent account takeovers via Magic Link / Login.
 */
export async function detectLoginAnomalies(): Promise<AnomalyReport> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const recentTokens = await db.authToken.findMany({
      where: {
        used: true,
        usedAt: { gt: oneHourAgo },
        ipUsed: { not: null },
      },
      include: {
        user: {
          select: { id: true, email: true, tenantId: true },
        },
      },
    });

    const byEmail = new Map<string, Set<string>>();

    for (const token of recentTokens) {
      const email = token.user?.email;
      if (!email || !token.ipUsed) continue;

      if (!byEmail.has(email)) {
        byEmail.set(email, new Set());
      }
      byEmail.get(email)!.add(token.ipUsed);
    }

    const flaggedEmails: string[] = [];

    for (const [email, ips] of byEmail.entries()) {
      if (ips.size > 3) {
        flaggedEmails.push(email);
        const ipList = Array.from(ips).join(', ');

        log.warn('Login anomaly detected: multiple IPs for single account', {
          email,
          ipCount: ips.size,
          ips: ipList,
        });

        await SecurityAlertService.record({
          event: 'LOGIN_MULTI_IP_ANOMALY',
          severity: 'HIGH',
          details: {
            email,
            distinctIpCount: ips.size,
            ips: Array.from(ips),
          },
        });

        sendAdminAlert(
          `🚨 <b>Обнаружена аномалия входа!</b>\nEmail: <code>${email}</code>\nВходы с ${ips.size} различных IP за последний час:\n<code>${ipList}</code>`,
          'WARNING'
        );
      }
    }

    return {
      scannedTokens: recentTokens.length,
      anomaliesDetected: flaggedEmails.length,
      flaggedEmails,
    };
  } catch (err) {
    log.error('Failed to run login anomaly detector', {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      scannedTokens: 0,
      anomaliesDetected: 0,
      flaggedEmails: [],
    };
  }
}
