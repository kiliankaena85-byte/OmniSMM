'use server';

import { z } from "zod";
import { db } from "@/lib/db";
import { requireStaffPermission, requireOwnerPermission } from "@/lib/server/rbac";
import { auditAdminAwaitable } from "@/lib/admin-audit";
import { BALANCE_ADJUSTMENT_REASONS } from "@/constants/balance-adjustments";

const numericString = z.string().regex(/^\d+$/, "Сумма должна быть неотрицательным целым числом");

const upsertPolicySchema = z.object({
  id: z.string().optional(),
  scopeType: z.enum(['GLOBAL', 'ROLE', 'USER']),
  staffRoleId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  enabled: z.boolean().default(false),
  canRequestCredit: z.boolean().default(false),
  canRequestDebit: z.boolean().default(false),
  canApprove: z.boolean().default(false),
  canReject: z.boolean().default(false),
  canViewAll: z.boolean().default(false),
  canViewStats: z.boolean().default(false),
  maxCreditPerRequest: numericString.default("0"),
  maxDebitPerRequest: numericString.default("0"),
  maxCreditPerDay: numericString.default("0"),
  maxDebitPerDay: numericString.default("0"),
  maxTotalPerDay: numericString.default("0"),
  maxApprovalPerRequest: numericString.default("0"),
  allowedCreditReasonCodes: z.array(z.string()).default([...BALANCE_ADJUSTMENT_REASONS.CREDIT]),
  allowedDebitReasonCodes: z.array(z.string()).default([...BALANCE_ADJUSTMENT_REASONS.DEBIT]),
  allowedTargetRoles: z.array(z.string()).default(['USER', 'SUPPORT']),
  requireTicket: z.boolean().default(true),
  requireOrderForDebit: z.boolean().default(false),
  blockBannedTargets: z.boolean().default(true),
  blockDeletedTargets: z.boolean().default(true),
  autoExecuteBelow: numericString.default("0")
});

export async function getBalancePoliciesAction() {
  return requireStaffPermission('balance_policy', 'view', async () => {
    const policies = await db.balanceAdjustmentPolicy.findMany({
      orderBy: [{ scopeType: 'asc' }, { createdAt: 'desc' }]
    });

    const serialized = policies.map(p => ({
      ...p,
      maxCreditPerRequest: p.maxCreditPerRequest.toString(),
      maxDebitPerRequest: p.maxDebitPerRequest.toString(),
      maxCreditPerDay: p.maxCreditPerDay.toString(),
      maxDebitPerDay: p.maxDebitPerDay.toString(),
      maxTotalPerDay: p.maxTotalPerDay.toString(),
      maxApprovalPerRequest: p.maxApprovalPerRequest.toString(),
      autoExecuteBelow: p.autoExecuteBelow.toString(),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString()
    }));

    return { success: true, policies: serialized };
  });
}

export async function upsertBalancePolicyAction(formData: FormData) {
  const scopeType = formData.get("scopeType") as string;

  const actionHandler = async (adminUser: { id: string; email: string }) => {
    const rawData = {
      id: (formData.get("id") as string) || undefined,
      scopeType: scopeType as 'GLOBAL' | 'ROLE' | 'USER',
      staffRoleId: (formData.get("staffRoleId") as string) || null,
      userId: (formData.get("userId") as string) || null,
      isActive: formData.get("isActive") === "true",
      enabled: formData.get("enabled") === "true",
      canRequestCredit: formData.get("canRequestCredit") === "true",
      canRequestDebit: formData.get("canRequestDebit") === "true",
      canApprove: formData.get("canApprove") === "true",
      canReject: formData.get("canReject") === "true",
      canViewAll: formData.get("canViewAll") === "true",
      canViewStats: formData.get("canViewStats") === "true",
      maxCreditPerRequest: (formData.get("maxCreditPerRequest") as string) || "0",
      maxDebitPerRequest: (formData.get("maxDebitPerRequest") as string) || "0",
      maxCreditPerDay: (formData.get("maxCreditPerDay") as string) || "0",
      maxDebitPerDay: (formData.get("maxDebitPerDay") as string) || "0",
      maxTotalPerDay: (formData.get("maxTotalPerDay") as string) || "0",
      maxApprovalPerRequest: (formData.get("maxApprovalPerRequest") as string) || "0",
      allowedCreditReasonCodes: formData.getAll("allowedCreditReasonCodes").map(String),
      allowedDebitReasonCodes: formData.getAll("allowedDebitReasonCodes").map(String),
      allowedTargetRoles: formData.getAll("allowedTargetRoles").map(String),
      requireTicket: formData.get("requireTicket") === "true",
      requireOrderForDebit: formData.get("requireOrderForDebit") === "true",
      blockBannedTargets: formData.get("blockBannedTargets") === "true",
      blockDeletedTargets: formData.get("blockDeletedTargets") === "true",
      autoExecuteBelow: (formData.get("autoExecuteBelow") as string) || "0"
    };

    const parsed = upsertPolicySchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Ошибка валидации политики" };
    }

    const data = parsed.data;

    if (data.scopeType === 'ROLE' && !data.staffRoleId) {
      return { success: false, error: "Для роли требуется указать staffRoleId" };
    }

    if (data.scopeType === 'USER' && !data.userId) {
      return { success: false, error: "Для пользователя требуется указать userId" };
    }

    const policyData = {
      scopeType: data.scopeType,
      staffRoleId: data.scopeType === 'ROLE' ? data.staffRoleId : null,
      userId: data.scopeType === 'USER' ? data.userId : null,
      isActive: data.isActive,
      enabled: data.enabled,
      canRequestCredit: data.canRequestCredit,
      canRequestDebit: data.canRequestDebit,
      canApprove: data.canApprove,
      canReject: data.canReject,
      canViewAll: data.canViewAll,
      canViewStats: data.canViewStats,
      maxCreditPerRequest: BigInt(data.maxCreditPerRequest),
      maxDebitPerRequest: BigInt(data.maxDebitPerRequest),
      maxCreditPerDay: BigInt(data.maxCreditPerDay),
      maxDebitPerDay: BigInt(data.maxDebitPerDay),
      maxTotalPerDay: BigInt(data.maxTotalPerDay),
      maxApprovalPerRequest: BigInt(data.maxApprovalPerRequest),
      allowedCreditReasonCodes: JSON.stringify(data.allowedCreditReasonCodes),
      allowedDebitReasonCodes: JSON.stringify(data.allowedDebitReasonCodes),
      allowedTargetRoles: JSON.stringify(data.allowedTargetRoles),
      requireTicket: data.requireTicket,
      requireOrderForDebit: data.requireOrderForDebit,
      blockBannedTargets: data.blockBannedTargets,
      blockDeletedTargets: data.blockDeletedTargets,
      autoExecuteBelow: BigInt(data.autoExecuteBelow)
    };

    let policy;
    if (data.id) {
      const old = await db.balanceAdjustmentPolicy.findUnique({ where: { id: data.id } });
      policy = await db.balanceAdjustmentPolicy.update({
        where: { id: data.id },
        data: policyData
      });

      await auditAdminAwaitable({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'BALANCE_POLICY_UPDATED',
        target: policy.id,
        targetType: 'BalanceAdjustmentPolicy',
        oldValue: old,
        newValue: policy
      });
    } else {
      policy = await db.balanceAdjustmentPolicy.create({
        data: policyData
      });

      await auditAdminAwaitable({
        adminId: adminUser.id,
        adminEmail: adminUser.email,
        action: 'BALANCE_POLICY_CREATED',
        target: policy.id,
        targetType: 'BalanceAdjustmentPolicy',
        newValue: policy
      });
    }

    return { success: true, policyId: policy.id };
  };

  if (scopeType === 'GLOBAL') {
    return requireOwnerPermission(actionHandler);
  } else {
    return requireStaffPermission('balance_policy', 'edit', actionHandler);
  }
}
