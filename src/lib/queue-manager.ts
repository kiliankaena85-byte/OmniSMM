import { Queue, QueueOptions } from 'bullmq';
import { Redis } from 'ioredis';
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';
import { validateRedisUrl } from '@/lib/redis';

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

export const createQueue = <PayloadType>(name: string, defaultOptions?: Partial<QueueOptions['defaultJobOptions']>) => {
  const isBuildOrTest = process.env.NEXT_PHASE === 'phase-production-build' || !!process.env.CI || process.env.NODE_ENV === 'test';
  
  // Dummy object to prevent Redis connection during Vercel/Next build step and unit tests
  if (isBuildOrTest) {
    const targetObj: any = {
      add: async (jobName?: string, data?: any, opts?: any) => ({ id: opts?.jobId || 'mock-id', name: jobName, data }),
      close: async () => {},
      disconnect: async () => {},
      getJobs: async () => [],
      getJob: async () => null,
      count: async () => 0,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
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


    return new Queue<PayloadType, unknown, string>(name, {
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
};

export type CatalogMutationPayload = 
  | { type: 'SYNC_PRICES'; usdToRub: number }
  | { type: 'RECONCILE_PRICES'; batchSize?: number }
  | { type: 'SYNC_PROVIDER_CATALOG'; providerId: string; admin: unknown }
  | { type: 'SYNC_ALL_CATALOGS'; admin: unknown }
  | { type: 'BULK_MARKUP'; filter: { categoryId?: string; platform?: string }; markupPercent: number; admin: unknown }
  | { type: 'SYNC_CBR_RATE'; timestamp: number };

export interface OrderJobPayload {
  orderId: string;
  isDripFeedChild?: boolean; // True if this is specifically dispatched from our Drip-Feed cron
  dripParentOrderId?: string;
}

// DripFeed queue has been removed as it is now passed natively to providers.

export interface SyncJobPayload {
  timestamp: number; // For keeping track
}

// P2.1: Dead Letter Queue — jobs that exhausted all retries
export interface DLQJobPayload {
  originalQueue: string;    // Which queue the job came from
  jobId: string | undefined; // Original job ID
  payload: unknown;          // Original job data
  error: string;             // Error message from last attempt
  failedAt: string;          // ISO timestamp
}

// P2.3: Cleanup cron payload
export interface CleanupJobPayload {
  timestamp: number;
}

export interface TelegramJobPayload {
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

// ETA recalculation cron payload
export interface ETAJobPayload {
  timestamp: number;
}

export interface RefillJobPayload {
  refillId: string;
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
      jobId: 'status-sync-singleton' // Avoids duplicate crons
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
      jobId: 'cleanup-singleton'
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
      jobId: 'eta-recalc-singleton'
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
      jobId: 'catalog-sync-singleton'
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
      jobId: 'cbr-rate-sync-singleton'
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
      jobId: 'sweep-orphans-singleton'
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
      jobId: 'resolve-pending-check-singleton'
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
      jobId: 'sync-proxy-subscriptions-singleton'
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
      jobId: 'payment-sync-singleton'
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
      jobId: 'dripfeed-singleton'
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
      jobId: 'article-publish-singleton'
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
