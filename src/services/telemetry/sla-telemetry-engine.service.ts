import { getRedisConnection } from '@/lib/queue-manager';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'SlaTelemetryEngine' });

export interface SlaMetricSnapshot {
  providerId: string;
  serviceId?: string;
  p50Seconds: number;
  p90Seconds: number;
  p99Seconds: number;
  sampleCount: number;
  isDegraded: boolean;
  calculatedAt: string;
}

export class SlaTelemetryEngine {
  private static readonly STREAM_PREFIX = 'sla:telemetry:stream';
  private static readonly MAX_STREAM_LEN = 10000;

  /**
   * Records order start latency to Redis Stream.
   */
  public static async recordOrderStartLatency(
    providerId: string,
    serviceId: string,
    latencySeconds: number
  ): Promise<void> {
    try {
      const redis = getRedisConnection();
      const streamKey = `${this.STREAM_PREFIX}:${providerId}`;

      await redis.xadd(
        streamKey,
        'MAXLEN',
        '~',
        this.MAX_STREAM_LEN,
        '*',
        'serviceId',
        serviceId,
        'latencySeconds',
        latencySeconds.toString(),
        'timestamp',
        Date.now().toString()
      );
    } catch (err) {
      log.warn(`Failed to record SLA latency for provider ${providerId}: ${(err as Error).message}`);
    }
  }

  /**
   * Computes P50, P90, P99 SLA percentiles from rolling window samples.
   */
  public static computePercentiles(samples: number[]): { p50: number; p90: number; p99: number } {
    if (samples.length === 0) {
      return { p50: 300, p90: 1800, p99: 7200 }; // Standard default fallback (5m, 30m, 2h)
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const getPercentile = (p: number) => {
      const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
      return sorted[index];
    };

    return {
      p50: getPercentile(0.50),
      p90: getPercentile(0.90),
      p99: getPercentile(0.99),
    };
  }

  /**
   * Fetches latest SLA telemetry snapshot for a provider.
   */
  public static async getProviderSlaSnapshot(providerId: string): Promise<SlaMetricSnapshot> {
    try {
      const redis = getRedisConnection();
      const streamKey = `${this.STREAM_PREFIX}:${providerId}`;
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;

      const entries = await redis.xrange(streamKey, oneDayAgo.toString(), '+');
      const latencies: number[] = [];

      for (const [, fields] of entries) {
        for (let i = 0; i < fields.length; i += 2) {
          if (fields[i] === 'latencySeconds') {
            const val = parseFloat(fields[i + 1]);
            if (!isNaN(val)) latencies.push(val);
          }
        }
      }

      const { p50, p90, p99 } = this.computePercentiles(latencies);
      const isDegraded = p90 > 3600; // P90 exceeding 1 hour flags degraded provider

      return {
        providerId,
        p50Seconds: Math.round(p50),
        p90Seconds: Math.round(p90),
        p99Seconds: Math.round(p99),
        sampleCount: latencies.length,
        isDegraded,
        calculatedAt: new Date().toISOString(),
      };
    } catch (err) {
      log.warn(`Fallback SLA snapshot used for ${providerId}: ${(err as Error).message}`);
      return {
        providerId,
        p50Seconds: 300,
        p90Seconds: 1800,
        p99Seconds: 7200,
        sampleCount: 0,
        isDegraded: false,
        calculatedAt: new Date().toISOString(),
      };
    }
  }
}
