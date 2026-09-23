'use server';

/**
 * Admin Payments Server Action — Dispute Pack & Registry
 *
 * Security: Staff permission check ('finance', 'view').
 */

import { db } from '@/lib/db';
import { z } from 'zod';
import { requireStaffPermission } from '@/lib/server/rbac';
import { resolveAdminTenantContext } from '@/utils/admin-tenant';
import { WalletOps } from '@/services/financial/wallet-ops';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { revalidatePath } from 'next/cache';

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // ignore outside Next.js request context (e.g. in vitest runner)
  }
}

const paymentsParamsSchema = z.object({
  status:   z.enum(['ALL', 'PENDING', 'SUCCEEDED', 'CANCELED']).default('ALL'),
  period:   z.enum(['today', 'week', 'month', 'all']).default('month'),
  gateway:  z.string().optional(),
  search:   z.string().max(255).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  dateFrom: z.string().optional(),
  dateTo:   z.string().optional(),
  cursor:   z.string().optional(),
  pageSize: z.number().int().min(1).max(200).default(50),
  tenantId: z.string().optional(),
});

export type PaymentsParams = z.infer<typeof paymentsParamsSchema>;

export type PaymentDTO = {
  id: string;
  userId: string;
  userEmail: string;
  amount: number; // in Cents at DB layer, passed as number
  currency: string;
  status: string;
  gateway: string;
  gatewayId: string | null;
  consentIp: string | null;
  consentUserAgent: string | null;
  createdAt: string;
  tenantId: string;
};

export type PaymentsPageResult = {
  items: PaymentDTO[];
  nextCursor: string | null;
  hasMore: boolean;
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

export async function getPaymentsAction(params: Partial<PaymentsParams>): Promise<PaymentsPageResult | { success: false, error: string }> {
  try {
    return await requireStaffPermission('finance', 'view', async (admin) => {
      const p = paymentsParamsSchema.parse(params);
      const periodStart = getPeriodStart(p.period);

      const searchTrim = p.search?.trim();
      const activeTenantId = resolveAdminTenantContext(admin, p.tenantId);

      // Date filtering
      let createdAtFilter: { gte?: Date; lte?: Date } | undefined = undefined;
      if (p.dateFrom) {
        const dFrom = new Date(p.dateFrom);
        if (!isNaN(dFrom.getTime())) {
          dFrom.setHours(0, 0, 0, 0);
          createdAtFilter = { ...(createdAtFilter || {}), gte: dFrom };
        }
      } else if (periodStart) {
        createdAtFilter = { ...(createdAtFilter || {}), gte: periodStart };
      }

      if (p.dateTo) {
        const dTo = new Date(p.dateTo);
        if (!isNaN(dTo.getTime())) {
          dTo.setHours(23, 59, 59, 999);
          createdAtFilter = { ...(createdAtFilter || {}), lte: dTo };
        }
      }

      // Amount filtering (in cents)
      const minCents = p.minAmount !== undefined && !isNaN(p.minAmount) ? Math.round(p.minAmount * 100) : undefined;
      const maxCents = p.maxAmount !== undefined && !isNaN(p.maxAmount) ? Math.round(p.maxAmount * 100) : undefined;
      let amountFilter: { gte?: number; lte?: number } | undefined = undefined;
      if (minCents !== undefined) {
        amountFilter = { ...(amountFilter || {}), gte: minCents };
      }
      if (maxCents !== undefined) {
        amountFilter = { ...(amountFilter || {}), lte: maxCents };
      }

      const where = {
        ...(p.status !== 'ALL' ? { status: p.status } : {}),
        ...(p.gateway ? { gateway: p.gateway } : {}),
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        ...(amountFilter ? { amount: amountFilter } : {}),
        ...(activeTenantId && activeTenantId !== 'all' ? { tenantId: activeTenantId } : {}),
        ...(searchTrim ? {
          OR: [
            { user: { is: { email: { contains: searchTrim, mode: 'insensitive' as const } } } },
            { id: { contains: searchTrim, mode: 'insensitive' as const } },
            { gatewayId: { contains: searchTrim, mode: 'insensitive' as const } }
          ]
        } : {}),
      };

      const { SafePagination } = await import('@/lib/pagination/safe-pagination');
      const pagination = SafePagination.sanitize({ pageSize: p.pageSize, cursor: p.cursor });
      const pageSize = pagination.take;

      const payments = await db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: pageSize + 1,
        ...(p.cursor ? { cursor: { id: p.cursor }, skip: 1 } : {}),
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
      });

      const hasMore = payments.length > pageSize;
      const page = hasMore ? payments.slice(0, pageSize) : payments;

      return {
        items: page.map(e => ({
          id: e.id,
          userId: e.userId,
          userEmail: e.user?.email ?? 'Unknown',
          amount: Number(e.amount),
          currency: e.currency,
          status: e.status,
          gateway: e.gateway,
          gatewayId: e.gatewayId,
          consentIp: e.consentIp,
          consentUserAgent: e.consentUserAgent,
          createdAt: e.createdAt.toISOString(),
          tenantId: e.tenantId,
        })),
        nextCursor: hasMore ? page[page.length - 1].id : null,
        hasMore,
      };
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки реестра платежей';
    return { success: false, error: message };
  }
}

type DisputePackOrderDTO = {
  id: string;
  numericId: number;
  serviceName: string;
  link: string;
  quantity: number;
  charge: number; // Cents
  status: string;
  remains: number;
  createdAt: string;
};

export type DisputePackLedgerDTO = {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
};

export type PaymentDisputePackDTO = {
  payment: PaymentDTO;
  user: {
    id: string;
    email: string;
    createdAt: string;
    totalSpent: number; // Cents
    balance: number; // Cents
  };
  orders: DisputePackOrderDTO[];
  ledgerEntries: DisputePackLedgerDTO[];
};

export async function getPaymentDisputePackAction(paymentId: string): Promise<PaymentDisputePackDTO | { success: false, error: string }> {
  return requireStaffPermission('finance', 'view', async (admin): Promise<PaymentDisputePackDTO | { success: false; error: string }> => {
    const payment = await db.payment.findFirst({
      where: { id: paymentId, tenantId: admin.tenantId ?? 'smmplan' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            createdAt: true,
            totalSpent: true,
            balance: true,
          },
        },
        orders: {
          include: {
            service: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      return { success: false, error: 'Платеж не найден' };
    }

    if (!payment.user) {
      return { success: false, error: 'Пользователь не связан с платежом' };
    }

    // Capture associated orders (either direct or post-deposit orders)
    let associatedOrders = payment.orders;
    if (associatedOrders.length === 0) {
      // Direct deposit top-up: find orders created by this user right after the payment was initiated (up to 7 days)
      associatedOrders = await db.order.findMany({
        where: {
          userId: payment.userId,
          tenantId: payment.tenantId || 'smmplan',
          createdAt: {
            gte: payment.createdAt,
            lte: new Date(payment.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days window
          },
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
        include: {
          service: {
            select: {
              name: true,
            },
          },
        },
      });
    }

    const ledgerEntries = await db.ledgerEntry.findMany({
      where: { 
        userId: payment.userId,
        tenantId: payment.tenantId || 'smmplan',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      payment: {
        id: payment.id,
        userId: payment.userId,
        userEmail: payment.user.email,
        amount: Number(payment.amount),
        currency: payment.currency,
        status: payment.status,
        gateway: payment.gateway,
        gatewayId: payment.gatewayId,
        consentIp: payment.consentIp,
        consentUserAgent: payment.consentUserAgent,
        createdAt: payment.createdAt.toISOString(),
        tenantId: payment.tenantId,
      },
      user: {
        id: payment.user.id,
        email: payment.user.email,
        createdAt: payment.user.createdAt.toISOString(),
        totalSpent: Number(payment.user.totalSpent),
        balance: Number(payment.user.balance),
      },
      orders: associatedOrders.map(o => ({
        id: o.id,
        numericId: o.numericId,
        serviceName: o.service?.name ?? 'Unknown Service',
        link: o.link,
        quantity: o.quantity,
        charge: Number(o.charge),
        status: o.status,
        remains: o.remains,
        createdAt: o.createdAt.toISOString(),
      })),
      ledgerEntries: ledgerEntries.map(l => ({
        id: l.id,
        type: l.transactionType,
        amount: Number(l.amount),
        description: l.reason,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  });
}

const manualApproveSchema = z.object({
  paymentId: z.string().min(1),
  gatewayTransactionId: z.string().min(3, 'Укажите ID транзакции или номер квитанции из письма'),
  notes: z.string().min(5, 'Укажите подробное обоснование (например: «Проверено по чеку от ЮKassa №...»)'),
});

/**
 * Manually approves a pending payment that was confirmed via bank receipt / gateway email.
 * Enforces Hybrid RBAC limit (Support up to 3 000 RUB / supportLimitCents, Owner/Admin unlimited).
 */
export async function manualApprovePaymentAction(input: z.infer<typeof manualApproveSchema>) {
  return requireStaffPermission('finance', 'view', async (admin) => {
    const parsed = manualApproveSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.issues[0]?.message || 'Некорректные параметры' };
    }

    const payment = await db.payment.findUnique({
      where: { id: parsed.data.paymentId },
      include: { user: true },
    });

    if (!payment) {
      return { success: false as const, error: 'Платёж не найден' };
    }

    if (payment.status !== 'PENDING') {
      return { success: false as const, error: `Платёж уже имеет статус «${payment.status}»` };
    }

    // H-02 FIX: Prevent self-approval (Support/Admin cannot approve their own payments)
    if (payment.userId === admin.id) {
      return { success: false as const, error: 'Запрещено подтверждать собственные платежи (Self-Approval Guard)' };
    }

    // Hybrid RBAC & Support Limit Check (Default 3 000 RUB = 300 000 kopecks)
    const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(admin.role);
    if (!isOwnerOrAdmin) {
      // Support limit check (0 must be respected as 0 limit, not falsy fallback to 3000 RUB)
      const rawLimit = admin.supportLimitCents;
      const effectiveLimitCents = (rawLimit !== null && rawLimit !== undefined) 
        ? BigInt(rawLimit) 
        : BigInt(300000); // 3 000 RUB

      if (effectiveLimitCents <= BigInt(0) || payment.amount > effectiveLimitCents) {
        const limitRub = Number(effectiveLimitCents) / 100;
        const amountRub = Number(payment.amount) / 100;
        return { 
          success: false as const, 
          error: `Сумма платежа (${amountRub} ₽) превышает ваш лимит ручного подтверждения (${limitRub} ₽). Передайте платёж Администратору.` 
        };
      }
    }

    // Support must not approve payments targeted at staff accounts
    const targetRole = payment.user?.role;
    if (targetRole && ['OWNER', 'ADMIN', 'MANAGER', 'SUPPORT', 'OPERATOR'].includes(targetRole) && !['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Запрещено подтверждать платежи по аккаунтам сотрудников. Передайте Администратору.' };
    }

    // M-07 FIX: Payments bound to orders must fulfill the order (credit+charge+activate)
    if (payment.orderId) {
      const { paymentService } = await import('@/services/financial/payment.service');
      const ok = await paymentService.confirmPaymentById(payment.id);
      if (!ok) {
        return { success: false as const, error: 'Не удалось активировать заказ, привязанный к платежу' };
      }
      safeRevalidatePath('/admin/orders');
      safeRevalidatePath('/admin/transactions');
      safeRevalidatePath('/admin/finance');
      safeRevalidatePath(`/admin/clients/${payment.userId}`);
      return { success: true as const };
    }

    const ipAddress = await getClientIp('unknown');

    try {
      await db.$transaction(async (tx) => {
        // 1. Atomic status transition: update only if still PENDING
        const updateResult = await tx.payment.updateMany({
          where: { 
            id: payment.id, 
            status: 'PENDING',
            ...(payment.tenantId ? { tenantId: payment.tenantId } : {})
          },
          data: {
            status: 'SUCCEEDED',
            gatewayId: parsed.data.gatewayTransactionId,
          },
        });

        if (updateResult.count === 0) {
          throw new Error('PAYMENT_ALREADY_PROCESSED');
        }

        // 2. Credit wallet via WalletOps with full audit ledger
        const idempotencyKey = `manual-approve-${payment.id}-${admin.id}`;
        await WalletOps.credit(
          tx,
          payment.userId,
          payment.amount,
          `Ручное подтверждение платежа (Чек: ${parsed.data.gatewayTransactionId})`,
          {
            idempotencyKey,
            adminId: admin.id,
            tenantId: payment.user?.tenantId || 'smmplan',
            transactionType: 'TOPUP',
          }
        );

        // 3. Audit log
        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'UPDATE_USER_BALANCE',
          target: payment.id,
          targetType: 'PAYMENT_MANUAL_APPROVE',
          oldValue: { status: 'PENDING', amount: Number(payment.amount) },
          newValue: { 
            status: 'SUCCEEDED', 
            amount: Number(payment.amount), 
            gatewayId: parsed.data.gatewayTransactionId,
            notes: parsed.data.notes,
            adminRole: admin.role,
          },
          ipAddress,
          tx,
        });
      }, { timeout: 60000, maxWait: 30000 });

      safeRevalidatePath('/admin/transactions');
      safeRevalidatePath('/admin/finance');
      safeRevalidatePath(`/admin/clients/${payment.userId}`);

      return { success: true as const };
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'PAYMENT_ALREADY_PROCESSED') {
        return { success: false as const, error: 'Платёж уже был обработан другим процессом или вебхуком' };
      }
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
        return { success: false as const, error: 'Транзакция с таким номером или квитанцией уже была зарегистрирована в системе ранее' };
      }
      console.error('[ManualPaymentApproval] Error:', err);
      return { success: false as const, error: 'Сбой при проведении платежа' };
    }
  });
}
