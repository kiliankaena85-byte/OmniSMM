import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P0AlertDebouncer, DEFAULT_FALLBACK_SILENCE_WINDOW_MS } from '@/lib/alerts/p0-alert-debouncer';
import {
  withTelemetryContext,
  getTraceId,
  getCorrelationId,
  generateTraceId,
  runWithLogContext,
  logContextStorage,
} from '@/lib/logger';
import { tenantStorage } from '@/lib/tenant-context';
import { createQueue, enrichJobPayload } from '@/lib/queue-manager';
import { wrapWorkerProcessor, extractJobTraceContext } from '@/lib/telemetry/bullmq-bridge';
import { redactSensitiveTokens } from '@/lib/logger/sensitive-data-filter';
import {
  DualFacedErrorSanitizer,
  ErrorInterpreter,
  generateRefCode,
} from '@/lib/telemetry/error-interpreter';
import { Job } from 'bullmq';

describe('Bank-Grade Logging & Observability Triad Test Suite', () => {
  beforeEach(() => {
    P0AlertDebouncer.setForceInMemoryFallback(true);
    P0AlertDebouncer.resetAllInMemory();
    vi.clearAllMocks();
  });

  // =========================================================================
  // MODULE 1: TOKEN BUCKET IN-MEMORY FALLBACK (ALERT STORM PROTECTION)
  // =========================================================================
  describe('Module 1: P0AlertDebouncer Token Bucket Fallback', () => {
    it('allows the very first alert and sets the silence window when Redis is offline', async () => {
      const alertKey = 'db-connection-failed-incident-1';
      const shouldSend = await P0AlertDebouncer.shouldSendAlert(alertKey, 60);

      expect(shouldSend).toBe(true);

      const bucket = P0AlertDebouncer.getBucket(alertKey);
      expect(bucket).toBeDefined();
      expect(bucket?.occurrences).toBe(1);
      expect(bucket?.suppressedInWindow).toBe(0);
      // Silence window is at least DEFAULT_FALLBACK_SILENCE_WINDOW_MS (5 min = 300s)
      expect(bucket?.silenceUntil).toBeGreaterThanOrEqual(Date.now() + 290_000);
    });

    it('suppresses subsequent alerts within the 5-minute silence window (anti-storm)', async () => {
      const alertKey = 'crashloop-fatal-error';

      // 1st alert: allowed
      const first = await P0AlertDebouncer.shouldSendAlert(alertKey, 60);
      expect(first).toBe(true);

      // Simulating CrashLoop: 20 rapid bursts within 1 second
      for (let i = 0; i < 20; i++) {
        const next = await P0AlertDebouncer.shouldSendAlert(alertKey, 60);
        expect(next).toBe(false);
      }

      const bucket = P0AlertDebouncer.getBucket(alertKey);
      expect(bucket?.occurrences).toBe(21);
      expect(bucket?.suppressedInWindow).toBe(20);

      const metrics = P0AlertDebouncer.getInMemoryMetrics();
      expect(metrics.totalBuckets).toBe(1);
      expect(metrics.totalSuppressed).toBe(20);
    });

    it('accurately accumulates occurrences in checkDeduplicatedAlert during Redis outage', async () => {
      const alertKey = 'provider-sync-timeout';

      const first = await P0AlertDebouncer.checkDeduplicatedAlert(alertKey, 120);
      expect(first.shouldSend).toBe(true);
      expect(first.occurrences).toBe(1);

      const second = await P0AlertDebouncer.checkDeduplicatedAlert(alertKey, 120);
      expect(second.shouldSend).toBe(false);
      expect(second.occurrences).toBe(2);

      const third = await P0AlertDebouncer.checkDeduplicatedAlert(alertKey, 120);
      expect(third.shouldSend).toBe(false);
      expect(third.occurrences).toBe(3);
    });

    it('resets the lock immediately when resetLock is invoked', async () => {
      const alertKey = 'transient-flapping-service';

      await P0AlertDebouncer.shouldSendAlert(alertKey, 300);
      expect(await P0AlertDebouncer.shouldSendAlert(alertKey, 300)).toBe(false);

      await P0AlertDebouncer.resetLock(alertKey);
      expect(P0AlertDebouncer.getBucket(alertKey)).toBeUndefined();

      // After reset, should immediately allow new alert
      const allowedAfterReset = await P0AlertDebouncer.shouldSendAlert(alertKey, 300);
      expect(allowedAfterReset).toBe(true);
    });

    it('handles threshold trigger sliding window without Redis', async () => {
      const key = 'auth-bruteforce-test';

      const res1 = await P0AlertDebouncer.checkThresholdTrigger(key, 60, 3);
      expect(res1.count).toBe(1);
      expect(res1.shouldTrigger).toBe(false);

      const res2 = await P0AlertDebouncer.checkThresholdTrigger(key, 60, 3);
      expect(res2.count).toBe(2);
      expect(res2.shouldTrigger).toBe(false);

      const res3 = await P0AlertDebouncer.checkThresholdTrigger(key, 60, 3);
      expect(res3.count).toBe(3);
      expect(res3.shouldTrigger).toBe(true);
    });

    it('prunes expired threshold counters and caps memory to prevent OOM under flood', async () => {
      // Create 5200 unique short-lived counters
      for (let i = 0; i < 5200; i++) {
        await P0AlertDebouncer.checkThresholdTrigger(`flood-key-${i}`, 1, 10);
      }

      // Memory size must never exceed 5000 entries
      expect(P0AlertDebouncer.getCountersSize()).toBeLessThanOrEqual(5000);
    });

    it('preserves active in-memory silence window even when forceInMemory is toggled', async () => {
      const alertKey = 'network-flap-incident';

      // 1. Initial alert fired in fallback
      expect(await P0AlertDebouncer.shouldSendAlert(alertKey, 300)).toBe(true);

      // 2. Simulated Redis connection flap / reconnect
      P0AlertDebouncer.setForceInMemoryFallback(false);

      // 3. Must still be suppressed by the active 5-minute silence window
      const suppressed = await P0AlertDebouncer.shouldSendAlert(alertKey, 300);
      expect(suppressed).toBe(false);

      // Re-enable forceInMemory for remaining tests
      P0AlertDebouncer.setForceInMemoryFallback(true);
    });
  });

  // =========================================================================
  // MODULE 2: BULLMQ TELEMETRY BRIDGE & DISTRIBUTED TRACING
  // =========================================================================
  describe('Module 2: BullMQ Telemetry Bridge & Distributed TraceContext', () => {
    it('generates high-entropy trace IDs with trc_ prefix', () => {
      const traceId1 = generateTraceId();
      const traceId2 = generateTraceId();

      expect(traceId1).toMatch(/^trc_[a-z0-9]+_[a-z0-9]+$/);
      expect(traceId2).toMatch(/^trc_[a-z0-9]+_[a-z0-9]+$/);
      expect(traceId1).not.toBe(traceId2);
    });

    it('propagates traceId, correlationId and tenantId inside withTelemetryContext', async () => {
      const customTraceId = 'trc_custom_trace_999';
      const customTenantId = 'flux';

      await withTelemetryContext(
        { traceId: customTraceId, tenantId: customTenantId, component: 'OrderService' },
        async () => {
          expect(getTraceId()).toBe(customTraceId);
          expect(getCorrelationId()).toBe(customTraceId);
          expect(tenantStorage.getStore()?.tenantId).toBe(customTenantId);
          expect(logContextStorage.getStore()?.component).toBe('OrderService');
        }
      );

      // Context must be cleanly isolated outside
      expect(getTraceId()).toBeUndefined();
      expect(tenantStorage.getStore()?.tenantId).toBeUndefined();
    });

    it('automatically enriches BullMQ job payload with metadata.traceId and tenantId', async () => {
      const testTraceId = 'trc_active_parent_session_1';
      const testTenantId = 'flux';

      await withTelemetryContext({ traceId: testTraceId, tenantId: testTenantId }, async () => {
        const rawPayload = { orderId: 'ord-12345' };
        const enriched: any = enrichJobPayload(rawPayload);

        expect(enriched.orderId).toBe('ord-12345');
        expect(enriched.tenantId).toBe('flux');
        expect(enriched.metadata?.traceId).toBe(testTraceId);
        expect(enriched.metadata?.tenantId).toBe('flux');
        expect(enriched.metadata?.enqueuedAt).toBeDefined();
      });
    });

    it('queue.add automatically binds active telemetry context to the created job', async () => {
      const queue = createQueue<any>('test-telemetry-queue');
      const testTraceId = 'trc_originating_request_888';

      await withTelemetryContext({ traceId: testTraceId, tenantId: 'smmplan' }, async () => {
        const job = await queue.add('test-task', { foo: 'bar' });

        expect(job.data.metadata).toBeDefined();
        expect(job.data.metadata.traceId).toBe(testTraceId);
        expect(job.data.metadata.tenantId).toBe('smmplan');
        expect(job.data.tenantId).toBe('smmplan');
      });
    });

    it('wrapWorkerProcessor restores traceId and tenantId into AsyncLocalStorage', async () => {
      let capturedTraceId: string | undefined;
      let capturedTenantId: string | undefined;

      const mockProcessor = vi.fn().mockImplementation(async (job: Job) => {
        capturedTraceId = getTraceId();
        capturedTenantId = tenantStorage.getStore()?.tenantId;
        return { success: true, processedOrder: (job.data as any).orderId };
      });

      const wrapped = wrapWorkerProcessor('OrderProcessor', mockProcessor);

      const mockJob = {
        id: 'job-99',
        data: {
          orderId: 'ord-xyz-1',
          tenantId: 'flux',
          metadata: {
            traceId: 'trc_restored_from_bullmq_123',
            tenantId: 'flux',
          },
        },
      } as unknown as Job;

      const result = await wrapped(mockJob as any);

      expect(result).toEqual({ success: true, processedOrder: 'ord-xyz-1' });
      expect(capturedTraceId).toBe('trc_restored_from_bullmq_123');
      expect(capturedTenantId).toBe('flux');
      expect(mockProcessor).toHaveBeenCalledTimes(1);
    });

    it('extractJobTraceContext handles undefined/null jobs gracefully without throwing', () => {
      const extracted = extractJobTraceContext(undefined);
      expect(extracted.traceId).toMatch(/^trc_/);
      expect(extracted.tenantId).toBe('smmplan');
    });

    it('queue.addBulk automatically enriches all jobs with distributed trace context', async () => {
      const queue = createQueue<any>('bulk-test-queue');
      const testTraceId = 'trc_bulk_parent_trace_555';

      await withTelemetryContext({ traceId: testTraceId, tenantId: 'flux' }, async () => {
        const jobs = await (queue as any).addBulk([
          { name: 'task-1', data: { item: 1 } },
          { name: 'task-2', data: { item: 2 } },
        ]);

        expect(jobs).toHaveLength(2);
        expect(jobs[0].data.metadata.traceId).toBe(testTraceId);
        expect(jobs[0].data.tenantId).toBe('flux');
        expect(jobs[1].data.metadata.traceId).toBe(testTraceId);
        expect(jobs[1].data.tenantId).toBe('flux');
      });
    });
  });

  // =========================================================================
  // MODULE 3: DUAL-FACED ERROR SANITIZER & SELF-CONTAINED REF
  // =========================================================================
  describe('Module 3: Dual-Faced Error Sanitizer & Self-Contained REF', () => {
    it('generates compact REF-XXXX-YYYY reference codes adhering to strict regex', () => {
      const codeDb = generateRefCode('DATABASE');
      const codePay = generateRefCode('PAYMENT');
      const codeAuth = generateRefCode('AUTH');
      const codeProv = generateRefCode('PROVIDER');
      const codeNet = generateRefCode('NETWORK');
      const codeGen = generateRefCode('UNKNOWN');

      const refRegex = /^REF-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

      expect(codeDb).toMatch(refRegex);
      expect(codeDb.startsWith('REF-DB01-')).toBe(true);

      expect(codePay).toMatch(refRegex);
      expect(codePay.startsWith('REF-PAYM-')).toBe(true);

      expect(codeAuth).toMatch(refRegex);
      expect(codeAuth.startsWith('REF-AUTH-')).toBe(true);

      expect(codeProv).toMatch(refRegex);
      expect(codeProv.startsWith('REF-PROV-')).toBe(true);

      expect(codeNet).toMatch(refRegex);
      expect(codeNet.startsWith('REF-NETW-')).toBe(true);

      expect(codeGen).toMatch(refRegex);
      expect(codeGen.startsWith('REF-SYST-')).toBe(true);
    });

    it('sanitizes fatal database errors without leaking internal connection strings or SQL', () => {
      const rawError = new Error(
        'PrismaClientInitializationError: Can\'t reach database server at postgresql://postgres:SuperSecretP@ssw0rd!@127.0.0.1:5432/smmplan in d:\\SMM_plan_2\\src\\lib\\db.ts'
      );

      const result = DualFacedErrorSanitizer.sanitize(rawError, {
        traceId: 'trc_incident_404',
        tenantId: 'smmplan',
        component: 'DatabaseLayer',
      });

      // Public face checks
      expect(result.public.refCode).toMatch(/^REF-DB01-[A-Z0-9]{4}$/);
      expect(result.public.title).toBe('Временная задержка связи с базой данных');
      expect(result.public.action?.type).toBe('RETRY');
      expect(result.public.message).toContain(result.public.refCode);

      // Verify ZERO leakage in public message
      expect(result.public.message).not.toContain('postgresql://');
      expect(result.public.message).not.toContain('SuperSecretP@ssw0rd');
      expect(result.public.message).not.toContain('127.0.0.1');
      expect(result.public.message).not.toContain('PrismaClientInitializationError');
      expect(result.public.message).not.toContain('d:\\SMM_plan_2');

      // Forensic report checks
      expect(result.forensic.refCode).toBe(result.public.refCode);
      expect(result.forensic.traceId).toBe('trc_incident_404');
      expect(result.forensic.category).toBe('DATABASE');
      expect(result.forensic.severity).toBe('CRITICAL');

      // Forensic log must mask sensitive connection passwords
      expect(result.forensic.sanitizedRawMessage).not.toContain('SuperSecretP@ssw0rd');
      expect(result.forensic.sanitizedRawMessage).toContain('*****');
    });

    it('sanitizes payment gateway signature failures with safe public instructions and masked secrets', () => {
      const rawError = 'Yookassa payment notification rejected: SIGNATURE_FAILED with secret key="sec_super_secret_webhook_token_9999"';

      const result = ErrorInterpreter.sanitizeDualFaced(rawError, {
        tenantId: 'flux',
        defaultSeverity: 'CRITICAL',
      });

      expect(result.public.refCode).toMatch(/^REF-PAYM-[A-Z0-9]{4}$/);
      expect(result.public.title).toBe('Ошибка платежного шлюза');
      expect(result.public.action?.type).toBe('SWITCH_GATEWAY');

      // Public must NOT contain raw token
      expect(result.public.message).not.toContain('sec_super_secret_webhook_token_9999');
      expect(result.public.message).not.toContain('SIGNATURE_FAILED');

      // Forensic must have redacted sensitive token
      expect(result.forensic.sanitizedRawMessage).not.toContain('sec_super_secret_webhook_token_9999');
      expect(result.forensic.sanitizedRawMessage).toContain('[REDACTED]');
    });

    it('handles unknown generic errors gracefully with fallback category and guidance', () => {
      const rawError = 'Some unexpected unhandled promise rejection in async worker';

      const result = DualFacedErrorSanitizer.sanitize(rawError);

      expect(result.public.refCode).toMatch(/^REF-SYST-[A-Z0-9]{4}$/);
      expect(result.public.title).toBe('Не удалось завершить операцию');
      expect(result.public.action?.type).toBe('SUPPORT_CHAT');
      expect(result.public.message).toContain(result.public.refCode);
      expect(result.forensic.category).toBe('GENERAL');
    });

    it('correctly redacts connection URLs without usernames and standalone JWT tokens', () => {
      const log1 = 'Connecting to redis://:SecretRedisPass123@localhost:6379/0';
      const log2 = 'Connecting to postgres://:SecretPostgresPass456@127.0.0.1:5432/smmplan';
      const log3 = 'User auth token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c in trace';

      expect(redactSensitiveTokens(log1)).toBe('Connecting to redis://:*****@localhost:6379/0');
      expect(redactSensitiveTokens(log2)).toBe('Connecting to postgres://:*****@127.0.0.1:5432/smmplan');
      expect(redactSensitiveTokens(log3)).toContain('[REDACTED_JWT]');
      expect(redactSensitiveTokens(log3)).not.toContain('eyJhbGci');
    });

    it('classifies Vector 6 (Financial ACID / LedgerEntry violation) into category FINANCE with REF-FINC code', () => {
      const rawError = new Error('LedgerEntry immutability violation: balance negative on debit');

      const result = DualFacedErrorSanitizer.sanitize(rawError, {
        tenantId: 'flux',
      });

      expect(result.public.refCode).toMatch(/^REF-FINC-[A-Z0-9]{4}$/);
      expect(result.public.title).toBe('Операция отклонена политикой безопасности баланса');
      expect(result.public.action?.type).toBe('SUPPORT_CHAT');
      expect(result.forensic.category).toBe('FINANCE');
      expect(result.forensic.severity).toBe('CRITICAL');
      expect(result.public.message).toContain(result.public.refCode);
    });

    it('classifies Vector 7 (Auth & Security Invariant) into category AUTH with REF-AUTH code', () => {
      const rawError = new Error('Session token expired or unauthorized access to /admin/finances');

      const result = DualFacedErrorSanitizer.sanitize(rawError);

      expect(result.public.refCode).toMatch(/^REF-AUTH-[A-Z0-9]{4}$/);
      expect(result.public.title).toBe('Требуется авторизация');
      expect(result.public.action?.type).toBe('RETRY');
      expect(result.forensic.category).toBe('AUTH');
      expect(result.public.message).toContain(result.public.refCode);
    });

    it('classifies Vector 5 (BullMQ Queue Exhaustion) into DLQ incident guidance', () => {
      const rawError = 'Job ordersQueue:ord-888 exhausted all 3 attempts. Last error: gateway timeout';

      const result = DualFacedErrorSanitizer.sanitize(rawError);

      expect(result.public.refCode).toMatch(/^REF-SYST-[A-Z0-9]{4}$/);
      expect(result.forensic.title).toBe('Сбой фоновой обработки в очереди BullMQ');
    });

    it('traverses Error.cause to classify wrapped root errors accurately', () => {
      const rootError = new Error('P2002: Unique constraint failed on LedgerEntry_idempotencyKey_key');
      const wrappedError = new Error('Order creation transaction failed', { cause: rootError });

      const result = DualFacedErrorSanitizer.sanitize(wrappedError);

      expect(result.public.refCode).toMatch(/^REF-FINC-[A-Z0-9]{4}$/);
      expect(result.forensic.category).toBe('FINANCE');
      expect(result.forensic.sanitizedRawMessage).toContain('Cause: P2002: Unique constraint failed');
    });
  });
});
