import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SystemLogsFilterSchema, type SystemLogsFilter } from '@/types/system-logs.dto';
import { SYSTEM_TABS, ONBOARDING_CONFIGS } from '@/components/admin/navigation-data';
import { redactSensitiveTokens, maskEmail } from '@/lib/logger/sensitive-data-filter';

// Mock DB
vi.mock('@/lib/db', () => ({
  db: {
    securityEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    loginLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    adminAuditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    telegramErrorLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock RBAC
vi.mock('@/lib/server/rbac', () => ({
  requireStaffPermission: vi.fn((section, mode, callback) => {
    return callback({ id: 'admin-1', email: 'owner@smmplan.pro', role: 'OWNER' }, null, 'smmplan');
  }),
}));

describe('Admin System Logs Suite (/admin/system/logs)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DTO & Filter Validation (SystemLogsFilterSchema)', () => {
    it('applies defaults correctly for empty payload', () => {
      const parsed = SystemLogsFilterSchema.parse({});
      expect(parsed.category).toBe('security');
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(25);
    });

    it('accepts valid category options', () => {
      const categories: SystemLogsFilter['category'][] = ['security', 'logins', 'audit', 'telegram'];
      for (const cat of categories) {
        const parsed = SystemLogsFilterSchema.parse({ category: cat });
        expect(parsed.category).toBe(cat);
      }
    });

    it('rejects invalid category', () => {
      expect(() => SystemLogsFilterSchema.parse({ category: 'unknown_cat' })).toThrow();
    });

    it('bounds pageSize to [10, 100]', () => {
      expect(() => SystemLogsFilterSchema.parse({ pageSize: 5 })).toThrow();
      expect(() => SystemLogsFilterSchema.parse({ pageSize: 150 })).toThrow();
      const valid = SystemLogsFilterSchema.parse({ pageSize: 50 });
      expect(valid.pageSize).toBe(50);
    });
  });

  describe('Navigation & Onboarding Integrity', () => {
    it('registers /admin/system/logs in SYSTEM_TABS', () => {
      const tab = SYSTEM_TABS.find((t) => t.href === '/admin/system/logs');
      expect(tab).toBeDefined();
      expect(tab?.label).toBe('Системные логи');
    });

    it('provides onboarding config for system logs', () => {
      const config = (ONBOARDING_CONFIGS as Record<string, unknown>)['logs'] as { description: string; faqs: Array<{ q: string; a: string }> } | undefined;
      expect(config).toBeDefined();
      expect(config?.description).toContain('лог');
      expect(config?.faqs.length).toBeGreaterThan(0);
    });
  });

  describe('PII Masking and Token Redaction in Log Stream', () => {
    it('masks sensitive tokens in JSON details', () => {
      const sensitivePayload = JSON.stringify({
        apiKey: 'sk_live_secret_12345678901234567890',
        token: 'ey1234567890abcdef',
        action: 'WEBHOOK_FAILED',
        reason: 'Invalid signature',
      });

      const sanitized = redactSensitiveTokens(sensitivePayload);
      expect(sanitized).not.toContain('sk_live_secret_12345678901234567890');
      expect(sanitized).toContain('[REDACTED]');
      expect(sanitized).toContain('WEBHOOK_FAILED');
    });

    it('masks user email in login logs properly', () => {
      expect(maskEmail('customer@example.com')).toBe('c***@example.com');
      expect(maskEmail('admin@smmplan.pro')).toBe('a***@smmplan.pro');
    });
  });

  describe('Server Action Contract Execution', () => {
    it('fetches system logs securely with typed result', async () => {
      const { getSystemLogs } = await import('@/actions/admin/system-logs');
      const { db } = await import('@/lib/db');

      (db.securityEvent.findMany as any).mockResolvedValueOnce([
        {
          id: 'sec-1',
          tenantId: 'smmplan',
          event: 'SIGNATURE_FAILED',
          severity: 'CRITICAL',
          ip: '192.168.1.1',
          details: { reason: 'HMAC mismatch' },
          createdAt: new Date('2026-09-25T10:00:00Z'),
        },
      ]);
      (db.securityEvent.count as any).mockResolvedValue(1);
      (db.loginLog.count as any).mockResolvedValue(0);
      (db.adminAuditLog.count as any).mockResolvedValue(0);
      (db.telegramErrorLog.count as any).mockResolvedValue(0);

      const res = await getSystemLogs({ category: 'security', page: 1, pageSize: 25 });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.items).toHaveLength(1);
        expect(res.data.items[0].id).toBe('sec-1');
        expect((res.data.items[0] as any).event).toBe('SIGNATURE_FAILED');
        expect(res.data.total).toBe(1);
        expect(res.data.stats.securityCount).toBe(1);
      }
    });
  });
});
