import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paginatedQuery, type PaginatedResult } from '@/lib/pagination';
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { WalletOps } from '../financial/wallet-ops';

// ── Types ──

type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  balance: number;
  quarantineBalance: number;
  totalSpent: number;
  personalDiscount: number;
  referralCode: string | null;
  telegramId: string | null;
  companyName: string | null;
  inn: string | null;
  createdAt: Date;
  tenantId: string;
  apiConfig?: {
    isApiEnabled: boolean;
    prioritySupport: boolean;
    webhookUrl: string | null;
  } | null;
  _count: { orders: number; tickets: number };
};

type UserCard = AdminUserRow & {
  kpp: string | null;
  legalAddress: string | null;
  discountEndsAt: Date | null;
  adminNote: string | null;
  adminNoteUpdatedAt: Date | null;
  adminNoteUpdatedBy: string | null;
  orders: {
    id: string;
    numericId: number;
    status: string;
    charge: number;
    quantity: number;
    createdAt: Date;
    service: { name: string };
  }[];
  tickets: {
    id: string;
    subject: string;
    status: string;
    createdAt: Date;
  }[];
  payments: {
    id: string;
    amount: bigint;
    currency: string;
    status: string;
    gateway: string;
    gatewayId: string | null;
    receiptId: string | null;
    refundReceiptId: string | null;
    createdAt: Date;
  }[];
};

// ── Sorting Constants & Types ──

export const USER_SORT_FIELDS = ['createdAt', 'balance', 'totalSpent', 'orders', 'email', 'role'] as const;
export type UserSortField = typeof USER_SORT_FIELDS[number];
export type SortOrder = 'asc' | 'desc';

// ── Volume Tier Labels ──

function getVolumeTier(totalSpentCents: number): { name: string; color: string } {
  if (totalSpentCents >= 100_000_00) return { name: 'PLATINUM', color: 'bg-violet-100 text-violet-800' };
  if (totalSpentCents >= 25_000_00) return { name: 'GOLD', color: 'bg-amber-100 text-amber-800' };
  if (totalSpentCents >= 5_000_00) return { name: 'SILVER', color: 'bg-slate-200 text-slate-700' };
  if (totalSpentCents >= 1_000_00) return { name: 'BRONZE', color: 'bg-orange-100 text-orange-700' };
  return { name: 'REGULAR', color: 'bg-slate-100 text-slate-500' };
}

export { getVolumeTier };

// ── Service ──

class AdminUserService {

  /**
   * Paginated user list with multi-field search, filter presets, dynamic sorting and offset pagination.
   */
  async listUsers(params: {
    cursor?: string;
    page?: number;
    search?: string;
    filter?: 'all' | 'api' | 'balance' | 'banned' | 'vip';
    pageSize?: number;
    tenantId?: string;
    sortBy?: UserSortField;
    sortOrder?: SortOrder;
  }): Promise<PaginatedResult<AdminUserRow>> {
    const andConditions: Prisma.UserWhereInput[] = [
      { isDeleted: false },
    ];

    if (params.search?.trim()) {
      const q = params.search.trim();
      andConditions.push({
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { id: { equals: q } },
          { telegramId: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { inn: { contains: q } },
        ],
      });
    }

    if (params.tenantId && params.tenantId !== 'all') {
      andConditions.push({ tenantId: params.tenantId });
    }

    if (params.filter === 'api') {
      andConditions.push({
        OR: [
          { apiConfig: { isApiEnabled: true } },
          { inn: { not: null } },
          { companyName: { not: null } },
        ],
      });
    } else if (params.filter === 'balance') {
      andConditions.push({ balance: { gt: BigInt(0) } });
    } else if (params.filter === 'banned') {
      andConditions.push({ role: 'BANNED' });
    } else if (params.filter === 'vip') {
      andConditions.push({
        totalSpent: { gte: BigInt(25_000_00) }, // Gold or Platinum
        role: 'USER',
        staffRoleId: null,
        isDeleted: false,
      });
    }

    const where: Prisma.UserWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    // Dynamic sorting with whitelist validation and 100% deterministic tie-breaker
    const rawSortBy = params.sortBy;
    const sortBy: UserSortField = USER_SORT_FIELDS.includes(rawSortBy as UserSortField)
      ? (rawSortBy as UserSortField)
      : 'createdAt';
    const sortOrder: SortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';

    let primaryOrderBy: Record<string, unknown>;
    if (sortBy === 'orders') {
      primaryOrderBy = { orders: { _count: sortOrder } };
    } else {
      primaryOrderBy = { [sortBy]: sortOrder };
    }

    const orderBy = [primaryOrderBy, { id: 'desc' }];

    return paginatedQuery<AdminUserRow>(db.user, {
      cursor: params.cursor,
      page: params.page,
      pageSize: params.pageSize || 50,
      where,
      orderBy,
      include: {
        apiConfig: {
          select: {
            isApiEnabled: true,
            prioritySupport: true,
            webhookUrl: true,
          }
        },
        _count: { select: { orders: true, tickets: true } },
      },
    });
  }

  /**
   * Full user card with recent orders, tickets, payments and API config.
   */
  async getUserCard(userId: string): Promise<UserCard> {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        apiConfig: true,
        _count: { select: { orders: true, tickets: true } },
        orders: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            numericId: true,
            status: true,
            charge: true,
            quantity: true,
            createdAt: true,
            service: { select: { name: true } },
          },
        },
        tickets: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            subject: true,
            status: true,
            createdAt: true,
          },
        },
        payments: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            gateway: true,
            gatewayId: true,
            receiptId: true,
            refundReceiptId: true,
            createdAt: true,
          },
        },
      },
    });

    return user as unknown as UserCard;
  }

  /**
   * Adjust user balance with mandatory reason.
   * Writes to LedgerEntry for audit trail.
   */
  async updateBalance(
    userId: string,
    amountCents: number,
    reason: string,
    admin: { id: string; email: string }
  ) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const oldBalance = user.balance;

    await db.$transaction(async (tx) => {
      await WalletOps.credit(tx, userId, amountCents, reason, { adminId: admin.id });
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'USER_BALANCE_CHANGE',
        target: userId,
        targetType: 'USER',
        oldValue: { balance: oldBalance },
        newValue: { balance: oldBalance + BigInt(amountCents), delta: BigInt(amountCents), reason },
        tx,
      });
    });
  }

  /**
   * Ban a user by setting role to 'BANNED'.
   */
  async banUser(userId: string, admin: { id: string; email: string }) {
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.id === admin.id) throw new Error('Cannot ban yourself');

    await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { role: 'BANNED' },
      }),
      db.session.deleteMany({
        where: { userId },
      }),
    ]);

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_BAN',
      target: userId,
      targetType: 'USER',
      oldValue: { role: user.role },
      newValue: { role: 'BANNED' },
    });
  }

  /**
   * Unban a user by restoring role to 'USER' or original staff role.
   */
  async unbanUser(userId: string, admin: { id: string; email: string }) {
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { staffRole: true },
    });

    let restoredRole = 'USER';
    if (user.staffRoleId && user.staffRole) {
      const roleName = user.staffRole.name.toUpperCase();
      if (['OWNER', 'ADMIN', 'SUPPORT', 'MANAGER', 'OPERATOR'].includes(roleName)) {
        restoredRole = roleName;
      } else {
        restoredRole = 'SUPPORT';
      }
    }

    await db.user.update({
      where: { id: userId },
      data: { role: restoredRole },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'USER_UNBAN',
      target: userId,
      targetType: 'USER',
      oldValue: { role: 'BANNED' },
      newValue: { role: restoredRole },
    });
  }

  /**
   * Get aggregate user stats for the header.
   */
  async getUserStats(startDate?: Date, endDate?: Date, tenantId?: string) {
    const where: Prisma.UserWhereInput = { isDeleted: false };
    if (startDate && endDate) {
      where.createdAt = { gte: startDate, lte: endDate };
    }
    if (tenantId && tenantId !== 'all') {
      where.tenantId = tenantId;
    }
    const [total, active, banned] = await Promise.all([
      db.user.count({ where }),
      db.user.count({
        where: {
          ...where,
          role: 'USER',
          staffRoleId: null,
          isDeleted: false,
        },
      }),
      db.user.count({ where: { ...where, role: 'BANNED' } }),
    ]);

    const totalBalance = await db.user.aggregate({
      _sum: { balance: true },
      where: {
        ...where,
        role: 'USER',
        staffRoleId: null,
        isDeleted: false,
      },
    });

    return {
      total,
      active,
      banned,
      totalLiability: totalBalance._sum.balance || 0,
    };
  }

  /**
   * Get Top VIP Spenders
   */
  async getTopSpenders(limit = 6, tenantId?: string) {
    const isSingleTenant = tenantId && tenantId !== 'all';
    const where: Prisma.UserWhereInput = { role: { not: 'BANNED' }, isDeleted: false };
    if (isSingleTenant) {
      where.tenantId = tenantId;
    }
    return db.user.findMany({
      where,
      orderBy: { totalSpent: 'desc' },
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        totalSpent: true,
        tenantId: true,
        createdAt: true,
        _count: { select: { orders: true } },
      }
    });
  }
}

export const adminUserService = new AdminUserService();
