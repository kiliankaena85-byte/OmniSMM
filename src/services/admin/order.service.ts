import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { calculatePartialRefund } from '@/utils/refund';
import { WalletOps } from '../financial/wallet-ops';
import { runSerializableTransaction } from '@/lib/transactions';
import { paginatedQuery, type PaginatedResult } from '@/lib/pagination';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import type { Order, User, Service, Category, Network } from '@prisma/client';
import { CompensationService } from '@/services/financial/compensation.service';

/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

// ── Types ──

type AdminOrderRow = Order & {
  user: Pick<User, 'id' | 'email'>;
  service: Pick<Service, 'id' | 'name' | 'numericId' | 'etaP50Seconds' | 'etaP90Seconds' | 'etaSampleCount' | 'etaSpeedClass' | 'etaUpdatedAt'> & {
    category: Pick<Category, 'name'> & {
      network: Pick<Network, 'name'> | null;
    };
  };
  provider: { name: string; ticketUrl: string | null } | null;
};

type OrderSearchParams = {
  query?: string;
  status?: string;
  activityType?: string;
  datePreset?: string;
  cursor?: string;
  page?: number;
  pageSize?: number;
  userId?: string;
  clientEmail?: string;
  orderId?: number;
  externalId?: string;
  serviceName?: string;
  networkSlug?: string;
  link?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  maxQuantity?: number;
  tenantId?: string;
  isDripFeed?: boolean;
  hasError?: boolean;
  errorCategory?: 'BALANCE' | 'LINK' | 'SERVICE' | 'ALL' | string;
  noProvider?: boolean;
  staleMinutes?: number;
  dateFrom?: Date | string;
  dateTo?: Date | string;
  providerId?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
};

const ACTIVITY_TYPE_KEYWORDS: Record<string, string[]> = {
  subscribers: ['подписчик', 'участник', 'фолловер', 'subscriber', 'follower', 'member', 'sub'],
  likes: ['лайк', 'реакци', 'like', 'reaction', 'heart'],
  views: ['просмотр', 'охват', 'view', 'impression', 'reach'],
  comments: ['комментар', 'отзыв', 'comment', 'review'],
  reposts: ['репост', 'поделиться', 'share', 'retweet'],
  polls: ['опрос', 'голосов', 'vote', 'poll'],
  watchtime: ['час', 'удержан', 'длительн', 'watch time', 'hour', 'duration'],
};

export function resolveOrderOrderBy(
  sortField?: string,
  sortOrder?: 'asc' | 'desc'
): Record<string, any> {
  const defaultOrderBy: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' };
  if (!sortField) return defaultOrderBy;

  const dir: 'asc' | 'desc' = sortOrder === 'asc' ? 'asc' : 'desc';

  if (['numericId', 'status', 'quantity', 'remains', 'charge', 'providerCost', 'createdAt', 'updatedAt'].includes(sortField)) {
    return { [sortField]: dir };
  }

  if (sortField === 'client' || sortField === 'user' || sortField === 'email') {
    return { user: { email: dir } };
  }

  return defaultOrderBy;
}

// ── Service ──

class AdminOrderService {

  /**
   * Omni-Search: searches by email, link/URL, order numericId, or externalId.
   * Returns paginated results with support for offset and cursor.
   */
  async searchOrders(params: OrderSearchParams): Promise<PaginatedResult<AdminOrderRow>> {
    const { 
      query, 
      status, 
      cursor, 
      page,
      pageSize = 50, 
      userId,
      clientEmail,
      orderId,
      externalId,
      serviceName,
      networkSlug,
      link,
      minPrice,
      maxPrice,
      minQuantity,
      maxQuantity
    } = params;

    // Build dynamic WHERE clause
    const andConditions: Prisma.OrderWhereInput[] = [];
    const where: Prisma.OrderWhereInput = {};

    if (userId && userId.trim()) {
      where.userId = userId.trim();
    }

    if (params.tenantId && params.tenantId !== 'all') {
      where.tenantId = params.tenantId;
    }

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        where.status = { in: ['PENDING', 'IN_PROGRESS'] };
      } else if (status === 'PROBLEMATIC') {
        where.status = { in: ['ERROR', 'CANCELED', 'PARTIAL'] };
      } else if (status === 'COMPLETED_ALL') {
        where.status = { in: ['COMPLETED', 'PARTIAL'] };
      } else {
        where.status = status as import("@prisma/client").OrderStatus;
      }
    }

    if (clientEmail && clientEmail.trim()) {
      where.user = { email: { contains: clientEmail.trim(), mode: 'insensitive' } };
    }

    if (orderId !== undefined && !isNaN(orderId)) {
      where.numericId = orderId;
    }

    if (externalId && externalId.trim()) {
      where.externalId = { contains: externalId.trim(), mode: 'insensitive' };
    }

    if (serviceName && serviceName.trim()) {
      const tokens = serviceName.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        
        tokens.forEach(token => {
          if (token.startsWith('-') && token.length > 1) {
            andConditions.push({
              service: {
                name: { not: { contains: token.substring(1) } }
              }
            });
          } else {
            andConditions.push({
              service: {
                name: { contains: token, mode: 'insensitive' }
              }
            });
          }
        });
      }
    }

    if (networkSlug && networkSlug !== 'ALL') {
      
      andConditions.push({
        service: {
          category: {
            network: {
              slug: networkSlug
            }
          }
        }
      });
    }

    if (params.activityType && params.activityType !== 'ALL') {
      
      if (ACTIVITY_TYPE_KEYWORDS[params.activityType]) {
        const kws = ACTIVITY_TYPE_KEYWORDS[params.activityType];
        andConditions.push({
          OR: [
            ...kws.map(kw => ({ service: { name: { contains: kw, mode: 'insensitive' as Prisma.QueryMode } } })),
            ...kws.map(kw => ({ service: { category: { name: { contains: kw, mode: 'insensitive' as Prisma.QueryMode } } } })),
          ]
        });
      } else {
        // Direct category slug match
        andConditions.push({
          service: {
            category: {
              slug: params.activityType
            }
          }
        });
      }
    }

    if (link && link.trim()) {
      where.link = { contains: link.trim(), mode: 'insensitive' };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const chargeFilters: Record<string, number> = {};
      if (minPrice !== undefined && !isNaN(minPrice)) {
        chargeFilters.gte = Math.round(minPrice * 100);
      }
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        chargeFilters.lte = Math.round(maxPrice * 100);
      }
      where.charge = chargeFilters;
    }

    if (minQuantity !== undefined || maxQuantity !== undefined) {
      const qtyFilters: Record<string, number> = {};
      if (minQuantity !== undefined && !isNaN(minQuantity)) {
        qtyFilters.gte = minQuantity;
      }
      if (maxQuantity !== undefined && !isNaN(maxQuantity)) {
        qtyFilters.lte = maxQuantity;
      }
      where.quantity = qtyFilters;
    }

    if (params.isDripFeed !== undefined) {
      where.isDripFeed = params.isDripFeed;
    }

    if (params.hasError) {
      where.error = { not: null };
    }

    // ── Error Category Grouping (BALANCE vs LINK vs SERVICE) ──
    if (params.errorCategory && params.errorCategory !== 'ALL') {
      if (params.errorCategory === 'BALANCE') {
        andConditions.push({
          OR: [
            { error: { contains: 'balance', mode: 'insensitive' } },
            { error: { contains: 'funds', mode: 'insensitive' } },
            { error: { contains: 'средств', mode: 'insensitive' } },
            { error: { contains: 'денег', mode: 'insensitive' } },
          ]
        });
      } else if (params.errorCategory === 'LINK') {
        andConditions.push({
          OR: [
            { error: { contains: 'link', mode: 'insensitive' } },
            { error: { contains: 'url', mode: 'insensitive' } },
            { error: { contains: 'private', mode: 'insensitive' } },
            { error: { contains: 'ссылк', mode: 'insensitive' } },
            { error: { contains: 'закрыт', mode: 'insensitive' } },
            { error: { contains: '404', mode: 'insensitive' } },
          ]
        });
      } else if (params.errorCategory === 'SERVICE') {
        andConditions.push({
          AND: [
            { error: { not: null } },
            { NOT: { error: { contains: 'balance', mode: 'insensitive' } } },
            { NOT: { error: { contains: 'funds', mode: 'insensitive' } } },
            { NOT: { error: { contains: 'средств', mode: 'insensitive' } } },
            { NOT: { error: { contains: 'link', mode: 'insensitive' } } },
            { NOT: { error: { contains: 'ссылк', mode: 'insensitive' } } },
          ]
        });
      }
    }

    if (params.noProvider) {
      where.providerId = null;
    } else if (params.providerId && params.providerId !== 'ALL') {
      where.providerId = params.providerId;
    }

    if (params.staleMinutes) {
      const threshold = new Date(Date.now() - params.staleMinutes * 60 * 1000);
      where.createdAt = { lte: threshold };
      where.status = { in: ['PENDING', 'IN_PROGRESS'] };
    }

    // ── Date Filtering & Presets ──
    let computedDateFrom: Date | undefined = params.dateFrom ? new Date(params.dateFrom) : undefined;
    let computedDateTo: Date | undefined = params.dateTo ? new Date(params.dateTo) : undefined;

    if (params.datePreset && params.datePreset !== 'ALL') {
      const now = new Date();
      if (params.datePreset === 'today') {
        computedDateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      } else if (params.datePreset === 'yesterday') {
        computedDateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        computedDateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      } else if (params.datePreset === '7d') {
        computedDateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (params.datePreset === '30d') {
        computedDateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (params.datePreset === 'this_month') {
        computedDateFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      } else if (params.datePreset === 'last_month') {
        computedDateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        computedDateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      }
    }

    if (computedDateFrom || computedDateTo) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (computedDateFrom && !isNaN(computedDateFrom.getTime())) dateFilter.gte = computedDateFrom;
      if (computedDateTo && !isNaN(computedDateTo.getTime())) dateFilter.lte = computedDateTo;
      where.createdAt = dateFilter;
    }

    // ── Omni-Search Parser (Strict Intent Hierarchy) ──
    if (query && query.trim()) {
      const q = query.trim();
      const numMatch = q.match(/^#?(\d+)$/);

      if (numMatch) {
        // Pure number (e.g. 54 or #54) -> Strict match on numericId or externalId
        const num = parseInt(numMatch[1], 10);
        where.OR = [
          { numericId: num },
          { externalId: { equals: String(num) } },
        ];
      } else if (q.includes('@') && !q.includes('/') && !q.startsWith('@')) {
        // Direct Client Email
        where.user = { email: { contains: q, mode: 'insensitive' } };
      } else if (q.startsWith('cly') || q.startsWith('usr_') || q.length >= 24) {
        // CUID / User ID
        where.OR = [
          { id: q },
          { userId: q },
          { externalId: q },
          { paymentId: q },
        ];
      } else {
        const cleanSubstring = q.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^@/, '');
        where.OR = [
          { externalId: { contains: q, mode: 'insensitive' } },
          { link: { contains: cleanSubstring, mode: 'insensitive' } },
          { user: { email: { contains: q, mode: 'insensitive' } } },
          { paymentId: { contains: q, mode: 'insensitive' } },
          { service: { name: { contains: q, mode: 'insensitive' } } },
        ];
      }
    }

    // Dynamic sorting
    const orderBy = resolveOrderOrderBy(params.sortField, params.sortOrder);

    return paginatedQuery<AdminOrderRow>(db.order, {
      cursor,
      page,
      pageSize,
      where,
      orderBy,
      include: {
        user: { select: { id: true, email: true } },
        provider: { select: { name: true, ticketUrl: true } },
        service: { 
          select: { 
            id: true, 
            name: true, 
            numericId: true,
            etaP50Seconds: true,
            etaP90Seconds: true,
            etaSampleCount: true,
            etaSpeedClass: true,
            etaUpdatedAt: true,
            category: { select: { name: true, network: { select: { name: true } } } }
          } 
        },
      },
    });
  }

  /**
   * Cancel an order and refund the user's balance.
   * Partial refund: if order is IN_PROGRESS/PARTIAL with remains > 0,
   * refund only the undelivered portion.
   */
  // C-02 FIX: Accept tenantId for cross-tenant order isolation
  async cancelOrder(orderId: string, admin: { id: string; email: string; tenantId?: string }) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const orderBefore = await db.order.findUniqueOrThrow({ where: { id: orderId } });

    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { user: true, service: true },
      });

      if (['CANCELED', 'ERROR', 'PARTIAL'].includes(order.status)) { // Removed COMPLETED
        throw new Error(`Order ${order.numericId} is already in terminal state ${order.status} and cannot be canceled.`);
      }

      // Loss Prevention: Support cannot cancel active orders if upstream provider has disabled cancellations
      const isPendingState = ['PENDING', 'PENDING_CHECK'].includes(order.status);
      if (!isPendingState && order.status !== 'AWAITING_PAYMENT' && order.status !== 'COMPLETED' && !order.service.isCancelEnabled) {
        const caller = await tx.user.findUniqueOrThrow({
          where: { id: admin.id },
          select: { role: true },
        });
        if (caller.role === 'SUPPORT') {
          throw new Error(
            `Отмена невозможна: услуга "${order.service.name}" не поддерживает отмену на стороне провайдера. Только Администратор или Владелец могут принудительно отменить этот заказ.`
          );
        }
      }

      let calculatedRefundCents = 0;
      if (order.status === 'AWAITING_PAYMENT') {
        calculatedRefundCents = 0;
      } else if (isPendingState) {
        calculatedRefundCents = Number(order.charge);
      } else if (order.status === 'COMPLETED') {
        calculatedRefundCents = calculatePartialRefund({ ...order, remains: order.quantity });
      } else {
        calculatedRefundCents = calculatePartialRefund(order);
      }

      let refundCents = 0;
      if (calculatedRefundCents > 0) {
        const previousRefunds = await tx.ledgerEntry.aggregate({
          where: { userId: order.userId, idempotencyKey: { startsWith: `refund_${order.id}_` }, status: 'APPROVED' },
          _sum: { amount: true },
        });
        refundCents = Math.max(0, calculatedRefundCents - Number(previousRefunds._sum.amount || 0));
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: 'CANCELED' },
      });

      // Handle Referral Commissions (Reverse since canceled)
      const { LoyaltyService } = await import('../users/loyalty.service');
      await LoyaltyService.reverseCommission(tx, orderId);

      // R1-003 Fix: Roll back promo code uses if it was never paid
      if (order.status === 'AWAITING_PAYMENT' && order.promoCodeId) {
        await tx.promoCode.updateMany({
          where: {
            id: order.promoCodeId,
            uses: { gt: 0 },
            ...(order.tenantId ? { tenantId: order.tenantId } : {})
          },
          data: { uses: { decrement: 1 } }
        });
      }

      if (refundCents > 0) {
        await WalletOps.refund(tx, order.userId, refundCents,
          `Отмена заказа ${order.numericId} администратором - Возврат средств`,
          { adminId: admin.id, idempotencyKey: `refund_${order.id}_CANCELED_${Date.now()}` }
        );
      }

      return { refundCents, orderNumericId: order.numericId, statusBefore: order.status, remainsBefore: order.remains };
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_CANCEL',
      target: orderId,
      targetType: 'ORDER',
      oldValue: { status: result.statusBefore, remains: result.remainsBefore },
      newValue: { status: 'CANCELED', refundCents: result.refundCents },
    });

    CompensationService.trackCompensation(orderId).catch(err => console.error('[AdminOrderService] Failed to track compensation', err));

    return { refundCents: result.refundCents, orderNumericId: result.orderNumericId };
  }

  /**
   * Restart a failed/error order by resetting it to PENDING.
   * The provision worker will pick it up on next cycle.
   */
  // C-02 FIX: Accept tenantId for cross-tenant order isolation
  async restartOrder(orderId: string, admin: { id: string; email: string; tenantId?: string }) {
    const result = await runSerializableTransaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { user: true }
      });

      if (order.status !== 'ERROR' && order.status !== 'PENDING_CHECK' && order.status !== 'CANCELED') {
        throw new Error(`Order ${order.numericId} cannot be restarted (status: ${order.status}). Используйте "Дублировать заказ".`);
      }

      // If previously in terminal refunded status (ERROR / CANCELED), re-charge customer.
      // If in PENDING_CHECK, money was already charged and held in escrow, so do NOT charge again!
      if (order.status === 'ERROR' || order.status === 'CANCELED') {
        await WalletOps.charge(tx, order.userId, Number(order.charge),
          `Перезапуск заказа #${order.numericId} администратором - Повторное списание`,
          { 
            adminId: admin.id,
            idempotencyKey: `restart-charge-${order.id}-${order.updatedAt.getTime()}`,
          }
        );
      }

      // Reset order state
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PENDING',
          error: null,
          retryCount: 0,
          externalId: null,
          actualProviderCost: null,
          realMarginDelta: null
        },
      });

      return { orderNumericId: order.numericId, oldStatus: order.status, oldError: order.error, charge: order.charge };
    });

    // Enqueue into BullMQ dispatcher queue
    try {
      const { ordersQueue, getRedisConnection } = await import('@/lib/queue-manager');
      const connection = getRedisConnection();
      await connection.del(`order:dispatched:${orderId}`);
      const jobId = `dispatch-${orderId}-${Date.now()}`;
      await ordersQueue.add('order-dispatch', { orderId }, { jobId });
    } catch (queueErr) {
      console.error(`[AdminOrderService] Failed to enqueue restarted order ${orderId}:`, queueErr);
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ORDER_RESTART',
      target: orderId,
      targetType: 'ORDER',
      oldValue: { status: result.oldStatus, error: result.oldError },
      newValue: { status: 'PENDING', reChargeCents: result.oldStatus === 'PENDING_CHECK' ? 0 : result.charge },
    });

    return { orderNumericId: result.orderNumericId };
  }

  // Fast cache for order status stats (15s TTL) to prevent 5x full table scans on rapid pagination
  private static statsCache = new Map<string, { data: { total: number; pending: number; inProgress: number; completed: number; error: number }; expiresAt: number }>();

  /**
   * Retrieves order stats using a single high-performance groupBy query with 15s cache.
   */
  async getOrderStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    const cacheKey = `${startDate?.toISOString() || 'all'}_${endDate?.toISOString() || 'all'}_${tenantId || 'all'}`;
    const cached = AdminOrderService.statsCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    const where: Prisma.OrderWhereInput = {};
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (tenantId && tenantId !== 'all') {
      where.tenantId = tenantId;
    }

    // High performance single groupBy query instead of 5 separate full-table count scans
    const statusGroups = await db.order.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    let total = 0;
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    let error = 0;

    for (const group of statusGroups) {
      const count = group._count._all;
      total += count;
      if (group.status === 'PENDING') pending += count;
      else if (group.status === 'IN_PROGRESS') inProgress += count;
      else if (group.status === 'COMPLETED') completed += count;
      else if (group.status === 'ERROR') error += count;
    }

    const result = { total, pending, inProgress, completed, error };
    AdminOrderService.statsCache.set(cacheKey, { data: result, expiresAt: now + 15000 });

    return result;
  }

  /**
   * Retrieves order counts grouped by hour/day/week/month to build the Orders Dynamics Chart.
   */
  async getOrdersTimeseries(startDate: Date, endDate: Date, step: 'hour' | 'day' | 'week' | 'month', tenantId?: string) {
    const rawData = step === 'hour'
      ? await db.$queryRaw<{ date: Date; status: string; count: number }[]>`
        SELECT 
          DATE_TRUNC('hour', "createdAt") as date, 
          status, 
          COUNT(*)::int as count 
        FROM "Order"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
          AND (${tenantId || null}::text IS NULL OR "tenantId" = ${tenantId || ''})
        GROUP BY DATE_TRUNC('hour', "createdAt"), status
        ORDER BY date ASC
      `
      : step === 'week'
      ? await db.$queryRaw<{ date: Date; status: string; count: number }[]>`
        SELECT 
          DATE_TRUNC('week', "createdAt") as date, 
          status, 
          COUNT(*)::int as count 
        FROM "Order"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
          AND (${tenantId || null}::text IS NULL OR "tenantId" = ${tenantId || ''})
        GROUP BY DATE_TRUNC('week', "createdAt"), status
        ORDER BY date ASC
      `
      : step === 'month'
      ? await db.$queryRaw<{ date: Date; status: string; count: number }[]>`
        SELECT 
          DATE_TRUNC('month', "createdAt") as date, 
          status, 
          COUNT(*)::int as count 
        FROM "Order"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
          AND (${tenantId || null}::text IS NULL OR "tenantId" = ${tenantId || ''})
        GROUP BY DATE_TRUNC('month', "createdAt"), status
        ORDER BY date ASC
      `
      : await db.$queryRaw<{ date: Date; status: string; count: number }[]>`
        SELECT 
          DATE_TRUNC('day', "createdAt") as date, 
          status, 
          COUNT(*)::int as count 
        FROM "Order"
        WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
          AND (${tenantId || null}::text IS NULL OR "tenantId" = ${tenantId || ''})
        GROUP BY DATE_TRUNC('day', "createdAt"), status
        ORDER BY date ASC
      `;

    // Scaffold empty intervals array to prevent chart visual gaps
    type WaveChartRow = { 
      dateStr: string; 
      completed: number; 
      inProgress: number; 
      pending: number; 
      unpaid: number; 
      canceled: number; 
      partial: number; 
      total: number;
    };
    const result: WaveChartRow[] = [];
    
    if (step === 'hour') {
      const current = new Date(startDate);
      current.setMinutes(0, 0, 0);
      while (current <= endDate) {
        const dateStr = current.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        result.push({ dateStr, completed: 0, inProgress: 0, pending: 0, unpaid: 0, canceled: 0, partial: 0, total: 0 });
        current.setHours(current.getHours() + 1);
      }
    } else if (step === 'day') {
      const current = new Date(startDate);
      current.setHours(0, 0, 0, 0);
      while (current <= endDate) {
        const dateStr = current.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        result.push({ dateStr, completed: 0, inProgress: 0, pending: 0, unpaid: 0, canceled: 0, partial: 0, total: 0 });
        current.setDate(current.getDate() + 1);
      }
    } else if (step === 'week') {
      const current = new Date(startDate);
      const day = current.getDay();
      const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
      current.setDate(diff);
      current.setHours(0, 0, 0, 0);
      while (current <= endDate) {
        const dateStr = current.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
        result.push({ dateStr, completed: 0, inProgress: 0, pending: 0, unpaid: 0, canceled: 0, partial: 0, total: 0 });
        current.setDate(current.getDate() + 7);
      }
    } else if (step === 'month') {
      const current = new Date(startDate);
      current.setDate(1);
      current.setHours(0, 0, 0, 0);
      while (current <= endDate) {
        const dateStr = current.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
        result.push({ dateStr, completed: 0, inProgress: 0, pending: 0, unpaid: 0, canceled: 0, partial: 0, total: 0 });
        current.setMonth(current.getMonth() + 1);
      }
    }

    // Map DB results directly into the right scaffolded date string
    for (const row of rawData) {
      let dStr = '';
      const rDate = new Date(row.date);
      if (step === 'hour') {
        dStr = rDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      } else if (step === 'day' || step === 'week') {
        dStr = rDate.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
      } else if (step === 'month') {
        dStr = rDate.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
      }
      const match = result.find(r => r.dateStr === dStr);
      if (match) {
        const count = Number(row.count);
        match.total += count;
        if (row.status === 'COMPLETED') match.completed += count;
        else if (row.status === 'IN_PROGRESS') match.inProgress += count;
        else if (row.status === 'PENDING') match.pending += count;
        else if (row.status === 'AWAITING_PAYMENT') match.unpaid += count;
        else if (row.status === 'CANCELED' || row.status === 'ERROR') match.canceled += count;
        else if (row.status === 'PARTIAL' || row.status === 'REFUNDING') match.partial += count;
      }
    }

    return result;
  }

  /**
   * Get recent live orders for dashboard feed
   */
  async getRecentOrders(limit = 6, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    return db.order.findMany({
      where: isSingleTenant ? { tenantId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { email: true } },
        service: {
          select: {
            name: true,
            category: { select: { name: true, network: { select: { name: true, slug: true } } } }
          }
        }
      }
    });
  }

  /**
   * Get top services by order volume / revenue
   */
  async getTopServices(limit = 6, startDate?: Date, endDate?: Date, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const where: Prisma.OrderWhereInput = { status: { notIn: ['AWAITING_PAYMENT', 'PENDING', 'ERROR'] } };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (isSingleTenant) {
      where.tenantId = tenantId;
    }

    const orders = await db.order.findMany({
      where,
      select: {
        serviceId: true,
        charge: true,
        providerCost: true,
        service: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                name: true,
                network: { select: { name: true, slug: true } }
              }
            }
          }
        }
      }
    });

    const map = new Map<string, {
      id: string;
      name: string;
      networkName: string;
      categoryName: string;
      ordersCount: number;
      revenueKopecks: bigint;
      costKopecks: bigint;
      profitKopecks: bigint;
      marginPct: number;
    }>();

    for (const o of orders) {
      const s = o.service;
      if (!s) continue;
      const existing = map.get(s.id) || {
        id: s.id,
        name: s.name,
        networkName: s.category?.network?.name || '—',
        categoryName: s.category?.name || '—',
        ordersCount: 0,
        revenueKopecks: BigInt(0),
        costKopecks: BigInt(0),
        profitKopecks: BigInt(0),
        marginPct: 0,
      };

      existing.ordersCount += 1;
      existing.revenueKopecks += BigInt(o.charge);
      existing.costKopecks += BigInt(o.providerCost || 0);
      existing.profitKopecks = existing.revenueKopecks - existing.costKopecks;
      
      map.set(s.id, existing);
    }

    const list = Array.from(map.values()).map(item => {
      const rev = Number(item.revenueKopecks);
      const profit = Number(item.profitKopecks);
      const marginPct = rev > 0 ? Math.round((profit / rev) * 100) : 0;
      return { ...item, marginPct };
    });

    list.sort((a, b) => Number(b.revenueKopecks - a.revenueKopecks));
    return list.slice(0, limit);
  }

  /**
   * Get refund and failure monitoring stats
   */
  async getRefundAndFailureStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const where: Prisma.OrderWhereInput = { AND: [] };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (isSingleTenant) {
      where.tenantId = tenantId;
    }

    const [totalOrders, canceledOrders, partialOrders, errorOrders] = await Promise.all([
      db.order.count({ where }),
      db.order.count({ where: { ...where, status: 'CANCELED' } }),
      db.order.count({ where: { ...where, status: 'PARTIAL' } }),
      db.order.count({ where: { ...where, status: 'ERROR' } }),
    ]);

    const problematicCount = canceledOrders + partialOrders + errorOrders;
    const failureRate = totalOrders > 0 ? ((problematicCount / totalOrders) * 100).toFixed(1) : '0';

    // Top problematic services
    const problematicOrders = await db.order.findMany({
      where: {
        ...where,
        status: { in: ['CANCELED', 'PARTIAL', 'ERROR'] }
      },
      select: {
        charge: true,
        status: true,
        service: {
          select: {
            name: true,
            category: { select: { network: { select: { name: true } } } }
          }
        }
      },
      take: 50
    });

    let totalRefundsKopecks = BigInt(0);
    const serviceFailMap = new Map<string, { name: string; network: string; count: number }>();

    for (const po of problematicOrders) {
      totalRefundsKopecks += BigInt(po.charge);
      const sName = po.service?.name || 'Неизвестная услуга';
      const netName = po.service?.category?.network?.name || '—';
      const cur = serviceFailMap.get(sName) || { name: sName, network: netName, count: 0 };
      cur.count += 1;
      serviceFailMap.set(sName, cur);
    }

    const topFailingServices = Array.from(serviceFailMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);

    return {
      totalOrders,
      canceledOrders,
      partialOrders,
      errorOrders,
      problematicCount,
      failureRate,
      totalRefundsKopecks,
      topFailingServices,
    };
  }
}

export const adminOrderService = new AdminOrderService();
