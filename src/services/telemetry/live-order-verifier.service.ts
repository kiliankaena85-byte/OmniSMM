import { assertSafeOutboundUrl } from '@/lib/security/ssrf-guard';
import { proxiedFetch } from '@/lib/http/proxy-fetch';
import { ProxyPoolService } from '@/services/providers/proxy-pool.service';

export interface TelegramCounterSnapshot {
  views?: number;
  subscribers?: number;
  reactions?: number;
  capturedAt: Date;
  rawText?: string;
}

export interface VerificationResult {
  isVerified: boolean;
  isSuspicious: boolean;
  startCount: number | null;
  currentCount: number | null;
  delta: number;
  expectedQuantity: number;
  reason?: string;
}

export class LiveOrderVerifierService {
  /**
   * Fetch current public Telegram metrics for a given URL.
   */
  public static async fetchTelegramMetrics(targetUrl: string): Promise<TelegramCounterSnapshot | null> {
    try {
      // 1. SSRF Safety Check
      const ssrf = await assertSafeOutboundUrl(targetUrl);
      if (!ssrf.ok) {
        console.warn(`[LiveOrderVerifier] Target URL rejected by SSRF guard: ${targetUrl}`);
        return null;
      }

      // 2. Fetch via healthy proxy if available
      const proxy = await ProxyPoolService.getHealthyProxy();
      
      const response = await proxiedFetch(targetUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        proxy,
      });

      if (!response.ok) {
        return null;
      }

      const html = await response.text();

      // 3. Extract Views (e.g. for post /29: <span class="tgme_widget_message_views">137</span> or similar)
      let views: number | undefined;
      const viewsMatch = html.match(/class=["'][^"']*tgme_widget_message_views[^"']*["'][^>]*>([\d\.\sKMkm]+)</i)
        || html.match(/class=["'][^"']*tgme_page_views[^"']*["'][^>]*>([\d\.\sKMkm]+)</i);
      if (viewsMatch && viewsMatch[1]) {
        views = this.parseTelegramMetric(viewsMatch[1]);
      }

      // 4. Extract Subscribers / Members (e.g. tgme_page_extra: "1 250 subscribers")
      let subscribers: number | undefined;
      const subsMatch = html.match(/(\d[\d\s\.,KMkm]*)\s+(subscribers|members|подписчик|участник)/i);
      if (subsMatch && subsMatch[1]) {
        subscribers = this.parseTelegramMetric(subsMatch[1]);
      }

      return {
        views,
        subscribers,
        capturedAt: new Date(),
        rawText: `Views: ${views ?? 'N/A'}, Subs: ${subscribers ?? 'N/A'}`,
      };
    } catch (err) {
      console.warn(`[LiveOrderVerifier] Failed to fetch Telegram metrics for ${targetUrl}:`, err);
      return null;
    }
  }

  /**
   * Verify whether delivery really happened based on before/after metrics.
   */
  public static verifyDelivery(
    startCount: number,
    currentCount: number,
    orderedQuantity: number
  ): VerificationResult {
    const delta = Math.max(0, currentCount - startCount);
    
    // If delivered at least 70% of ordered quantity -> Verified
    if (delta >= Math.floor(orderedQuantity * 0.7)) {
      return {
        isVerified: true,
        isSuspicious: false,
        startCount,
        currentCount,
        delta,
        expectedQuantity: orderedQuantity,
      };
    }

    // If delta is less than 30% of ordered quantity -> Flag as Suspicious Fake Completion
    if (delta < Math.floor(orderedQuantity * 0.3)) {
      return {
        isVerified: false,
        isSuspicious: true,
        startCount,
        currentCount,
        delta,
        expectedQuantity: orderedQuantity,
        reason: `Discrepancy detected: expected +${orderedQuantity}, actual delta is +${delta}`,
      };
    }

    // Partial fulfillment
    return {
      isVerified: false,
      isSuspicious: false,
      startCount,
      currentCount,
      delta,
      expectedQuantity: orderedQuantity,
      reason: `Partial delivery: +${delta} out of +${orderedQuantity}`,
    };
  }

  /**
   * Helper to parse '1.2K', '3.5M', '1 250' to numbers.
   */
  private static parseTelegramMetric(str: string): number {
    const clean = str.replace(/\s+/g, '').replace(/,/g, '.').trim().toUpperCase();
    if (clean.endsWith('M')) {
      return Math.round(parseFloat(clean) * 1_000_000);
    }
    if (clean.endsWith('K')) {
      return Math.round(parseFloat(clean) * 1_000);
    }
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : Math.round(val);
  }
}
