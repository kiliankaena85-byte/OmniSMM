import { db } from '@/lib/db';
import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';
import type { SubscriptionInfo } from '@/types/provider-proxy';

export class SubscriptionSyncService {
  /**
   * Parses the standard `Subscription-Userinfo` header
   * Format: "upload=1024; download=2048; total=107374182400; expire=1787836800"
   */
  public static parseUserinfo(header: string): SubscriptionInfo {
    let upload = BigInt(0);
    let download = BigInt(0);
    let total = BigInt(0);
    let expiresAt: Date | null = null;

    const parts = header.split(';').map((p) => p.trim());
    for (const part of parts) {
      const [key, val] = part.split('=').map((s) => s.trim().replace(/^["']|["']$/g, ''));
      if (!key || !val) continue;

      const lowerKey = key.toLowerCase();
      try {
        if (lowerKey === 'upload') {
          upload = BigInt(val);
        } else if (lowerKey === 'download') {
          download = BigInt(val);
        } else if (lowerKey === 'total') {
          total = BigInt(val);
        } else if (lowerKey === 'expire' || lowerKey === 'expires') {
          const timestampSec = parseInt(val, 10);
          if (!isNaN(timestampSec) && timestampSec > 0) {
            expiresAt = new Date(timestampSec * 1000);
          }
        }
      } catch {
        // Skip invalid sub-values safely
      }
    }

    let daysLeft: number | null = null;
    if (expiresAt) {
      const diffMs = expiresAt.getTime() - Date.now();
      daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      uploadBytes: upload,
      downloadBytes: download,
      totalBytes: total,
      expiresAt,
      daysLeft,
      rawHeader: header,
    };
  }

  /**
   * Fetches metadata from a subscription URL, extracts `Subscription-Userinfo`,
   * and updates the corresponding ProviderProxy record in the database.
   */
  public static async syncSubscription(proxyId: string): Promise<{
    success: boolean;
    info?: SubscriptionInfo;
    error?: string;
  }> {
    try {
      const proxy = await db.providerProxy.findUnique({
        where: { id: proxyId },
      });

      if (!proxy) {
        return { success: false, error: 'Прокси не найден' };
      }

      if (!proxy.subscriptionUrl) {
        return { success: false, error: 'У данного прокси не указан URL подписки' };
      }

      // SSRF check on subscription URL
      const ssrf = await assertSafeOutboundUrl(proxy.subscriptionUrl);
      if (!ssrf.ok) {
        return { success: false, error: `URL подписки отклонен: ${ssrf.reason}` };
      }

      // Perform fetch with Clash/Mihomo User-Agent to ensure headers are served
      const response = await fetch(proxy.subscriptionUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'ClashforWindows/0.20.39 (SMMpanel Subscription Engine)',
          Accept: '*/*',
        },
        signal: AbortSignal.timeout(10000),
      });

      const userinfoHeader =
        response.headers.get('subscription-userinfo') ||
        response.headers.get('Subscription-Userinfo') ||
        response.headers.get('Subscription-UserInfo');

      if (!userinfoHeader) {
        // In case header is absent, mark lastSyncAt anyway
        await db.providerProxy.update({
          where: { id: proxyId },
          data: { lastSyncAt: new Date() },
        });

        return {
          success: true,
          info: {
            uploadBytes: BigInt(0),
            downloadBytes: BigInt(0),
            totalBytes: BigInt(0),
            expiresAt: proxy.expiresAt,
            daysLeft: proxy.expiresAt
              ? Math.max(0, Math.ceil((proxy.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : null,
          },
        };
      }

      const parsed = this.parseUserinfo(userinfoHeader);
      const usedBytes = parsed.uploadBytes + parsed.downloadBytes;

      await db.providerProxy.update({
        where: { id: proxyId },
        data: {
          expiresAt: parsed.expiresAt || proxy.expiresAt,
          trafficUsedBytes: usedBytes > BigInt(0) ? usedBytes : proxy.trafficUsedBytes,
          trafficTotalBytes: parsed.totalBytes > BigInt(0) ? parsed.totalBytes : proxy.trafficTotalBytes,
          lastSyncAt: new Date(),
        },
      });

      return {
        success: true,
        info: parsed,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[SubscriptionSync] Error syncing proxy ${proxyId}:`, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Syncs all active subscriptions with non-null `subscriptionUrl`.
   * Designed for daily cron jobs or admin manual refresh.
   */
  public static async syncAllActiveSubscriptions(): Promise<{
    syncedCount: number;
    errors: string[];
  }> {
    const proxiesWithSub = await db.providerProxy.findMany({
      where: {
        isActive: true,
        subscriptionUrl: { not: null },
      },
    });

    let syncedCount = 0;
    const errors: string[] = [];

    for (const proxy of proxiesWithSub) {
      const res = await this.syncSubscription(proxy.id);
      if (res.success) {
        syncedCount++;
      } else if (res.error) {
        errors.push(`${proxy.label}: ${res.error}`);
      }
    }

    return { syncedCount, errors };
  }
}
