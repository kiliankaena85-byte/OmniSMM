import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'ETAService' });

/**
 * Adaptive Percentile Window ETA Estimation
 * 
 * Algorithm:
 * 1. Classify service speed via median of recent completed orders
 * 2. Select adaptive time window (FAST=2h, MEDIUM=24h, SLOW=72h, ULTRA=168h)
 * 3. Compute trimmed P50/P90 within that window (trim 15% outliers each side)
 * 4. Persist results as denormalized cache in Service model
 * 
 * Designed to run as a cron job every 15 minutes.
 */

// Speed class thresholds (in seconds)
const SPEED_THRESHOLDS = {
  FAST: 1800,       // < 30 min
  MEDIUM: 21600,    // < 6 hours  
  SLOW: 172800,     // < 48 hours
  // ULTRA_SLOW: everything else
} as const;

// Adaptive window sizes per speed class (in hours)
const WINDOW_HOURS: Record<string, number> = {
  FAST: 2,
  MEDIUM: 24,
  SLOW: 72,
  ULTRA_SLOW: 168,
};

type EtaRow = {
  serviceId: string;
  speed_class: string;
  sample_count: number;
  p50_seconds: number;
  p90_seconds: number;
};

/**
 * Main recalculation function — called by cron every 15 minutes.
 * Uses a two-pass approach:
 *   Pass 1: Classify each service's speed via median of last 20 completed orders
 *   Pass 2: For each service, compute trimmed P50/P90 within the adaptive window
 */
export async function recalculateAllETAs(): Promise<{ updated: number; skipped: number }> {
  const startMs = Date.now();

  // ── Pass 1: Speed Classification ──
  // Get median execution time from the last 20 completed orders per service
  const speedClassRows = await db.$queryRaw<
    { serviceId: string; median_seconds: number }[]
  >`
    WITH ranked AS (
      SELECT 
        "serviceId",
        EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) AS exec_seconds,
        ROW_NUMBER() OVER (PARTITION BY "serviceId" ORDER BY "updatedAt" DESC) AS rn
      FROM "Order"
      WHERE status IN ('COMPLETED', 'PARTIAL')
        AND "updatedAt" > "createdAt"
    )
    SELECT 
      "serviceId",
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY exec_seconds)::float AS median_seconds
    FROM ranked
    WHERE rn <= 20
    GROUP BY "serviceId"
    HAVING COUNT(*) >= 3
  `;

  if (speedClassRows.length === 0) {
    log.info('ETA recalc: no services with enough data');
    return { updated: 0, skipped: 0 };
  }

  // Build speed class map
  const serviceWindows = new Map<string, { speedClass: string; windowHours: number }>();

  for (const row of speedClassRows) {
    let speedClass: string;
    if (row.median_seconds < SPEED_THRESHOLDS.FAST) {
      speedClass = 'FAST';
    } else if (row.median_seconds < SPEED_THRESHOLDS.MEDIUM) {
      speedClass = 'MEDIUM';
    } else if (row.median_seconds < SPEED_THRESHOLDS.SLOW) {
      speedClass = 'SLOW';
    } else {
      speedClass = 'ULTRA_SLOW';
    }
    serviceWindows.set(row.serviceId, {
      speedClass,
      windowHours: WINDOW_HOURS[speedClass],
    });
  }

  // ── Pass 2: Trimmed Percentiles per Speed Class ──
  // Group services by speed class to batch queries (max 4 queries instead of N)
  const classBuckets = new Map<string, string[]>();
  for (const [serviceId, { speedClass }] of serviceWindows) {
    if (!classBuckets.has(speedClass)) classBuckets.set(speedClass, []);
    classBuckets.get(speedClass)!.push(serviceId);
  }

  const allResults: EtaRow[] = [];

  for (const [speedClass, serviceIds] of classBuckets) {
    const windowHours = WINDOW_HOURS[speedClass];

    // Trimmed P50/P90: discard top/bottom 15% of execution times
    const rows = await db.$queryRaw<EtaRow[]>`
      WITH windowed AS (
        SELECT
          "serviceId",
          EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) AS exec_seconds,
          PERCENT_RANK() OVER (
            PARTITION BY "serviceId"
            ORDER BY EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))
          ) AS prank
        FROM "Order"
        WHERE status IN ('COMPLETED', 'PARTIAL')
          AND "updatedAt" > "createdAt"
          AND "updatedAt" > NOW() - (${windowHours}::int * INTERVAL '1 hour')
          AND "serviceId" = ANY(${serviceIds})
      )
      SELECT
        "serviceId",
        ${speedClass} AS speed_class,
        COUNT(*)::int AS sample_count,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY exec_seconds)::float AS p50_seconds,
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY exec_seconds)::float AS p90_seconds
      FROM windowed
      WHERE prank <= 0.85
      GROUP BY "serviceId"
      HAVING COUNT(*) >= 2
    `;

    allResults.push(...rows);
  }

  // ── Pass 3: Batch UPDATE ──
  const now = new Date();

  // Chunk results to prevent connection pool exhaustion and memory bloat
  const CHUNK_SIZE = 500;
  for (let i = 0; i < allResults.length; i += CHUNK_SIZE) {
    const chunk = allResults.slice(i, i + CHUNK_SIZE);
    
    // Use a transaction for atomicity per chunk
    await db.$transaction(
      chunk.map((row) =>
        db.service.update({
          where: { id: row.serviceId },
          data: {
            etaP50Seconds: Math.round(row.p50_seconds),
            etaP90Seconds: Math.round(row.p90_seconds),
            etaSampleCount: row.sample_count,
            etaSpeedClass: row.speed_class,
            etaUpdatedAt: now,
          },
        })
      )
    );
  }
  const updated = allResults.length;

  const skipped = speedClassRows.length - updated;
  const durationMs = Date.now() - startMs;

  log.info(`ETA recalc complete`, {
    updated,
    skipped,
    durationMs,
    byClass: Object.fromEntries(
      [...classBuckets.entries()].map(([cls, ids]) => [cls, ids.length])
    ),
  });

  return { updated, skipped };
}
