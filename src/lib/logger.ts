/**
 * Structured logger for SMMplan (Pino-based).
 *
 * Provides:
 *  - JSON-structured output (compatible with Loki/Promtail)
 *  - Correlation ID and TraceContext propagation via AsyncLocalStorage
 *  - Child loggers with bound context
 *
 * Usage:
 *   import { logger, withTelemetryContext } from '@/lib/logger';
 *   logger.info('Payment processed', { orderId, amount });
 *   logger.error('Checkout failed', { error: err.message, userId });
 *
 * With telemetry context:
 *   await withTelemetryContext({ traceId, tenantId: 'flux' }, async () => {
 *     logger.info('Processing job with automatic trace');
 *   });
 */

import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';
import { redactSensitiveTokens, sanitizeLogObject } from './logger/sensitive-data-filter';
import { runWithTenant, tenantStorage } from '@/lib/tenant-context';

// ─── Distributed Tracing & Correlation ID Store ─────────────────────────────

export interface LogContext {
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  tenantId?: string;
  userId?: string;
  component?: string;
  [key: string]: unknown;
}

export const logContextStorage = new AsyncLocalStorage<LogContext>();

/** Get current trace ID from async context */
export function getTraceId(): string | undefined {
  const store = logContextStorage.getStore();
  return store?.traceId || store?.correlationId;
}

/** Get current correlation ID from async context */
export function getCorrelationId(): string | undefined {
  const store = logContextStorage.getStore();
  return store?.correlationId || store?.traceId;
}

/** Generate a globally unique, high-entropy trace ID */
export function generateTraceId(): string {
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `trc_${Date.now().toString(36)}_${randomPart}`;
}

/** Run a synchronous function with a bound log context (correlationId, traceId, userId, etc.) */
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  const effectiveTraceId = context.traceId || context.correlationId || generateTraceId();
  return logContextStorage.run({
    ...context,
    traceId: effectiveTraceId,
    correlationId: context.correlationId || effectiveTraceId,
  }, fn);
}

/**
 * Runs an async or sync function within an explicit Telemetry & Tenant context.
 * Binds traceId and correlationId into logContextStorage, and binds tenantId
 * into both logContextStorage and tenantStorage (runWithTenant).
 */
export async function withTelemetryContext<T>(
  context: LogContext,
  fn: () => Promise<T> | T
): Promise<T> {
  const parentStore = logContextStorage.getStore();
  const effectiveTraceId = context.traceId || context.correlationId || parentStore?.traceId || generateTraceId();
  const effectiveTenantId = context.tenantId || parentStore?.tenantId || tenantStorage.getStore()?.tenantId;

  const mergedContext: LogContext = {
    ...parentStore,
    ...context,
    traceId: effectiveTraceId,
    correlationId: effectiveTraceId,
    ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
  };

  return logContextStorage.run(mergedContext, async () => {
    if (effectiveTenantId) {
      return await runWithTenant(effectiveTenantId, async () => fn());
    }
    return await fn();
  });
}

// ─── Pino Instance ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isDev = process.env.NODE_ENV !== 'production';

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // NOTE: pino-pretty transport is incompatible with Next.js Turbopack bundler.
  // Use plain JSON in all environments. Loki/Promtail parses JSON natively.
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'smmplan',
    env: process.env.NODE_ENV || 'development',
  },
});

// ─── Logger Proxy (auto-injects traceId, tenantId, etc. from AsyncLocalStorage) ──

type LogFn = (message: string, context?: unknown) => void;

export interface Logger {
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
  /** Create a child logger with bound context fields */
  child: (bindings: Record<string, unknown>) => Logger;
}

function createLoggerFromBase(pinoInstance: pino.Logger): Logger {
  const log = (level: pino.Level) => (message: string, context?: unknown) => {
    const store = logContextStorage.getStore();
    const extra = (typeof context === 'object' && context !== null && !Array.isArray(context))
      ? (context as Record<string, unknown>)
      : (context !== undefined ? { detail: context } : {});
    const merged = {
      ...(store?.traceId ? { traceId: store.traceId } : {}),
      ...(store?.correlationId ? { correlationId: store.correlationId } : {}),
      ...(store?.tenantId ? { tenantId: store.tenantId } : {}),
      ...(store?.userId ? { userId: store.userId } : {}),
      ...(store?.component ? { component: store.component } : {}),
      ...extra,
    };

    // Auto-redact sensitive credentials and tokens
    const safeMessage = redactSensitiveTokens(message);
    const safeContext = sanitizeLogObject(merged);

    pinoInstance[level](safeContext, safeMessage);
  };

  return {
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    debug: log('debug'),
    child: (bindings) => createLoggerFromBase(pinoInstance.child(bindings)),
  };
}

export const logger = createLoggerFromBase(baseLogger);
