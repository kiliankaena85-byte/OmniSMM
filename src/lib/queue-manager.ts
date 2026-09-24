import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';
import { validateRedisUrl } from '@/lib/redis';
import { getTraceId, generateTraceId } from '@/lib/logger';
import { tenantStorage } from '@/lib/tenant-context';

export interface JobMetadata {
  traceId?: string;
  tenantId?: string;
  enqueuedAt?: string;
  [key: string]: unknown;
}

export function enrichJobPayload<T extends object>(data: T): T & { tenantId?: string; metadata?: JobMetadata } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data as any;
  const currentTraceId = getTraceId() || generateTraceId();
  const currentTenantId = (data as any).tenantId || tenantStorage.getStore()?.tenantId;

  const existingMetadata = ((data as any).metadata && typeof (data as any).metadata === 'object')
    ? (data as any).metadata
    : {};

  const metadata: JobMetadata = {
    ...existingMetadata,
    traceId: existingMetadata.traceId || currentTraceId,
    ...(currentTenantId ? { tenantId: existingMetadata.tenantId || currentTenantId } : {}),
    enqueuedAt: existingMetadata.enqueuedAt || new Date().toISOString(),
  };

  return {
    ...data,
    ...(currentTenantId && !(data as any).tenantId ? { tenantId: currentTenantId } : {}),
    metadata,
  };
}

// Singleton Redis connection pattern
let redisConnection: Redis | null = null;

export const getQueuePrefix = (): string => {
  if (process.env.REDIS_KEY_PREFIX) return process.env.REDIS_KEY_PREFIX;
  if (process.env.CONTOUR === 'test') return 'test:bullmq';
  if (process.env.CONTOUR === 'prod') return 'prod:bullmq';
  return 'bullmq';
};

export const getRedisConnection = (): Redis => {
  if (redisConnection) return redisConnection;

  const redisUrl = (process.env.CONTOUR === 'test' && process.env.REDIS_URL_TEST)
    ? process.env.REDIS_URL_TEST
    : (process.env.REDIS_URL || 'redis://127.0.0.1:6379');
  const redisPassword = process.env.REDIS_PASSWORD || undefined;
  const dbIndex = process.env.REDIS_DB_INDEX
    ? parseInt(process.env.REDIS_DB_INDEX, 10)
    : (process.env.CONTOUR === 'test' ? 1 : 0);

  // Enforce SEC-001 Hardening for BullMQ queue connections
  const check = validateRedisUrl(redisUrl, process.env.NODE_ENV, redisPassword);
  if (!check.valid) {
    throw new Error(check.error);
  }
  if (check.warning) {
    console.warn(check.warning);
  }
  
  redisConnection = new Redis(redisUrl, {
    password: redisPassword,
    db: isNaN(dbIndex) ? 0 : dbIndex,
    maxRetriesPerRequest: null, // Specific required for BullMQ
    lazyConnect: true // Prevent immediate crash if unavailable during build
  });

  redisConnection.on('error', (err) => {
    console.error('[Redis Core Error]', redactSensitiveTokens(err.message));
  });

  return redisConnection;
};

// Queue creation wrapper with graceful defaults and build-time safety
export const jitteredBackoff = (attemptsMade: number, delay: number): number => {
  const base = delay * Math.pow(2, Math.max(0, attemptsMade - 1));
  const jitter = base * (0.8 + Math.random() * 0.4); // ±20%
  return Math.round(jitter);
};

export const REPEATABLE_JOB_CLEANUP_OPTS = {
  removeOnComplete: { count: 100, age: 3600 },
  removeOnFail: { count: 100, age: 86400 }
};

export const createQueue = <PayloadType>(name: string, defaultOptions?: Partial<QueueOptions['defaultJobOptions']>) => {
  const isBuildOrTest = (process.env.NEXT_PHASE === 'phase-production-build' || !!process.env.CI || process.env.NODE_ENV === 'test') && !process.env.TEST_WITH_REAL_REDIS;
  
  // Dummy object to prevent Redis connection during Vercel/Next build step and unit tests
  if (isBuildOrTest) {
    const targetObj: any = {
      add: async (jobName?: string, data?: any, opts?: any) => {
        const enriched = enrichJobPayload(data);
        return { id: opts?.jobId || 'mock-id', name: jobName, data: enriched };
      },
      addBulk: async (jobs?: any[]) => {
        return (jobs || []).map((j, idx) => ({
          id: j?.opts?.jobId || `mock-id-${idx}`,
          name: j?.name,
          data: enrichJobPayload(j?.data),
        }));
      },
      close: async () => {},
      disconnect: async () => {},
      getJobs: async () => [],
      getJob: async () => null,
      count: async () => 0,
      getWaitingCount: () => Promise.resolve(0),
      getActiveCount: () => Promise.resolve(0),
      getFailedCount: () => Promise.resolve(0),
      getCompletedCount: () => Promise.resolve(0),
      getDelayedCount: () => Promise.resolve(0),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        ...defaultOptions
      }
    };
    return new Proxy(targetObj, {
      has: (target, prop) => prop in target || typeof prop === 'string',
      get: (target, prop) => {
        if (prop in target) return target[prop];
        return async () => {};
      }
    }) as unknown as Queue<PayloadType, unknown, string>;
  }

  const queue = new Queue<PayloadType, unknown, string>(name, {
    connection: getRedisConnection(),
    prefix: getQueuePrefix(),
    defaultJobOptions: {
      removeOnComplete: { count: 500, age: 3600 },
      removeOnFail: { count: 1000, age: 86400 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      ...defaultOptions,
    }
  });

  const originalAdd = queue.add.bind(queue);
  queue.add = (async (jobName: any, data: any, opts?: any) => {
    const enriched = enrichJobPayload(data);
    return await (originalAdd as any)(jobName, enriched, opts);
  }) as any;

  if (typeof (queue as any).addBulk === 'function') {
    const originalAddBulk = (queue as any).addBulk.bind(queue);
    (queue as any).addBulk = (async (jobs: any[]) => {
      const enrichedJobs = Array.isArray(jobs)
        ? jobs.map((j) => ({ ...j, data: enrichJobPayload(j.data) }))
        : jobs;
      return await originalAddBulk(enrichedJobs);
    });
  }

  return queue;
};

export type CatalogMutationPayload = 
  | { type: 'SYNC_PRICES'; usdToRub: number; metadata?: JobMetadata }
  | { type: 'RECONCILE_PRICES'; batchSize?: number; metadata?: JobMetadata }
  | { type: 'SYNC_PROVIDER_CATALOG'; providerId: string; admin: unknown; metadata?: JobMetadata }
  | { type: 'SYNC_ALL_CATALOGS'; admin: unknown; metadata?: JobMetadata }
  | { type: 'BULK_MARKUP'; filter: { categoryId?: string; platform?: string }; markupPercent: number; admin: unknown; metadata?: JobMetadata }
  | { type: 'SYNC_CBR_RATE'; timestamp: number; metadata?: JobMetadata };

export interface OrderJobPayload {
  orderId: string;
  isDripFeedChild?: boolean; // True if this is specifically dispatched from our Drip-Feed cron
  dripParentOrderId?: string;
  tenantId?: string;
  metadata?: JobMetadata;
}

// DripFeed queue has been removed as it is now passed natively to providers.

export interface SyncJobPayload {
  timestamp: number; // For keeping track
  metadata?: JobMetadata;
}

// P2.1: Dead Letter Queue — jobs that exhausted all retries
export interface DLQJobPayload {
  originalQueue: string;    // Which queue the job came from
  jobId: string | undefined; // Original job ID
  payload: unknown;          // Original job data
  error: string;             // Error message from last attempt
  failedAt: string;          // ISO timestamp
  metadata?: JobMetadata;
}

// P2.3: Cleanup cron payload
export interface CleanupJobPayload {
  timestamp: number;
  metadata?: JobMetadata;
}

export interface TelegramJobPayload {
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metadata?: JobMetadata;
}

// ETA recalculation cron payload
export interface ETAJobPayload {
  timestamp: number;
  metadata?: JobMetadata;
}

export interface RefillJobPayload {
  refillId: string;
  tenantId?: string;
  metadata?: JobMetadata;
}


// Standard execution timeouts per queue (in milliseconds)
export const QUEUE_TIMEOUTS = {
  ordersQueue: 60000,          // 60s max per order dispatch
  syncQueue: 120000,          // 120s max for status sync
  catalogQueue: 180000,       // 180s max for catalog mutations
  refillQueue: 60000,         // 60s max for refill request
  paymentGatewayQueue: 30000, // 30s max for payment generation
} as const;

/**
 * Enforces a bounded execution timeout on a background job using AbortSignal.
 */
export async function withJobTimeout<T>(
  jobName: string,
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`[BullMQ] Job ${jobName} timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Instantiate queues using NextJS-safe singleton
export const ordersQueue = createQueue<OrderJobPayload>('ordersQueue', {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60000 }
});
export const syncQueue = createQueue<SyncJobPayload>('syncQueue', {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60000 }
});
export const catalogQueue = createQueue<CatalogMutationPayload>('catalogQueue', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 60000 }
});

// P2.1: Dead Letter Queue — removeOnFail: false to preserve failed jobs for inspection
export const dlqQueue = createQueue<DLQJobPayload>('dead-letter-queue', {
  removeOnComplete: { age: 3600 * 24 * 7, count: 1000 }, // Keep max 1000 items or 7 days
  removeOnFail: { age: 3600 * 24 * 30, count: 5000 },    // Keep max 5000 failed items or 30 days
  attempts: 1,             // DLQ jobs should not retry themselves
});

// P2.3: Cleanup queue for TTL maintenance
export const cleanupQueue = createQueue<CleanupJobPayload>('cleanup');

export const telegramQueue = createQueue<TelegramJobPayload>('telegram-notifications');
export const etaQueue = createQueue<ETAJobPayload>('eta-recalc');

// P2.4: Payment Sync queue for webhook loss protection
export const paymentSyncQueue = createQueue<SyncJobPayload>('paymentSyncQueue');

export const refillQueue = createQueue<RefillJobPayload>('refillQueue', {
  attempts: 3,
  backoff: {
    type: 'fixed',
    delay: 15 * 60 * 1000 // 15 minutes
  }
});

// Tiered prioritized queues
export const criticalQueue = createQueue<Record<string, unknown>>('critical-queue', {
  attempts: 5,
  backoff: { type: 'exponential', delay: 1000 },
});
export const defaultQueue = createQueue<Record<string, unknown>>('default-queue', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
});
export const bulkQueue = createQueue<Record<string, unknown>>('bulk-queue', {
  attempts: 2,
  backoff: { type: 'exponential', delay: 30000 },
});

// Explicit named queues for payment, order, and sync operations
export const queuePayment = criticalQueue;
export const queueOrder = defaultQueue;
export const queueSync = bulkQueue;

// Payment Gateway async generation queue payload
export interface PaymentGatewayJobPayload {
  paymentId: string;
  orderId?: string;
  userId: string;
  amountRub: number;
  email: string | null;
  successUrl: string;
  description: string;
  isTestMode: boolean;
  gateway: 'yookassa' | 'cryptobot' | 'robokassa';
  metadata?: Record<string, unknown>;
  tenantId?: string;
}
export const paymentGatewayQueue = createQueue<PaymentGatewayJobPayload>('paymentGatewayQueue', {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 }
});

// Article publishing queue payload (empty for cron tick)
export interface ArticlePublishJobPayload {
  timestamp: number;
}
export const articlePublishQueue = createQueue<ArticlePublishJobPayload>('articlePublishQueue');


/**
 * Configure global cron sync job if not exists
 * (In production, the worker process handles this but we can declare helper here)
 */
export async function ensureSyncCron() {
  await syncQueue.add(
    'status-sync-tick',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '*/5 * * * *' // Every 5 minutes
      },
      jobId: 'status-sync-singleton', // Avoids duplicate crons
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * P2.3: Schedule daily cleanup cron at 03:00
 */
export async function ensureCleanupCron() {
  await cleanupQueue.add(
    'daily-cleanup',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '0 3 * * *' // 3:00 AM daily
      },
      jobId: 'cleanup-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * ETA: Schedule adaptive percentile window recalculation every 15 minutes
 */
export async function ensureETACron() {
  await etaQueue.add(
    'eta-recalc-tick',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '*/15 * * * *' // Every 15 minutes
      },
      jobId: 'eta-recalc-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * P1: Schedule daily catalog sync (Zombie Eraser) at 04:00
 */
export async function ensureCatalogSyncCron() {
  await catalogQueue.add(
    'daily-catalog-sync',
    { type: 'SYNC_ALL_CATALOGS', admin: { id: 'system', email: 'system@cron', role: 'SUPERADMIN' } },
    {
      repeat: {
        pattern: '0 4 * * *' // 4:00 AM daily
      },
      jobId: 'catalog-sync-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * [FIN-005] Schedule automatic CBR exchange rate sync every 6 hours.
 * Prevents SYSTEM_HALT if operators forget to manually trigger CBR sync.
 * Circuit breaker in order.service.ts blocks orders if rate is >48h stale.
 */
export async function ensureCBRSyncCron() {
  await catalogQueue.add(
    'cbr-rate-sync',
    { type: 'SYNC_CBR_RATE', timestamp: Date.now() },
    {
      repeat: {
        pattern: '0 */6 * * *' // Every 6 hours: 00:00, 06:00, 12:00, 18:00
      },
      jobId: 'cbr-rate-sync-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}


/**
 * C3: Schedule orphan sweep cron every 10 minutes.
 * Picks up PENDING orders that were abandoned during dispatch due to Redis/process failures.
 */
export async function ensureOrphanSweepCron() {
  await cleanupQueue.add(
    'sweep-orphans',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '*/10 * * * *' // Every 10 minutes
      },
      jobId: 'sweep-orphans-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * WRK-03: Schedule PENDING_CHECK auto-resolution hourly.
 * Prevents client funds from being held up to 27 hours in daily cleanup.
 */
export async function ensurePendingCheckCron() {
  await cleanupQueue.add(
    'resolve-pending-check',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '0 * * * *' // Hourly
      },
      jobId: 'resolve-pending-check-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * Automatically syncs active proxy subscription limits & metadata every 2 hours.
 */
export async function ensureProxySubscriptionSyncCron() {
  await cleanupQueue.add(
    'sync-proxy-subscriptions',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '0 */2 * * *' // Every 2 hours
      },
      jobId: 'sync-proxy-subscriptions-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

export async function ensurePaymentSyncCron() {
  await paymentSyncQueue.add(
    'payment-sync-tick',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '*/15 * * * *' // Every 15 minutes
      },
      jobId: 'payment-sync-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * Smart Dripfeed: Schedule repeating tick job every 1 minute
 */
export async function ensureDripfeedCron() {
  await syncQueue.add(
    'dripfeed-tick',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '* * * * *' // Every 1 minute
      },
      jobId: 'dripfeed-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

/**
 * Article Publisher: Run at 09:00 and 15:00 every day
 */
export async function ensureArticlePublishCron() {
  await articlePublishQueue.add(
    'article-publish-tick',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '0 9,15 * * *' // 09:00 and 15:00
      },
      jobId: 'article-publish-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

export interface AiObserverJobPayload {
  timestamp: number;
  tenantId?: string;
}
export const aiObserverQueue = createQueue<AiObserverJobPayload>('aiObserverQueue', {
  attempts: 2,
  backoff: { type: 'fixed', delay: 30000 },
});

/**
 * AI Observer: Run daily executive digest at 08:00 AM MSK (05:00 UTC)
 */
export async function ensureAiObserverCron() {
  await aiObserverQueue.add(
    'ai-observer-daily-digest',
    { timestamp: Date.now(), tenantId: 'smmplan' },
    {
      repeat: {
        pattern: '0 5 * * *', // 05:00 UTC = 08:00 MSK
      },
      jobId: 'ai-observer-daily-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

export interface AiEconomicOptimizerJobPayload {
  timestamp: number;
  tenantId?: string;
  forceRun?: boolean;
  analyzedPeriodDays?: number;
}

export const aiEconomicOptimizerQueue = createQueue<AiEconomicOptimizerJobPayload>(
  'aiEconomicOptimizerQueue',
  {
    attempts: 3,
    backoff: { type: 'exponential', delay: 10000 },
  }
);

/**
 * Nightly Cron: AI Economic Optimizer Daemon
 * Runs at 04:30 AM MSK (01:30 AM UTC) daily.
 */
export async function ensureAiEconomicOptimizerCron(): Promise<void> {
  await aiEconomicOptimizerQueue.add(
    'ai-economic-optimizer-nightly',
    { timestamp: Date.now(), tenantId: 'all', analyzedPeriodDays: 30 },
    {
      repeat: {
        pattern: '30 1 * * *', // 01:30 UTC = 04:30 MSK
      },
      jobId: 'ai-economic-optimizer-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

export interface GeoAvailabilityJobPayload {
  timestamp: number;
  targetUrl?: string;
}

export const geoAvailabilityQueue = createQueue<GeoAvailabilityJobPayload>(
  'geoAvailabilityQueue',
  {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
  }
);

/**
 * Geo Availability Watchdog: Runs every 5 minutes
 */
export async function ensureGeoAvailabilityCron(): Promise<void> {
  await geoAvailabilityQueue.add(
    'geo-availability-probe-tick',
    { timestamp: Date.now() },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      jobId: 'geo-availability-singleton',
      ...REPEATABLE_JOB_CLEANUP_OPTS
    }
  );
}

export const closeQueues = async () => {
    await ordersQueue.close();
    await syncQueue.close();
    await refillQueue.close();
    await catalogQueue.close();
    await dlqQueue.close();
    await cleanupQueue.close();
    await telegramQueue.close();
    await etaQueue.close();
    await paymentGatewayQueue.close();
    await paymentSyncQueue.close();
    await articlePublishQueue.close();
    await aiObserverQueue.close();
    await aiEconomicOptimizerQueue.close();
    await geoAvailabilityQueue.close();
    if (redisConnection) await redisConnection.quit();
};
