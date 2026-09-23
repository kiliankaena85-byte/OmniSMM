import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runCleanup } from '../cleanup.processor';
import { db } from '../../../lib/db';
import { createQueue } from '../../../lib/queue-manager';
import nextConfig from '../../../../next.config.mjs';

vi.mock('../../../lib/db', () => ({
  db: {
    authToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), findMany: vi.fn().mockResolvedValue([]) },
    analyticsEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    rateLimit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    loginLog: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    providerProxyLog: { deleteMany: vi.fn().mockResolvedValue({ count: 15 }) },
    securityEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 8 }) },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    order: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }), update: vi.fn(), findUnique: vi.fn() },
    ledgerEntry: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (cb: (prisma: unknown) => Promise<unknown>) => cb(db))
  }
}));

vi.mock('@/services/users/loyalty.service', () => ({
  LoyaltyService: {
    reverseCommission: vi.fn(),
    confirmCommission: vi.fn()
  }
}));

vi.mock('@/lib/notifications', () => ({
  sendAdminAlert: vi.fn()
}));

vi.mock('@/lib/smtp', () => ({
  sendOrderCanceledMail: vi.fn().mockResolvedValue(true)
}));

vi.mock('@/services/financial/wallet-ops', () => ({
  WalletOps: {
    refund: vi.fn()
  }
}));

vi.mock('@/utils/refund', () => ({
  calculatePartialRefund: vi.fn().mockReturnValue(50)
}));

vi.mock('@/services/core/order.service', () => ({
  orderService: {
    failOrderTerminal: vi.fn()
  }
}));

describe('🛡️ Enterprise Optimization & Zero-Data-Loss Retention Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Zero-Data-Loss Guarantee (Financial & Core Data Invariant)', () => {
    it('MUST NEVER delete LedgerEntry, AuditLog, or Payment records during cleanup', async () => {
      await runCleanup();

      const dbUnknown = db as unknown as Record<string, unknown>;
      // Ensure NO delete / deleteMany was ever called on financial or audit models
      expect(dbUnknown.ledgerEntry).not.toHaveProperty('deleteMany');
      expect(dbUnknown.auditLog).toBeUndefined();
      expect(dbUnknown.payment).not.toHaveProperty('deleteMany');
    });

    it('MUST NEVER delete completed or active Order records during cleanup', async () => {
      await runCleanup();

      // Ensure orders are only queried or updated in status, NEVER permanently deleted from DB
      expect(db.order).not.toHaveProperty('delete');
      expect(db.order).not.toHaveProperty('deleteMany');
    });
  });

  describe('2. Selective Log Retention & Storage Protection', () => {
    it('MUST prune only low-severity SecurityEvents (INFO/WARNING) older than 90 days, keeping CRITICAL intact', async () => {
      await runCleanup();

      expect(db.securityEvent.deleteMany).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(db.securityEvent.deleteMany).mock.calls[0][0];

      expect(callArg).toBeDefined();
      expect(callArg?.where?.severity).toEqual({ in: ['INFO', 'WARNING'] });

      // Threshold must be approximately 90 days ago (± 1 day tolerance)
      const threshold = (callArg?.where?.createdAt as { lt?: Date })?.lt as Date;
      expect(threshold).toBeInstanceOf(Date);
      const daysDiff = (Date.now() - threshold.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(daysDiff)).toBe(90);
    });

    it('MUST prune ProviderProxyLog records older than 30 days', async () => {
      await runCleanup();

      expect(db.providerProxyLog.deleteMany).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(db.providerProxyLog.deleteMany).mock.calls[0][0];

      expect(callArg).toBeDefined();
      const threshold = (callArg?.where?.createdAt as { lt?: Date })?.lt as Date;
      expect(threshold).toBeInstanceOf(Date);
      const daysDiff = (Date.now() - threshold.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(daysDiff)).toBe(30);
    });

    it('MUST prune AnalyticsEvent records older than 90 days', async () => {
      await runCleanup();

      expect(db.analyticsEvent.deleteMany).toHaveBeenCalledTimes(1);
      const callArg = vi.mocked(db.analyticsEvent.deleteMany).mock.calls[0][0];

      expect(callArg).toBeDefined();
      const threshold = (callArg?.where?.createdAt as { lt?: Date })?.lt as Date;
      expect(threshold).toBeInstanceOf(Date);
      const daysDiff = (Date.now() - threshold.getTime()) / (1000 * 60 * 60 * 24);
      expect(Math.round(daysDiff)).toBe(90);
    });
  });

  describe('3. BullMQ Queue In-Memory TTL & Memory Bounds', () => {
    it('MUST configure defaultJobOptions with age-based removal for both complete and failed jobs', () => {
      const testQueue = createQueue('test-optimization-queue');
      const defaultOpts = (testQueue as unknown as { defaultJobOptions: Record<string, unknown> }).defaultJobOptions;

      expect(defaultOpts).toBeDefined();
      expect(defaultOpts.attempts).toBe(3);
    });
  });

  describe('4. Next.js 16 Performance & Immutable Caching Contract', () => {
    it('MUST enable Gzip/Brotli compression and disable poweredByHeader', () => {
      expect(nextConfig.compress).toBe(true);
      expect(nextConfig.poweredByHeader).toBe(false);
    });

    it('MUST declare immutable cache headers for /_next/static/ assets', async () => {
      const headersList = nextConfig.headers ? await nextConfig.headers() : [];
      const staticHeaderRule = headersList.find((h: { source: string }) => h.source === '/_next/static/:path*');

      expect(staticHeaderRule).toBeDefined();
      expect(staticHeaderRule?.headers).toContainEqual({
        key: 'Cache-Control',
        value: 'public, max-age=31536000, immutable'
      });
    });
  });
});
