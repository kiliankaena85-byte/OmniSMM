'use server';

import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireStaffPermission } from "@/lib/server/rbac";
import { auditAdminAwaitable } from "@/lib/admin-audit";
import { getEffectiveBalancePolicy, parsePolicyReasonCodes } from "@/services/admin/balance-policy.service";
import { WalletOps } from "@/services/financial/wallet-ops";
import { PaymentGatewayFactory } from "@/services/financial/payment-gateway.service";
import {
  BALANCE_ADJUSTMENT_DIRECTION,
  BALANCE_ADJUSTMENT_STATUS,
} from "@/constants/balance-adjustments";

const createRequestSchema = z.object({
  userId: z.string().min(1, "Пользователь не выбран"),
  direction: z.enum([BALANCE_ADJUSTMENT_DIRECTION.CREDIT, BALANCE_ADJUSTMENT_DIRECTION.DEBIT]),
  amount: z.string()
    .min(1, "Сумма не указана")
    .regex(/^\d+(\.\d{1,2})?$/, "Некорректный формат суммы (пример: 100 или 100.50)")
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, "Сумма должна быть строго больше нуля"),
  reasonCode: z.string().min(1, "Причина не выбрана"),
  reasonNote: z.string().min(10, "Примечание должно содержать минимум 10 символов").max(2000),
  ticketId: z.string().optional().nullable(),
  orderId: z.string().optional().nullable(),
  paymentId: z.string().optional().nullable(),
  idempotencyKey: z.string().uuid("Невалидный ключ идемпотентности")
});

function parseAmountToKopecks(input: string): bigint {
  const normalized = input.trim();
  const decMatch = /^(\d+)\.(\d{1,2})$/.exec(normalized);
  if (decMatch) {
    const intPart = BigInt(decMatch[1]) * BigInt(100);
    const decPart = BigInt(decMatch[2].padEnd(2, '0'));
    return intPart + decPart;
  }
  const intMatch = /^(\d+)$/.exec(normalized);
  if (intMatch) {
    return BigInt(intMatch[1]) * BigInt(100);
  }
  throw new Error("INVALID_AMOUNT_FORMAT");
}

export async function createBalanceAdjustmentRequestAction(formData: FormData) {
  return requireStaffPermission('balance_requests', 'edit', async (staffUser) => {
    const rawUserId = (formData.get("userId") || formData.get("targetUserId")) as string;
    const rawAmountCents = formData.get("amountCents") as string | null;
    let rawAmount = (formData.get("amount") || formData.get("amountRub")) as string;

    if (!rawAmount && rawAmountCents && /^\d+$/.test(rawAmountCents.trim())) {
      rawAmount = (Number(rawAmountCents.trim()) / 100).toFixed(2);
    }

    const rawData = {
      userId: rawUserId,
      direction: formData.get("direction") as string,
      amount: rawAmount,
      reasonCode: formData.get("reasonCode") as string,
      reasonNote: formData.get("reasonNote") as string,
      ticketId: (formData.get("ticketId") as string) || null,
      orderId: (formData.get("orderId") as string) || null,
      paymentId: (formData.get("paymentId") as string) || null,
      idempotencyKey: ((formData.get("idempotencyKey") as string)?.trim()) || crypto.randomUUID()
    };

    const parsed = createRequestSchema.safeParse(rawData);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Ошибка валидации" };
    }

    const data = parsed.data;
    let amountBigInt: bigint;
    try {
      if (rawAmountCents && /^\d+$/.test(rawAmountCents.trim())) {
        amountBigInt = BigInt(rawAmountCents.trim());
      } else {
        amountBigInt = parseAmountToKopecks(data.amount);
      }
    } catch {
      return { success: false, error: "Указана некорректная сумма" };
    }

    if (amountBigInt <= BigInt(0)) {
      return { success: false, error: "Сумма должна быть строго больше нуля" };
    }

    // Prevents self-adjustment
    if (data.userId === staffUser.id) {
      return { success: false, error: "Запрещено создавать заявку на изменение собственного баланса" };
    }

    const policy = await getEffectiveBalancePolicy(staffUser.id);
    if (!policy || !policy.enabled || !policy.isActive) {
      return { success: false, error: "Политика корректировки баланса не настроена или отключена" };
    }

    const { allowedCreditReasonCodes, allowedDebitReasonCodes, allowedTargetRoles } = parsePolicyReasonCodes(policy);

    // Direction check
    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
      if (!policy.canRequestCredit) {
        return { success: false, error: "Вам запрещено запрашивать начисление баланса" };
      }
      if (!allowedCreditReasonCodes.includes(data.reasonCode)) {
        return { success: false, error: `Недопустимый код причины начисления: ${data.reasonCode}` };
      }
      if (policy.maxCreditPerRequest > BigInt(0) && amountBigInt > policy.maxCreditPerRequest) {
        return { success: false, error: `Превышен разовый лимит начисления: макс. ${policy.maxCreditPerRequest.toString()} коп.` };
      }
    } else {
      if (!policy.canRequestDebit) {
        return { success: false, error: "Вам запрещено запрашивать списание баланса" };
      }
      if (!allowedDebitReasonCodes.includes(data.reasonCode)) {
        return { success: false, error: `Недопустимый код причины списания: ${data.reasonCode}` };
      }
      if (policy.maxDebitPerRequest > BigInt(0) && amountBigInt > policy.maxDebitPerRequest) {
        return { success: false, error: `Превышен разовый лимит списания: макс. ${policy.maxDebitPerRequest.toString()} коп.` };
      }
    }

    // Check target user
    const targetUser = await db.user.findUnique({
      where: { id: data.userId },
      select: { id: true, email: true, role: true, balance: true, isDeleted: true, isActive: true }
    });

    if (!targetUser) {
      return { success: false, error: "Целевой пользователь не найден" };
    }

    if (policy.blockDeletedTargets && targetUser.isDeleted) {
      return { success: false, error: "Запрещено изменять баланс удаленного пользователя" };
    }

    if (policy.blockBannedTargets && targetUser.role === 'BANNED') {
      return { success: false, error: "Запрещено изменять баланс заблокированного пользователя" };
    }

    if (!allowedTargetRoles.includes(targetUser.role)) {
      return { success: false, error: `Запрещено создавать заявку для пользователя с ролью ${targetUser.role}` };
    }

    // Ticket requirement & existence check
    if (data.ticketId && data.ticketId.trim().length > 0) {
      const ticket = await db.ticket.findUnique({ where: { id: data.ticketId } });
      if (!ticket) {
        return { success: false, error: "Указанный тикет поддержки не существует" };
      }
    } else if (policy.requireTicket) {
      return { success: false, error: "Для создания заявки требуется указать ID существующего тикета поддержки" };
    }

    // Debit balance check
    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.DEBIT) {
      if (policy.requireOrderForDebit && (!data.orderId || data.orderId.trim().length === 0)) {
        return { success: false, error: "Для списания требуется указать ID связанного заказа" };
      }
      if (targetUser.balance < amountBigInt) {
        return { success: false, error: `Недостаточно средств у клиента: баланс ${targetUser.balance.toString()} коп., запрошено ${amountBigInt.toString()} коп.` };
      }
    }

    // Daily limit aggregate calculations for this staff member
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayAdjustments = await db.manualBalanceAdjustment.findMany({
      where: {
        requestedBy: staffUser.id,
        createdAt: { gte: startOfDay },
        status: { in: [BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL, BALANCE_ADJUSTMENT_STATUS.APPROVED, BALANCE_ADJUSTMENT_STATUS.EXECUTED] }
      },
      select: { direction: true, amount: true }
    });

    let todayCreditSum = BigInt(0);
    let todayDebitSum = BigInt(0);

    for (const adj of todayAdjustments) {
      if (adj.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
        todayCreditSum += adj.amount;
      } else {
        todayDebitSum += adj.amount;
      }
    }

    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT && policy.maxCreditPerDay > BigInt(0)) {
      if (todayCreditSum + amountBigInt > policy.maxCreditPerDay) {
        return { success: false, error: `Превышен дневной лимит начислений (${policy.maxCreditPerDay.toString()} коп.)` };
      }
    }

    if (data.direction === BALANCE_ADJUSTMENT_DIRECTION.DEBIT && policy.maxDebitPerDay > BigInt(0)) {
      if (todayDebitSum + amountBigInt > policy.maxDebitPerDay) {
        return { success: false, error: `Превышен дневной лимит списаний (${policy.maxDebitPerDay.toString()} коп.)` };
      }
    }

    if (policy.maxTotalPerDay > BigInt(0)) {
      if (todayCreditSum + todayDebitSum + amountBigInt > policy.maxTotalPerDay) {
        return { success: false, error: `Превышен суммарный дневной лимит заявок (${policy.maxTotalPerDay.toString()} коп.)` };
      }
    }

    // Idempotency check before creation
    if (data.idempotencyKey) {
      const existing = await db.manualBalanceAdjustment.findFirst({
        where: { idempotencyKey: data.idempotencyKey }
      });
      if (existing) {
        return { success: true, data: existing, note: 'Заявка с данным ключом уже существует' };
      }
    }

    // Create adjustment request
    const adjustment = await db.manualBalanceAdjustment.create({
      data: {
        userId: data.userId,
        requestedBy: staffUser.id,
        direction: data.direction,
        amount: amountBigInt,
        reasonCode: data.reasonCode,
        reasonNote: data.reasonNote,
        ticketId: data.ticketId,
        orderId: data.orderId,
        paymentId: data.paymentId,
        status: BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL,
        idempotencyKey: data.idempotencyKey,
        policySnapshot: JSON.stringify({
          policyId: policy.id,
          scopeType: policy.scopeType,
          maxCreditPerRequest: policy.maxCreditPerRequest.toString(),
          maxDebitPerRequest: policy.maxDebitPerRequest.toString()
        })
      }
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'BALANCE_ADJUSTMENT_REQUESTED',
      target: adjustment.id,
      targetType: 'ManualBalanceAdjustment',
      newValue: {
        targetUserId: data.userId,
        targetEmail: targetUser.email,
        direction: data.direction,
        amountCents: amountBigInt.toString(),
        reasonCode: data.reasonCode,
        ticketId: data.ticketId
      }
    });

    return {
      success: true,
      id: adjustment.id,
      status: adjustment.status
    };
  });
}

const cancelAdjustmentSchema = z.object({
  id: z.string().min(1, "ID не указан")
});

const approveAdjustmentSchema = z.object({
  id: z.string().min(1, "ID не указан")
});

export async function cancelBalanceAdjustmentRequestAction(formData: FormData) {
  return requireStaffPermission('balance_requests', 'edit', async (staffUser) => {
    const parsed = cancelAdjustmentSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "ID не указан" };
    const { id } = parsed.data;

    const adjustment = await db.manualBalanceAdjustment.findUnique({ where: { id } });
    if (!adjustment) return { success: false, error: "Заявка не найдена" };

    if (adjustment.requestedBy !== staffUser.id && staffUser.role !== 'OWNER' && staffUser.role !== 'ADMIN') {
      return { success: false, error: "Вы можете отменять только свои собственные заявки" };
    }

    if (adjustment.status !== BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL && adjustment.status !== BALANCE_ADJUSTMENT_STATUS.EXECUTION_FAILED) {
      return { success: false, error: `Нельзя отменить заявку в статусе ${adjustment.status}` };
    }

    // If it was a card refund request, return held funds to user balance
    if (adjustment.reasonCode === 'REFUND_TO_CARD') {
      await db.$transaction(async (tx) => {
        await WalletOps.credit(
          tx,
          adjustment.userId,
          adjustment.amount,
          `Возврат средств: Заявка на возврат на карту отменена инициатором`,
          { idempotencyKey: `refund_cancel_${adjustment.id}`, adminId: staffUser.id }
        );
      });
    }

    const updated = await db.manualBalanceAdjustment.update({
      where: { id },
      data: { status: BALANCE_ADJUSTMENT_STATUS.CANCELED }
    });

    await auditAdminAwaitable({
      adminId: staffUser.id,
      adminEmail: staffUser.email,
      action: 'BALANCE_ADJUSTMENT_CANCELED',
      target: adjustment.id,
      targetType: 'ManualBalanceAdjustment',
      oldValue: { status: adjustment.status },
      newValue: { status: updated.status }
    });

    return { success: true, id: updated.id, status: updated.status };
  });
}

export async function approveBalanceAdjustmentAction(formData: FormData) {
  return requireStaffPermission('balance_approvals', 'edit', async (approver) => {
    const parsed = approveAdjustmentSchema.safeParse({ id: formData.get("id") });
    if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message || "ID не указан" };
    const { id } = parsed.data;

    const adjustment = await db.manualBalanceAdjustment.findUnique({
      where: { id },
      include: { user: true, requester: true }
    });

    if (!adjustment) return { success: false, error: "Заявка не найдена" };

    if (adjustment.status !== BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL) {
      return { success: false, error: `Заявка находится в статусе ${adjustment.status} и не может быть подтверждена` };
    }

    // Prevent self-approval for subordinate staff (Dual-Custody / Maker-Checker invariant)
    // Sovereign roles (OWNER and top-tier ADMIN) are authorized to approve their own requests
    if (adjustment.requestedBy === approver.id && approver.role !== 'OWNER' && approver.role !== 'ADMIN') {
      return { success: false, error: "Запрещено подтверждать собственную заявку сотрудникам. Требуется подтверждение руководителя или владельца." };
    }

    const policy = await getEffectiveBalancePolicy(approver.id);
    if (!policy || !policy.canApprove) {
      return { success: false, error: "Вам не разрешено подтверждать заявки корректировки баланса" };
    }

    // Approval limit check
    if (policy.maxApprovalPerRequest > BigInt(0) && adjustment.amount > policy.maxApprovalPerRequest) {
      if (approver.role !== 'OWNER' && approver.role !== 'ADMIN') {
        return { success: false, error: `Превышен лимит утверждения: макс. ${policy.maxApprovalPerRequest.toString()} коп.` };
      }
    }

    // Fresh Target User Revalidation before approval execution
    const freshTargetUser = await db.user.findUnique({
      where: { id: adjustment.userId },
      select: { id: true, email: true, balance: true, isDeleted: true, isActive: true, role: true }
    });

    if (!freshTargetUser || freshTargetUser.isDeleted || !freshTargetUser.isActive || freshTargetUser.role === 'BANNED') {
      return { success: false, error: "Целевой пользователь заблокирован, удален или неактивен" };
    }

    // For standard manual adjustments (non-refund), verify target balance on debit
    if (adjustment.reasonCode !== 'REFUND_TO_CARD' && adjustment.direction === BALANCE_ADJUSTMENT_DIRECTION.DEBIT && freshTargetUser.balance < adjustment.amount) {
      return { success: false, error: `У целевого пользователя недостаточно средств для списания: баланс ${freshTargetUser.balance.toString()} коп., требуется ${adjustment.amount.toString()} коп.` };
    }

    // Atomic Status Transition: PENDING_APPROVAL / EXECUTION_FAILED -> APPROVED
    const updatedCount = await db.manualBalanceAdjustment.updateMany({
      where: {
        id: adjustment.id,
        status: { in: [BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL, BALANCE_ADJUSTMENT_STATUS.EXECUTION_FAILED] }
      },
      data: {
        status: BALANCE_ADJUSTMENT_STATUS.APPROVED,
        approvedBy: approver.id,
        approvedAt: new Date()
      }
    });

    if (updatedCount.count === 0) {
      return { success: false, error: "Заявка уже обрабатывается или статус был изменен" };
    }

    // Case 1: Automated Gateway Card Refund (YooKassa) vs Manual Merchant Refund (Robokassa / CryptoBot)
    if (adjustment.reasonCode === 'REFUND_TO_CARD') {
      try {
        const payment = adjustment.paymentId
          ? await db.payment.findUnique({ where: { id: adjustment.paymentId } })
          : null;

        if (!payment) {
          throw new Error('Привязанный платеж не найден');
        }

        const gateway = PaymentGatewayFactory.getGateway(payment.gateway);
        let refundReceiptId: string | undefined;

        if (gateway.executeRefund) {
          const refundRes = await gateway.executeRefund({
            paymentGatewayId: payment.gatewayId || payment.id,
            amountRub: Number(adjustment.amount) / 100,
            email: freshTargetUser.email || adjustment.user?.email,
            reason: adjustment.reasonNote || 'Возврат средств по заявке',
            idempotencyKey: `yoo_refund_${adjustment.id}`,
            tenantId: payment.tenantId || adjustment.user?.tenantId || 'smmplan',
          });
          refundReceiptId = refundRes.receiptRegistration || refundRes.refundId;
        } else {
          // Gateway does NOT support automated API refunds (e.g. Robokassa, CryptoBot)
          const manualConfirmed = formData.get("manualConfirmed") === "true";
          if (!manualConfirmed) {
            // Revert state back to PENDING_APPROVAL so the card refund remains actionable
            await db.manualBalanceAdjustment.update({
              where: { id: adjustment.id },
              data: {
                status: BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL,
                approvedBy: null,
                approvedAt: null,
              }
            });
            const gwLabel = (payment.gateway || 'эквайринг').toUpperCase();
            return {
              success: false,
              requiresManualRefund: true,
              gateway: payment.gateway,
              paymentId: payment.gatewayId || payment.id,
              error: `Шлюз ${gwLabel} не поддерживает автоматический возврат через API. Для завершения операции выполните возврат вручную в личном кабинете ${gwLabel} (ID платежа: ${payment.gatewayId || payment.id}) и подтвердите выполнение с установленным флагом ручного возврата.`,
            };
          }
          refundReceiptId = `MANUAL_${(payment.gateway || 'MANUAL').toUpperCase()}_${Date.now()}`;
        }

        if (refundReceiptId) {
          await db.payment.update({
            where: { id: payment.id },
            data: { refundReceiptId }
          });
        }

        await db.manualBalanceAdjustment.update({
          where: { id: adjustment.id },
          data: {
            status: BALANCE_ADJUSTMENT_STATUS.EXECUTED,
          }
        });

        await auditAdminAwaitable({
          adminId: approver.id,
          adminEmail: approver.email,
          action: gateway.executeRefund ? 'CARD_REFUND_EXECUTED_VIA_GATEWAY' : 'CARD_REFUND_CONFIRMED_MANUAL',
          target: adjustment.id,
          targetType: 'ManualBalanceAdjustment',
          newValue: {
            targetUserId: adjustment.userId,
            paymentId: payment.id,
            gatewayId: payment.gatewayId,
            gateway: payment.gateway,
            amountCents: adjustment.amount.toString(),
            refundReceiptId,
            manualConfirmed: !gateway.executeRefund,
          }
        });

        return { success: true, id: adjustment.id, status: BALANCE_ADJUSTMENT_STATUS.EXECUTED };
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[ApproveBalanceAdjustment:Refund] Execution failed:", err);

        await db.manualBalanceAdjustment.update({
          where: { id: adjustment.id },
          data: {
            status: BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL,
            executionError: errMsg || "Ошибка шлюза при возврате"
          }
        });

        return { success: false, error: `Сбой при проведении возврата через шлюз: ${errMsg}` };
      }
    }

    // Case 2: Standard Balance Adjustment (CREDIT / DEBIT)
    try {
      const executionResult = await db.$transaction(async (tx) => {
        let res;
        if (adjustment.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
          res = await WalletOps.credit(
            tx,
            adjustment.userId,
            adjustment.amount,
            `Корректировка баланса (заявка #${adjustment.id.slice(-6)}): ${adjustment.reasonCode}`,
            { idempotencyKey: `manual_adjustment:${adjustment.id}`, adminId: approver.id }
          );
        } else {
          res = await WalletOps.adminAdjust(
            tx,
            adjustment.userId,
            -adjustment.amount,
            `Корректировка баланса (заявка #${adjustment.id.slice(-6)}): ${adjustment.reasonCode}`,
            { idempotencyKey: `manual_adjustment:${adjustment.id}`, adminId: approver.id, transactionType: 'ADJUSTMENT' }
          );
        }

        await tx.manualBalanceAdjustment.update({
          where: { id: adjustment.id },
          data: {
            status: BALANCE_ADJUSTMENT_STATUS.EXECUTED,
            ledgerEntryId: res.entry.id
          }
        });

        return res;
      });

      await auditAdminAwaitable({
        adminId: approver.id,
        adminEmail: approver.email,
        action: 'BALANCE_ADJUSTMENT_EXECUTED',
        target: adjustment.id,
        targetType: 'ManualBalanceAdjustment',
        newValue: {
          targetUserId: adjustment.userId,
          requestedBy: adjustment.requestedBy,
          approvedBy: approver.id,
          direction: adjustment.direction,
          amountCents: adjustment.amount.toString(),
          ledgerEntryId: executionResult.entry.id
        }
      });

      return { success: true, id: adjustment.id, status: BALANCE_ADJUSTMENT_STATUS.EXECUTED };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[ApproveBalanceAdjustment] Execution failed:", err);

      await db.manualBalanceAdjustment.update({
        where: { id: adjustment.id },
        data: {
          status: BALANCE_ADJUSTMENT_STATUS.EXECUTION_FAILED,
          executionError: errMsg || "Ошибка исполнения транзакции"
        }
      });

      await auditAdminAwaitable({
        adminId: approver.id,
        adminEmail: approver.email,
        action: 'BALANCE_ADJUSTMENT_EXECUTION_FAILED',
        target: adjustment.id,
        targetType: 'ManualBalanceAdjustment',
        newValue: { error: errMsg }
      });

      return { success: false, error: `Сбой при зачислении/списании: ${errMsg}` };
    }
  });
}

const rejectAdjustmentSchema = z.object({
  id: z.string().min(1, "ID не указан"),
  rejectionReason: z.string().min(5, "Причина отклонения должна содержать минимум 5 символов")
});

export async function rejectBalanceAdjustmentAction(formData: FormData) {
  return requireStaffPermission('balance_approvals', 'edit', async (rejecter) => {
    const rawPayload = {
      id: formData.get("id"),
      rejectionReason: formData.get("rejectionReason")
    };
    const parsed = rejectAdjustmentSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Некорректные параметры отклонения" };
    }
    const { id, rejectionReason } = parsed.data;

    const adjustment = await db.manualBalanceAdjustment.findUnique({ where: { id } });
    if (!adjustment) return { success: false, error: "Заявка не найдена" };

    if (adjustment.status !== BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL && adjustment.status !== BALANCE_ADJUSTMENT_STATUS.EXECUTION_FAILED) {
      return { success: false, error: `Заявка находится в статусе ${adjustment.status} и не может быть отклонена` };
    }

    if (adjustment.requestedBy === rejecter.id && rejecter.role !== 'OWNER' && rejecter.role !== 'ADMIN') {
      return { success: false, error: "Запрещено отклонять собственную заявку" };
    }

    // If it was a card refund request, return held funds to user balance
    if (adjustment.reasonCode === 'REFUND_TO_CARD') {
      await db.$transaction(async (tx) => {
        await WalletOps.credit(
          tx,
          adjustment.userId,
          adjustment.amount,
          `Возврат средств: Заявка на возврат на карту отклонена (${rejectionReason.trim()})`,
          { idempotencyKey: `refund_reject_${adjustment.id}`, adminId: rejecter.id }
        );
      });
    }

    const updated = await db.manualBalanceAdjustment.update({
      where: { id },
      data: {
        status: BALANCE_ADJUSTMENT_STATUS.REJECTED,
        rejectedBy: rejecter.id,
        rejectedAt: new Date(),
        rejectionReason: rejectionReason.trim()
      }
    });

    await auditAdminAwaitable({
      adminId: rejecter.id,
      adminEmail: rejecter.email,
      action: 'BALANCE_ADJUSTMENT_REJECTED',
      target: adjustment.id,
      targetType: 'ManualBalanceAdjustment',
      newValue: {
        rejectedBy: rejecter.id,
        rejectionReason: rejectionReason.trim()
      }
    });

    return { success: true, id: updated.id, status: updated.status };
  });
}

const getAdjustmentsSchema = z.object({
  status: z.string().optional(),
  direction: z.string().optional(),
  userId: z.string().optional(),
  requestedBy: z.string().optional(),
  reasonCode: z.string().optional(),
  ticketId: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

const getAdjustmentStatsSchema = z.object({
  requestedBy: z.string().optional(),
  direction: z.string().optional(),
  reasonCode: z.string().optional(),
  status: z.string().optional()
});

export async function getBalanceAdjustmentsAction(formData: FormData) {
  return requireStaffPermission('balance_requests', 'view', async (staffUser) => {
    const policy = await getEffectiveBalancePolicy(staffUser.id);
    const canViewAll = staffUser.role === 'OWNER' || staffUser.role === 'ADMIN' || (policy?.canViewAll ?? false);

    const rawPayload = Object.fromEntries(formData.entries());
    const parsed = getAdjustmentsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Некорректные параметры фильтра" };
    }

    const { status, direction, userId, requestedBy, reasonCode, ticketId, search, page, pageSize } = parsed.data;

    // Filter construction
    const where: Prisma.ManualBalanceAdjustmentWhereInput = {};

    if (!canViewAll) {
      where.requestedBy = staffUser.id;
    } else if (requestedBy) {
      where.requestedBy = requestedBy;
    }

    if (status) where.status = status;
    if (direction) where.direction = direction;
    if (userId) where.userId = userId;
    if (reasonCode) where.reasonCode = reasonCode;
    if (ticketId) where.ticketId = ticketId;

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { id: { contains: q, mode: 'insensitive' } },
        { ticketId: { contains: q, mode: 'insensitive' } },
        { reasonNote: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const total = await db.manualBalanceAdjustment.count({ where });
    const items = await db.manualBalanceAdjustment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: { select: { id: true, email: true, role: true, balance: true } },
        requester: { select: { id: true, email: true } },
        approver: { select: { id: true, email: true } },
        rejecter: { select: { id: true, email: true } }
      }
    });

    const paymentIds = items.map(item => item.paymentId).filter((id): id is string => Boolean(id));
    // tenant-isolation-ignore: admin cross-tenant payment enrichment by unique payment IDs
    const payments = paymentIds.length > 0
      ? await db.payment.findMany({
          where: { id: { in: paymentIds } },
          select: { id: true, gateway: true, gatewayId: true, status: true }
        })
      : [];
    const paymentMap = new Map(payments.map(p => [p.id, p]));

    const serializedItems = items.map(item => ({
      ...item,
      amount: item.amount.toString(),
      user: item.user ? { ...item.user, balance: item.user.balance.toString() } : null,
      payment: item.paymentId ? paymentMap.get(item.paymentId) || null : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      approvedAt: item.approvedAt ? item.approvedAt.toISOString() : null,
      rejectedAt: item.rejectedAt ? item.rejectedAt.toISOString() : null
    }));

    return {
      success: true,
      items: serializedItems,
      total,
      page,
      pageSize
    };
  });
}

export async function getBalanceAdjustmentStatsAction(formData: FormData) {
  return requireStaffPermission('balance_stats', 'view', async (staffUser) => {
    const policy = await getEffectiveBalancePolicy(staffUser.id);
    const canViewAll = staffUser.role === 'OWNER' || staffUser.role === 'ADMIN' || (policy?.canViewStats ?? false);

    const rawPayload = Object.fromEntries(formData.entries());
    const parsed = getAdjustmentStatsSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Некорректные параметры статистики" };
    }

    const { requestedBy, direction, reasonCode, status } = parsed.data;
    const where: Prisma.ManualBalanceAdjustmentWhereInput = {};
    if (!canViewAll) {
      where.requestedBy = staffUser.id;
    } else if (requestedBy) {
      where.requestedBy = requestedBy;
    }

    if (direction) where.direction = direction;
    if (reasonCode) where.reasonCode = reasonCode;
    if (status) where.status = status;

    const items = await db.manualBalanceAdjustment.findMany({
      where,
      select: {
        id: true,
        requestedBy: true,
        direction: true,
        amount: true,
        status: true,
        reasonCode: true,
        createdAt: true,
        requester: { select: { email: true } }
      }
    });

    let totalCount = 0;
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let executedCount = 0;

    let creditSum = BigInt(0);
    let debitSum = BigInt(0);

    const staffMap: Record<string, { email: string; count: number; creditSum: bigint; debitSum: bigint }> = {};
    const reasonMap: Record<string, { count: number; creditSum: bigint; debitSum: bigint }> = {};
    const dayMap: Record<string, { count: number; creditSum: bigint; debitSum: bigint }> = {};

    for (const item of items) {
      totalCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.PENDING_APPROVAL) pendingCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.APPROVED) approvedCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.REJECTED) rejectedCount++;
      if (item.status === BALANCE_ADJUSTMENT_STATUS.EXECUTED) executedCount++;

      if (item.status === BALANCE_ADJUSTMENT_STATUS.EXECUTED || item.status === BALANCE_ADJUSTMENT_STATUS.APPROVED) {
        if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) {
          creditSum += item.amount;
        } else {
          debitSum += item.amount;
        }
      }

      // Group by Staff
      const staffKey = item.requestedBy;
      const staffEmail = item.requester?.email || 'Unknown';
      if (!staffMap[staffKey]) {
        staffMap[staffKey] = { email: staffEmail, count: 0, creditSum: BigInt(0), debitSum: BigInt(0) };
      }
      staffMap[staffKey].count++;
      if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) staffMap[staffKey].creditSum += item.amount;
      else staffMap[staffKey].debitSum += item.amount;

      // Group by Reason
      const reasonKey = item.reasonCode;
      if (!reasonMap[reasonKey]) {
        reasonMap[reasonKey] = { count: 0, creditSum: BigInt(0), debitSum: BigInt(0) };
      }
      reasonMap[reasonKey].count++;
      if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) reasonMap[reasonKey].creditSum += item.amount;
      else reasonMap[reasonKey].debitSum += item.amount;

      // Group by Day
      const dayKey = item.createdAt.toISOString().slice(0, 10);
      if (!dayMap[dayKey]) {
        dayMap[dayKey] = { count: 0, creditSum: BigInt(0), debitSum: BigInt(0) };
      }
      dayMap[dayKey].count++;
      if (item.direction === BALANCE_ADJUSTMENT_DIRECTION.CREDIT) dayMap[dayKey].creditSum += item.amount;
      else dayMap[dayKey].debitSum += item.amount;
    }

    const netSum = creditSum - debitSum;

    return {
      success: true,
      summary: {
        totalCount,
        pendingCount,
        approvedCount,
        rejectedCount,
        executedCount,
        creditSum: creditSum.toString(),
        debitSum: debitSum.toString(),
        netSum: netSum.toString()
      },
      byStaff: Object.entries(staffMap).map(([id, val]) => ({
        id,
        email: val.email,
        count: val.count,
        creditSum: val.creditSum.toString(),
        debitSum: val.debitSum.toString()
      })),
      byReason: Object.entries(reasonMap).map(([code, val]) => ({
        code,
        count: val.count,
        creditSum: val.creditSum.toString(),
        debitSum: val.debitSum.toString()
      })),
      byDay: Object.entries(dayMap).map(([day, val]) => ({
        day,
        count: val.count,
        creditSum: val.creditSum.toString(),
        debitSum: val.debitSum.toString()
      })).sort((a, b) => b.day.localeCompare(a.day))
    };
  });
}
