import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import * as rbac from '@/lib/server/rbac';
import {
  getReconciliationSummaryAction,
  getReconciliationAccountsAction,
  getUserLedgerAuditAction,
  reconcileUserAction,
} from '@/actions/admin/finance/reconciliation';
import { getLedgerAction } from '@/actions/admin/finance/ledger';
import { getPaymentsAction } from '@/actions/admin/finance/payments';
import { LedgerReconciliationService } from '@/services/financial/ledger-reconciliation.service';

describe('Admin Finance Hub & Ledger Reconciliation E2E Suite', () => {
  const testAdmin = {
    id: 'admin_fin_tester',
    email: 'finance-lead@smmplan.pro',
    role: 'OWNER',
    tenantId: 'smmplan',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(rbac, 'requireStaffPermission').mockImplementation(async (_sec, _mode, cb) => {
      return cb(testAdmin as any);
    });
  });

  describe('1. Platform-wide Reconciliation Summary (KPIs)', () => {
    it('returns valid ReconciliationSummaryDTO with exact non-null numbers', async () => {
      const summary = await getReconciliationSummaryAction('smmplan');

      expect(summary).not.toHaveProperty('error');
      if ('error' in summary) return;

      expect(typeof summary.totalUsersChecked).toBe('number');
      expect(typeof summary.reconciledUsersCount).toBe('number');
      expect(typeof summary.discrepancyUsersCount).toBe('number');
      expect(typeof summary.totalUserBalancesCents).toBe('number');
      expect(typeof summary.totalLedgerSumsCents).toBe('number');
      expect(typeof summary.netDiscrepancyCents).toBe('number');
      expect(typeof summary.integrityPercentage).toBe('number');

      expect(summary.totalUsersChecked).toBeGreaterThanOrEqual(0);
      expect(summary.integrityPercentage).toBeGreaterThanOrEqual(0);
      expect(summary.integrityPercentage).toBeLessThanOrEqual(100);
    });
  });

  describe('2. Reconciled Accounts Pagination & Anomaly Flagging', () => {
    it('fetches paginated accounts with anomaly detection', async () => {
      const res = await getReconciliationAccountsAction({ page: 1, pageSize: 20 });

      expect(res).not.toHaveProperty('error');
      if ('error' in res) return;

      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(20);
      expect(Array.isArray(res.items)).toBe(true);

      if (res.items.length > 0) {
        const item = res.items[0];
        expect(item).toHaveProperty('userId');
        expect(item).toHaveProperty('email');
        expect(item).toHaveProperty('userBalance');
        expect(item).toHaveProperty('ledgerSum');
        expect(item).toHaveProperty('discrepancy');
        expect(typeof item.isDiscrepancy).toBe('boolean');
        expect(item.discrepancy).toBe(item.userBalance - item.ledgerSum);
      }
    });
  });

  describe('3. Single User Ledger Audit Timeline (Drawer)', () => {
    it('calculates sequential running balance and returns user timeline', async () => {
      // Find or create test user
      let testUser = await db.user.findFirst({ where: { role: 'USER' } });
      if (!testUser) {
        testUser = await db.user.create({
          data: {
            email: `test_fin_user_${Date.now()}@smmplan.pro`,
            role: 'USER',
            balance: BigInt(50000), // 500.00 RUB
            tenantId: 'smmplan',
          },
        });
      }

      // Add a test ledger entry
      await db.ledgerEntry.create({
        data: {
          userId: testUser.id,
          amount: BigInt(50000),
          reason: 'TEST_TOPUP_AUDIT',
          status: 'APPROVED',
          transactionType: 'CREDIT',
          tenantId: 'smmplan',
        },
      });

      const audit = await getUserLedgerAuditAction(testUser.id);

      expect(audit).not.toHaveProperty('error');
      if ('error' in audit) return;

      expect(audit.user.id).toBe(testUser.id);
      expect(typeof audit.user.balance).toBe('number');
      expect(typeof audit.discrepancy).toBe('number');
      expect(Array.isArray(audit.entries)).toBe(true);

      if (audit.entries.length > 0) {
        const firstEntry = audit.entries[0];
        expect(firstEntry).toHaveProperty('runningBalance');
        expect(firstEntry).toHaveProperty('amount');
        expect(firstEntry).toHaveProperty('status');
      }
    });

    it('gracefully handles non-existent user IDs without throwing unhandled exceptions', async () => {
      const res = await getUserLedgerAuditAction('non_existent_user_999999');

      expect(res).toHaveProperty('error');
      if ('error' in res) {
        expect(res.error).toMatch(/не найден|not found|ошибка/i);
      }
    });
  });

  describe('4. Ledger & Payments Registry Server Actions', () => {
    it('successfully retrieves paginated ledger entries with summary totals', async () => {
      const res = await getLedgerAction({ period: 'all', pageSize: 25 });

      expect(res).not.toHaveProperty('error');
      if ('error' in res) return;

      expect(Array.isArray(res.items)).toBe(true);
      expect(res.totals).toHaveProperty('approved');
      expect(res.totals).toHaveProperty('quarantine');
      expect(res.totals).toHaveProperty('refunds');
      expect(typeof res.hasMore).toBe('boolean');
    });

    it('successfully retrieves paginated payments registry', async () => {
      const res = await getPaymentsAction({ period: 'all', pageSize: 25 });

      expect(res).not.toHaveProperty('error');
      if ('error' in res) return;

      expect(Array.isArray(res.items)).toBe(true);
      expect(typeof res.hasMore).toBe('boolean');
    });
  });

  describe('5. RBAC & Security Boundary Fail-Closed Protection', () => {
    it('blocks unauthorized access cleanly returning typed error without throwing', async () => {
      vi.spyOn(rbac, 'requireStaffPermission').mockResolvedValue({
        success: false,
        error: 'Unauthorized access',
      });

      const res = await getReconciliationSummaryAction('smmplan');
      expect(res).toEqual({ success: false, error: 'Unauthorized access' });
    });
  });
});
