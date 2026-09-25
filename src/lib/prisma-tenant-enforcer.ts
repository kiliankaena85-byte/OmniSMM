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
  'ledgerEntry',
  'supportFinancialAction',
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

function applyTenantWhereClause(where: Record<string, any>, activeTenantId: string, model: string) {
  if (!where.tenantId) {
    if (model === 'category' || model === 'service') {
      where.tenantId = { in: [activeTenantId, 'all'] };
    } else {
      where.tenantId = activeTenantId;
    }
    return;
  }

  const requested = where.tenantId;

  // 1. Simple string tenantId
  if (typeof requested === 'string') {
    if (requested !== activeTenantId && requested !== 'all') {
      throw new Error(`SECURITY_TENANT_MISMATCH: Cross-tenant query blocked! Active: ${activeTenantId}, Requested: ${requested}`);
    }
    return;
  }

  // 2. Object filter with `in` (e.g. tenantVisibilityFilter(tenantId) => { in: [tenantId, 'all'] })
  if (typeof requested === 'object' && requested !== null) {
    if (Array.isArray(requested.in)) {
      const hasCrossTenant = requested.in.some(
        (t: unknown) => typeof t === 'string' && t !== activeTenantId && t !== 'all'
      );
      if (hasCrossTenant) {
        throw new Error(
          `SECURITY_TENANT_MISMATCH: Cross-tenant query blocked! Active: ${activeTenantId}, Requested: ${JSON.stringify(requested)}`
        );
      }
      return;
    }

    if (typeof requested.equals === 'string') {
      if (requested.equals !== activeTenantId && requested.equals !== 'all') {
        throw new Error(
          `SECURITY_TENANT_MISMATCH: Cross-tenant query blocked! Active: ${activeTenantId}, Requested: ${requested.equals}`
        );
      }
      return;
    }
  }

  // Fallback: If unknown object shape, set to activeTenantId
  where.tenantId = activeTenantId;
}

export function createTenantEnforcerExtension(options: TenantEnforcerOptions = {}) {
  const queryExtensions: Record<string, any> = {};

  for (const model of TENANT_SCOPED_MODELS) {
    queryExtensions[model] = {
      async findMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          applyTenantWhereClause(args.where, tenantId, model);
        }
        return query(args);
      },

      async findFirst({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          applyTenantWhereClause(args.where, tenantId, model);
        }
        return query(args);
      },

      async findUnique({ model: clientModel, args, query }: { model?: any; args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (!tenantId) {
          return query(args);
        }

        // Primary key lookup for User: User ID (CUID) is globally unique, and staff (OWNER, ADMIN, SUPPORT)
        // have legitimate rights to manage any site on OmniSMM without scoping by home tenant.
        if (model === 'user' && args.where && args.where.id) {
          return query(args);
        }

        // Convert findUnique to findFirst with tenantId to eliminate IDOR vulnerabilities
        const scopedWhere = (model === 'category' || model === 'service')
          ? { ...args.where, tenantId: { in: [tenantId, 'all'] } }
          : { ...args.where, tenantId };
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
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          applyTenantWhereClause(args.where, tenantId, model);
        }
        return query(args);
      },

      async create({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.data = args.data || {};
          if (args.data.tenantId && args.data.tenantId !== tenantId && args.data.tenantId !== 'all') {
            throw new Error(`SECURITY_TENANT_MISMATCH: Cannot create record for another tenant! Active: ${tenantId}, Given: ${args.data.tenantId}`);
          }
          if (!args.data.tenantId) {
            args.data.tenantId = tenantId;
          }
        }
        return query(args);
      },

      async createMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId && Array.isArray(args.data)) {
          for (const item of args.data) {
            if (item.tenantId && item.tenantId !== tenantId && item.tenantId !== 'all') {
              throw new Error(`SECURITY_TENANT_MISMATCH: Batch creation contains record with mismatched tenant!`);
            }
            if (!item.tenantId) {
              item.tenantId = tenantId;
            }
          }
        }
        return query(args);
      },

      async update({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          applyTenantWhereClause(args.where, tenantId, model);
        }
        return query(args);
      },

      async updateMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          applyTenantWhereClause(args.where, tenantId, model);
        }
        return query(args);
      },

      async delete({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          applyTenantWhereClause(args.where, tenantId, model);
        }
        return query(args);
      },

      async deleteMany({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
        if (isTenantBypassActive()) {
          return query(args);
        }
        const tenantId = await resolveActiveTenantId();
        if (tenantId) {
          args.where = args.where || {};
          applyTenantWhereClause(args.where, tenantId, model);
        }
        return query(args);
      },
    };
  }

  return {
    query: queryExtensions,
  };
}
