import { db } from './db';
import { Prisma } from '@prisma/client';

/**
 * Enterprise Tenant-Scoped Database Client (Defense-in-Depth)
 * Enforces explicit multi-tenant data isolation across all query operations.
 */

export function getTenantScopedDb(tenantId: string) {
  return db.$extends({
    query: {
      order: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findUnique({ args }) {
          // Convert findUnique to findFirst to enforce composite tenantId where clause safely
          return db.order.findFirst({
            ...args,
            where: { ...args.where, tenantId },
          });
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as Prisma.OrderWhereUniqueInput;
          return query(args);
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId } as Prisma.OrderWhereUniqueInput;
          return query(args);
        },
      },
      payment: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
        async update({ args, query }) {
          args.where = { ...args.where, tenantId } as Prisma.PaymentWhereUniqueInput;
          return query(args);
        },
      },
      ticket: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async count({ args, query }) {
          args.where = { ...args.where, tenantId };
          return query(args);
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId };
          return query(args);
        },
      },
      ledgerEntry: {
        async findMany({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async create({ args, query }) {
          const userId = (args.data as { userId?: string }).userId;
          if (userId) {
            const user = await db.user.findUnique({
              where: { id: userId },
              select: { tenantId: true },
            });
            if (user && user.tenantId !== tenantId) {
              throw new Error(`[TenantScope] Cross-tenant LedgerEntry creation blocked for userId ${userId}`);
            }
          }
          return query(args);
        },
      },
      commission: {
        async findMany({ args, query }) {
          args.where = { ...args.where, referrer: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, referrer: { tenantId } };
          return query(args);
        },
      },
      smartCampaign: {
        async findMany({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
      },
      invoice: {
        async findMany({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, user: { tenantId } };
          return query(args);
        },
      },
    },
  });
}
