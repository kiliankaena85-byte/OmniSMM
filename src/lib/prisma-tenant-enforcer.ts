/**
 * @file prisma-tenant-enforcer.ts
 * Enterprise Automatic Prisma Extension for Zero-Leak Tenant Isolation (SDD-TDD 2026).
 * Automatically intercepts and scopes database operations by tenantId.
 */

import { resolveActiveTenantId, isTenantBypassActive } from './tenant-context';

export interface TenantEnforcerOptions {
  findFirstDelegate?: (args: any) => Promise<any>;
}

export const TENANT_SCOPED_MODELS = [
  'order',
  'payment',
  'ticket',
  'user',
  'service',
  'category',
  'customerGroup',
  'ticketFeedback',
  'promoCode',
  'ledgerEntry',
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

export function createTenantEnforcerExtension(options: TenantEnforcerOptions = {}) {
  const queryExtensions: Record<string, any> = {};

  for (const model of TENANT_SCOPED_MODELS) {
    queryExtensions[model] = {
      async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          if (args.where.tenantId && args.where.tenantId !== tenantId && args.where.tenantId !== 'all') {
            throw new Error(`SECURITY_TENANT_MISMATCH: Cross-tenant query blocked! Active: ${tenantId}, Requested: ${args.where.tenantId}`);
          }
          args.where.tenantId = tenantId;
        }
        return query(args);
      },

      async findFirst({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          if (args.where.tenantId && args.where.tenantId !== tenantId && args.where.tenantId !== 'all') {
            throw new Error(`SECURITY_TENANT_MISMATCH: Cross-tenant query blocked! Active: ${tenantId}, Requested: ${args.where.tenantId}`);
          }
          args.where.tenantId = tenantId;
        }
        return query(args);
      },

      async findUnique({ model: clientModel, args, query }: { model?: any; args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (!tenantId) {
          return query(args);
        }

        // Convert findUnique to findFirst with tenantId to eliminate IDOR vulnerabilities
        const scopedWhere = { ...args.where, tenantId };
        const scopedArgs = { ...args, where: scopedWhere };

        if (options.findFirstDelegate) {
          return options.findFirstDelegate(scopedArgs);
        }

        // If running inside Prisma Client runtime, invoke findFirst on the model delegate
        if (clientModel && typeof clientModel.findFirst === 'function') {
          return clientModel.findFirst(scopedArgs);
        }

        return query(scopedArgs);
      },

      async count({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          args.where.tenantId = tenantId;
        }
        return query(args);
      },

      async create({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.data = args.data || {};
          if (args.data.tenantId && args.data.tenantId !== tenantId) {
            throw new Error(`SECURITY_TENANT_MISMATCH: Cannot create record for another tenant! Active: ${tenantId}, Given: ${args.data.tenantId}`);
          }
          args.data.tenantId = tenantId;
        }
        return query(args);
      },

      async createMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId && Array.isArray(args.data)) {
          for (const item of args.data) {
            if (item.tenantId && item.tenantId !== tenantId) {
              throw new Error(`SECURITY_TENANT_MISMATCH: Batch creation contains record with mismatched tenant!`);
            }
            item.tenantId = tenantId;
          }
        }
        return query(args);
      },

      async update({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          args.where.tenantId = tenantId;
        }
        return query(args);
      },

      async updateMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          args.where.tenantId = tenantId;
        }
        return query(args);
      },

      async delete({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          args.where.tenantId = tenantId;
        }
        return query(args);
      },

      async deleteMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          args.where.tenantId = tenantId;
        }
        return query(args);
      },
    };
  }

  return {
    query: queryExtensions,
  };
}
