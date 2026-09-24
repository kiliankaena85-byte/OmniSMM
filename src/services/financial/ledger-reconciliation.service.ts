import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { auditAdminAwaitable } from '@/lib/admin-audit';

export interface ReconciliationSummaryDTO {
  totalUsersChecked: number;
  reconciledUsersCount: number;
  discrepancyUsersCount: number;
  totalUserBalancesCents: number;
  totalLedgerSumsCents: number;
  netDiscrepancyCents: number;
  integrityPercentage: number;
}

export interface ReconciledAccountDTO {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  isActive: boolean;
  userBalance: number;       // Cents converted to number
  ledgerSum: number;         // Cents converted to number
  discrepancy: number;       // userBalance - ledgerSum
  isDiscrepancy: boolean;
  entriesCount: number;
  lastLedgerAt: string | null;
}

export interface UserAuditTimelineDTO {
  user: {
    id: string;
    email: string;
    balance: number;
    quarantineBalance: number;
    totalSpent: number;
    isActive: boolean;
    role: string;
    createdAt: string;
  };
  discrepancy: number;
  isDiscrepancy: boolean;
  entries: Array<{
    id: string;
    amount: number;
    runningBalance: number;
    reason: string;
    status: string;
    transactionType: string;
    adminId: string | null;
    idempotencyKey: string | null;
    createdAt: string;
  }>;
}

export class LedgerReconciliationService {
  /**
   * Fast platform-wide summary statistics using high-performance SQL aggregation.
   * Compares User.balance with SUM(LedgerEntry.amount WHERE status = 'APPROVED').
   */
  static async getSummary(tenantId?: string): Promise<ReconciliationSummaryDTO> {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const tenantFilter = isSingleTenant ? Prisma.sql`AND u."tenantId" = ${tenantId}` : Prisma.empty;

    const rows = await db.$queryRaw<Array<{
      total_users: bigint;
      reconciled_count: bigint;
      discrepancy_count: bigint;
      total_user_balances: bigint | null;
      total_ledger_sums: bigint | null;
      net_discrepancy: bigint | null;
    }>>`
      WITH user_ledger_agg AS (
        SELECT 
          u.id AS user_id,
          u.balance AS user_balance,
          COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'APPROVED'), 0)::BIGINT AS ledger_sum
        FROM "User" u
        LEFT JOIN "LedgerEntry" l ON l."userId" = u.id
        WHERE u."isDeleted" = false
          ${tenantFilter}
        GROUP BY u.id, u.balance
      )
      SELECT 
        COUNT(*)::BIGINT AS total_users,
        COUNT(*) FILTER (WHERE user_balance = ledger_sum)::BIGINT AS reconciled_count,
        COUNT(*) FILTER (WHERE user_balance != ledger_sum)::BIGINT AS discrepancy_count,
        COALESCE(SUM(user_balance), 0)::BIGINT AS total_user_balances,
        COALESCE(SUM(ledger_sum), 0)::BIGINT AS total_ledger_sums,
        COALESCE(SUM(user_balance - ledger_sum), 0)::BIGINT AS net_discrepancy
      FROM user_ledger_agg;
    `;

    const r = rows[0] || {
      total_users: BigInt(0),
      reconciled_count: BigInt(0),
      discrepancy_count: BigInt(0),
      total_user_balances: BigInt(0),
      total_ledger_sums: BigInt(0),
      net_discrepancy: BigInt(0)
    };

    const total = Number(r.total_users);
    const reconciled = Number(r.reconciled_count);
    const discrepancy = Number(r.discrepancy_count);
    const pct = total > 0 ? (reconciled / total) * 100 : 100;

    return {
      totalUsersChecked: total,
      reconciledUsersCount: reconciled,
      discrepancyUsersCount: discrepancy,
      totalUserBalancesCents: Number(r.total_user_balances ?? 0),
      totalLedgerSumsCents: Number(r.total_ledger_sums ?? 0),
      netDiscrepancyCents: Number(r.net_discrepancy ?? 0),
      integrityPercentage: Number(pct.toFixed(2)),
    };
  }

  /**
   * Paginated list of accounts with discrepancies flagged & sorted first.
   */
  static async getAccounts(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    onlyAnomalies?: boolean;
    tenantId?: string;
  }): Promise<{ items: ReconciledAccountDTO[]; totalCount: number; page: number; pageSize: number }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize || 50));
    const offset = (page - 1) * pageSize;
    const isSingleTenant = params.tenantId && params.tenantId !== 'all';
    const searchTrim = params.search?.trim();
    const onlyAnomalies = params.onlyAnomalies ?? false;

    const tenantFilter = isSingleTenant ? Prisma.sql`AND u."tenantId" = ${params.tenantId}` : Prisma.empty;
    const searchFilter = searchTrim ? Prisma.sql`AND (u.email ILIKE ${'%' + searchTrim + '%'} OR u.id = ${searchTrim})` : Prisma.empty;
    const havingFilter = onlyAnomalies ? Prisma.sql`HAVING u.balance != COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'APPROVED'), 0)` : Prisma.empty;

    const rows = await db.$queryRaw<Array<{
      user_id: string;
      email: string;
      tenant_id: string;
      role: string;
      is_active: boolean;
      user_balance: bigint;
      ledger_sum: bigint;
      discrepancy: bigint;
      entries_count: bigint;
      last_ledger_at: Date | null;
      full_count: bigint;
    }>>`
      WITH user_ledger_agg AS (
        SELECT 
          u.id AS user_id,
          u.email,
          u."tenantId" AS tenant_id,
          u.role,
          u."isActive" AS is_active,
          u.balance AS user_balance,
          COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'APPROVED'), 0)::BIGINT AS ledger_sum,
          (u.balance - COALESCE(SUM(l.amount) FILTER (WHERE l.status = 'APPROVED'), 0))::BIGINT AS discrepancy,
          COUNT(l.id)::BIGINT AS entries_count,
          MAX(l."createdAt") AS last_ledger_at
        FROM "User" u
        LEFT JOIN "LedgerEntry" l ON l."userId" = u.id
        WHERE u."isDeleted" = false
          ${tenantFilter}
          ${searchFilter}
        GROUP BY u.id, u.email, u."tenantId", u.role, u."isActive", u.balance
        ${havingFilter}
      )
      SELECT *, COUNT(*) OVER()::BIGINT AS full_count
      FROM user_ledger_agg
      ORDER BY 
        CASE WHEN discrepancy != 0 THEN 0 ELSE 1 END,
        ABS(discrepancy) DESC,
        email ASC
      LIMIT ${pageSize} OFFSET ${offset};
    `;

    const totalCount = rows.length > 0 ? Number(rows[0].full_count) : 0;

    const items: ReconciledAccountDTO[] = rows.map((r) => {
      const userBalance = Number(r.user_balance);
      const ledgerSum = Number(r.ledger_sum);
      const discrepancy = Number(r.discrepancy);
      return {
        userId: r.user_id,
        email: r.email,
        tenantId: r.tenant_id,
        role: r.role,
        isActive: r.is_active,
        userBalance,
        ledgerSum,
        discrepancy,
        isDiscrepancy: discrepancy !== 0,
        entriesCount: Number(r.entries_count),
        lastLedgerAt: r.last_ledger_at ? r.last_ledger_at.toISOString() : null,
      };
    });

    return { items, totalCount, page, pageSize };
  }

  /**
   * Detailed transaction timeline & running balance calculation for single user.
   * Calculates sequential running balance from earliest to latest, then reverses for display.
   */
  static async getUserAuditTimeline(userId: string): Promise<UserAuditTimelineDTO> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        balance: true,
        quarantineBalance: true,
        totalSpent: true,
        isActive: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new Error(`Пользователь с ID ${userId} не найден`);
    }

    const entries = await db.ledgerEntry.findMany({
      where: {
        userId,
        ...(user.tenantId ? { tenantId: user.tenantId } : {}),
      },
      orderBy: [
        { createdAt: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        amount: true,
        reason: true,
        status: true,
        transactionType: true,
        adminId: true,
        idempotencyKey: true,
        createdAt: true,
      },
    });

    let running = 0;
    const mappedEntries = entries.map((e) => {
      const amt = Number(e.amount);
      if (e.status === 'APPROVED') {
        running += amt;
      }
      return {
        id: e.id,
        amount: amt,
        runningBalance: running,
        reason: e.reason,
        status: e.status,
        transactionType: e.transactionType,
        adminId: e.adminId,
        idempotencyKey: e.idempotencyKey,
        createdAt: e.createdAt.toISOString(),
      };
    });

    const userBalanceNum = Number(user.balance);
    const discrepancy = userBalanceNum - running;

    return {
      user: {
        id: user.id,
        email: user.email,
        balance: userBalanceNum,
        quarantineBalance: Number(user.quarantineBalance),
        totalSpent: Number(user.totalSpent),
        isActive: user.isActive,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      },
      discrepancy,
      isDiscrepancy: discrepancy !== 0,
      entries: mappedEntries.reverse(), // Most recent first for display
    };
  }

  /**
   * Perform administrative remediation: Lock account or Auto-Balance.
   * Runs in an atomic Serializable transaction with complete audit logging.
   */
  static async remediateUser(
    userId: string,
    action: 'LOCK' | 'AUTO_ADJUST',
    admin: { id: string; email: string },
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    return await db.$transaction(
      async (tx) => {
        const freshUser = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const ledgerAgg = await tx.ledgerEntry.aggregate({
        _sum: { amount: true },
        where: {
          userId,
          status: 'APPROVED',
          ...(freshUser.tenantId ? { tenantId: freshUser.tenantId } : {}),
        },
      });
      const ledgerSum = ledgerAgg._sum.amount ?? BigInt(0);
      const diff = freshUser.balance - ledgerSum;

      if (action === 'LOCK') {
        const adminNoteText = `[RECONCILIATION GUARD] Заблокировано администратором ${admin.email}. Причина: ${reason || 'Финансовое расхождение'}`;
        await tx.user.update({
          where: { id: userId },
          data: {
            isActive: false,
            adminNote: adminNoteText,
            adminNoteUpdatedAt: new Date(),
            adminNoteUpdatedBy: admin.email,
          },
        });

        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'USER_LOCK_RECONCILIATION',
          target: userId,
          targetType: 'USER',
          oldValue: { isActive: freshUser.isActive, balance: freshUser.balance.toString() },
          newValue: { isActive: false, reason: reason || 'Финансовое расхождение' },
        });

        return { success: true, message: `Аккаунт ${freshUser.email} успешно заблокирован.` };
      }

      if (action === 'AUTO_ADJUST') {
        if (diff === BigInt(0)) {
          return { success: true, message: 'Расхождений не обнаружено — баланс сходится.' };
        }

        // Creating a compensating ledger entry aligns ledgerSum with user.balance
        const idempotencyKey = `reconcile-fix-${userId}-${diff.toString()}`;

        await tx.ledgerEntry.create({
          data: {
            userId,
            adminId: admin.id,
            amount: diff,
            reason: `[RECONCILIATION_FIX] Авто-выравнивание баланса: ${reason || 'Коррекция расхождения'}`,
            status: 'APPROVED',
            idempotencyKey,
            transactionType: 'COMPENSATION',
            tenantId: freshUser.tenantId,
          },
        });

        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'RECONCILIATION_AUTO_ADJUST',
          target: userId,
          targetType: 'USER',
          oldValue: { balance: freshUser.balance.toString(), ledgerSum: ledgerSum.toString() },
          newValue: { adjustmentCents: diff.toString(), reason: reason || 'Коррекция расхождения' },
        });

        return { success: true, message: `Баланс и проводки пользователя ${freshUser.email} успешно синхронизированы.` };
      }

      throw new Error(`Неизвестное действие: ${action}`);
    }, { isolationLevel: 'Serializable', timeout: 15000, maxWait: 10000 });
  }
}
