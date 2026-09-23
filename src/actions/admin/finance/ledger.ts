'use server';

/**
 * Finance Ledger Server Action — Sprint 1.6
 *
 * Paginated ledger entries with filters.
 * Security: Admin-only route (layout enforces enforcePageRole).
 * No requireAdmin wrapper needed — page is behind /admin layout guard.
 */

import { db } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { requireStaffPermission } from '@/lib/server/rbac';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';

const ledgerParamsSchema = z.object({
  status:   z.enum(['ALL', 'APPROVED', 'QUARANTINE', 'REJECT', 'REJECTED']).default('ALL'),
  type:     z.enum([
    'ALL', 'TOPUP', 'ORDER_CHARGE', 'ORDER_CANCEL',
    'REFUND', 'COMPENSATION', 'ADJUSTMENT', 'REROUTE', 'PAYMENT',
    'DEBIT', // legacy alias
  ]).default('ALL'),
  period:   z.enum(['today', 'week', 'month', 'all']).default('month'),
  search:   z.string().max(255).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
  cursor:   z.string().optional(),
  page:     z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  tenantId: z.string().optional(),
});

export type LedgerParams = z.infer<typeof ledgerParamsSchema>;

export type LedgerEntryDTO = {
  id: string;
  userId: string;
  userEmail: string;
  adminId: string | null;
  amount: number;
  reason: string;
  status: string;
  transactionType: string;
  idempotencyKey?: string | null;
  gatewayId?: string | null;
  createdAt: string;
  tenantId?: string;
};

export type LedgerPageResult = {
  items: LedgerEntryDTO[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  nextCursor: string | null;
  hasMore: boolean;
  totals: { approved: number; quarantine: number; refunds: number };
};

function getPeriodStart(period: string): Date | undefined {
  const now = new Date();
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (period === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }
  return undefined;
}

export async function getLedgerAction(params: Partial<LedgerParams>): Promise<LedgerPageResult | { success: false, error: string }> {
  try {
    return await requireStaffPermission('finance', 'view', async (admin) => {
      const p = ledgerParamsSchema.parse(params);
      const periodStart = getPeriodStart(p.period);

      const searchTrim = p.search?.trim();
      const activeTenantId = resolveAdminTenantContext(admin, p.tenantId);

      // Build type-based conditions and search using AND array to avoid OR collisions
      const andConditions: Prisma.LedgerEntryWhereInput[] = [];

      if (p.status !== 'ALL') {
        andConditions.push({ status: p.status });
      }

      // Date range filtering
      if (p.dateFrom) {
        const dFrom = new Date(p.dateFrom);
        if (!isNaN(dFrom.getTime())) {
          dFrom.setHours(0, 0, 0, 0);
          andConditions.push({ createdAt: { gte: dFrom } });
        }
      } else if (periodStart) {
        andConditions.push({ createdAt: { gte: periodStart } });
      }

      if (p.dateTo) {
        const dTo = new Date(p.dateTo);
        if (!isNaN(dTo.getTime())) {
          dTo.setHours(23, 59, 59, 999);
          andConditions.push({ createdAt: { lte: dTo } });
        }
      }

      // Amount range filtering (supporting both credits + and debits -)
      const minCents = p.minAmount !== undefined && !isNaN(p.minAmount) ? Math.round(p.minAmount * 100) : undefined;
      const maxCents = p.maxAmount !== undefined && !isNaN(p.maxAmount) ? Math.round(p.maxAmount * 100) : undefined;

      if (minCents !== undefined && maxCents !== undefined) {
        andConditions.push({
          OR: [
            { amount: { gte: minCents, lte: maxCents } },
            { amount: { gte: -maxCents, lte: -minCents } },
          ],
        });
      } else if (minCents !== undefined) {
        andConditions.push({
          OR: [
            { amount: { gte: minCents } },
            { amount: { lte: -minCents } },
          ],
        });
      } else if (maxCents !== undefined) {
        andConditions.push({
          OR: [
            { amount: { lte: maxCents, gte: 0 } },
            { amount: { gte: -maxCents, lte: 0 } },
          ],
        });
      }
      if (activeTenantId && activeTenantId !== 'all') {
        andConditions.push({
          OR: [
            { tenantId: activeTenantId },
            { user: { tenantId: activeTenantId } },
          ],
        });
      }

      if (p.type === 'TOPUP') {
        andConditions.push({
          OR: [
            { transactionType: 'TOPUP' },
            { transactionType: 'PAYMENT', amount: { gt: 0 } },
          ],
        });
      } else if (p.type === 'ORDER_CHARGE' || p.type === 'DEBIT') {
        andConditions.push({
          OR: [
            { transactionType: 'ORDER_CHARGE' },
            { transactionType: 'PAYMENT', amount: { lt: 0 } },
          ],
        });
      } else if (p.type === 'ORDER_CANCEL') {
        andConditions.push({ transactionType: 'ORDER_CANCEL' });
      } else if (p.type === 'REFUND') {
        andConditions.push({
          OR: [
            { transactionType: 'REFUND' },
            { reason: { contains: 'авто-возврат', mode: 'insensitive' as const } },
            { reason: { contains: 'Fail-Fast', mode: 'insensitive' as const } },
          ],
        });
      } else if (p.type === 'COMPENSATION') {
        andConditions.push({ transactionType: 'COMPENSATION' });
      } else if (p.type === 'ADJUSTMENT') {
        andConditions.push({
          OR: [
            { transactionType: 'ADJUSTMENT' },
            { transactionType: 'COMPENSATION', adminId: { not: null } },
          ],
        });
      } else if (p.type === 'REROUTE') {
        andConditions.push({
          OR: [
            { transactionType: 'REROUTE' },
            { reason: { contains: 'перезапуск', mode: 'insensitive' as const } },
          ],
        });
      } else if (p.type === 'PAYMENT') {
        andConditions.push({ transactionType: 'PAYMENT' });
      }

      if (searchTrim) {
        // Resolve any payments matching gatewayId (e.g. YooKassa UUID) or internal payment ID
        const matchingPayments = await db.payment.findMany({
          where: {
            ...(activeTenantId && activeTenantId !== 'all' ? { tenantId: activeTenantId } : {}),
            OR: [
              { gatewayId: { contains: searchTrim, mode: 'insensitive' as const } },
              { id: { contains: searchTrim, mode: 'insensitive' as const } }
            ]
          },
          select: { id: true },
          take: 50
        });

        const extraIdempotencyKeys: string[] = [];
        if (matchingPayments.length > 0) {
          const pIds = matchingPayments.map(p => p.id);
          for (const pid of pIds) {
            extraIdempotencyKeys.push(`deposit-${pid}`);
            extraIdempotencyKeys.push(`gateway-credit-${pid}`);
            extraIdempotencyKeys.push(`gateway-basket-charge-${pid}`);
          }
          const linkedOrders = await db.order.findMany({
            where: { paymentId: { in: pIds }, ...(activeTenantId && activeTenantId !== 'all' ? { tenantId: activeTenantId } : {}) },
            select: { id: true },
            take: 50
          });
          for (const ord of linkedOrders) {
            extraIdempotencyKeys.push(`gateway-charge-${ord.id}`);
          }
        }

        const searchOrConditions: Prisma.LedgerEntryWhereInput[] = [
          { user: { is: { email: { contains: searchTrim, mode: 'insensitive' as const } } } },
          { id: { contains: searchTrim, mode: 'insensitive' as const } },
          { idempotencyKey: { contains: searchTrim, mode: 'insensitive' as const } },
          { reason: { contains: searchTrim, mode: 'insensitive' as const } }
        ];

        if (extraIdempotencyKeys.length > 0) {
          searchOrConditions.push({
            idempotencyKey: { in: extraIdempotencyKeys }
          });
        }

        andConditions.push({
          OR: searchOrConditions
        });
      }

      const where: Prisma.LedgerEntryWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

      const skip = (p.page - 1) * p.pageSize;

      const [totalCount, entries, approvedAgg, quarantineAgg, refundsAgg] = await Promise.all([
        db.ledgerEntry.count({ where }),
        db.ledgerEntry.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: p.pageSize,
          skip,
          select: {
            id: true,
            userId: true,
            adminId: true,
            amount: true,
            reason: true,
            status: true,
            transactionType: true,
            idempotencyKey: true,
            createdAt: true,
            tenantId: true,
            user: {
              select: {
                email: true,
                tenantId: true,
              },
            },
          },
        }),
        db.ledgerEntry.aggregate({ _sum: { amount: true }, where: { ...where, status: 'APPROVED', amount: { gt: 0 } } }),
        db.ledgerEntry.aggregate({ _sum: { amount: true }, where: { ...where, status: 'QUARANTINE' } }),
        db.ledgerEntry.aggregate({ _sum: { amount: true }, where: { ...where, status: 'APPROVED', amount: { lt: 0 } } }),
      ]);

      const totalPages = Math.ceil(totalCount / p.pageSize) || 1;
      const hasMore = p.page < totalPages;

      // Batch fetch gatewayIds for entries linked to payments
      const candidatePaymentIds: string[] = [];
      for (const e of entries) {
        if (e.idempotencyKey) {
          const match = e.idempotencyKey.match(/^(?:deposit|gateway-credit|gateway-basket-charge)-(cm[a-z0-9]+)$/i);
          if (match?.[1]) {
            candidatePaymentIds.push(match[1]);
          }
        }
      }

      const paymentGatewayMap = new Map<string, string>();
      if (candidatePaymentIds.length > 0) {
        const foundPayments = await db.payment.findMany({
          where: { 
            id: { in: Array.from(new Set(candidatePaymentIds)) },
            ...(activeTenantId && activeTenantId !== 'all' ? { tenantId: activeTenantId } : {})
          },
          select: { id: true, gatewayId: true }
        });
        for (const fp of foundPayments) {
          if (fp.gatewayId) {
            paymentGatewayMap.set(fp.id, fp.gatewayId);
          }
        }
      }

      return {
        items: entries.map(e => {
          const paymentIdMatch = e.idempotencyKey?.match(/^(?:deposit|gateway-credit|gateway-basket-charge)-(cm[a-z0-9]+)$/i);
          const paymentId = paymentIdMatch?.[1];
          const gatewayId = paymentId ? (paymentGatewayMap.get(paymentId) ?? null) : null;

          return {
            id: e.id,
            userId: e.userId,
            userEmail: e.user?.email ?? e.userId,
            adminId: e.adminId,
            amount: Number(e.amount), // BigInt → number at DTO boundary
            reason: e.reason,
            status: e.status,
            transactionType: e.transactionType || (Number(e.amount) >= 0 ? 'PAYMENT' : 'DEBIT'),
            idempotencyKey: e.idempotencyKey ?? null,
            gatewayId,
            createdAt: e.createdAt.toISOString(),
            tenantId: e.tenantId ?? e.user?.tenantId ?? 'smmplan',
          };
        }),
        totalCount,
        totalPages,
        currentPage: p.page,
        pageSize: p.pageSize,
        nextCursor: hasMore && entries.length > 0 ? entries[entries.length - 1].id : null,
        hasMore,
        totals: {
          approved: Number(approvedAgg._sum?.amount ?? 0),
          quarantine: Number(quarantineAgg._sum?.amount ?? 0),
          refunds: Math.abs(Number(refundsAgg._sum?.amount ?? 0)),
        },
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки записей Ledger';
    return { success: false, error: message };
  }
}
