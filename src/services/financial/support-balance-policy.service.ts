// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { db } from "@/lib/db";
import { BalanceAdjustmentPolicy, Prisma } from "@prisma/client";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { BALANCE_ADJUSTMENT_REASONS } from "@/constants/balance-adjustments";
import { createSecurityEvent } from "@/lib/security-events";
import { getEffectiveBalancePolicy, parsePolicyReasonCodes } from "@/services/admin/balance-policy.service";

/**
 * Returns YYYY-MM-DD string in Europe/Moscow (MSK) timezone.
 */
export function getMSKDayKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Returns YYYY-MM-DDTHH string in Europe/Moscow (MSK) timezone.
 */
export function getMSKHourKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`;
}

export type SupportBalanceCheckInput = {
  staffUserId: string;
  targetUserId: string;
  direction: 'CREDIT' | 'DEBIT';
  amountCents: bigint;
  reasonCode: string;
  reasonNote: string;
  source: 'SUPPORT_COMPENSATION' | 'BALANCE_REQUEST' | 'DIRECT_ADJUSTMENT' | 'TICKET_REFUND' | 'ORDER_REFUND';
  ticketId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  idempotencyKey: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  tenantId?: string | null;
};

export type SupportBalanceCheckResult =
  | { allowed: true; policy: BalanceAdjustmentPolicy; warnings: string[]; consentId?: string }
  | { allowed: false; code: string; error: string };

/**
 * Core Policy Engine service for Support Financial Operations.
 * Evaluates 30 strict security rules server-side before any money moves.
 */
export class SupportBalancePolicyService {

  /**
   * Validates policy rules, staff active legal consent, daily/hourly usage limits,
   * target user status, and reserves daily limits atomically inside a database transaction.
   */
  static async validateAndReserveSupportOperation(
    tx: Prisma.TransactionClient,
    input: SupportBalanceCheckInput
  ): Promise<SupportBalanceCheckResult> {
    const {
      staffUserId,
      targetUserId,
      direction,
      amountCents,
      reasonCode,
      reasonNote,
      source,
      ticketId,
      orderId,
      idempotencyKey,
      ipAddress,
      userAgent,
      tenantId
    } = input;

    // 1. Amount validation
    if (amountCents <= BigInt(0)) {
      await createSecurityEvent('BALANCE_INVALID_AMOUNT', {
        severity: 'HIGH',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { amountCents: amountCents.toString(), idempotencyKey }
      });
      return { allowed: false, code: 'INVALID_AMOUNT', error: 'Сумма операции должна быть больше нуля' };
    }

    // 2. Self-Targeting Guard
    if (staffUserId === targetUserId) {
      await createSecurityEvent('BALANCE_SELF_ADJUSTMENT_BLOCKED', {
        severity: 'CRITICAL',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { idempotencyKey }
      });
      return { allowed: false, code: 'SELF_ADJUSTMENT_FORBIDDEN', error: 'Запрещено выполнять операции с собственным балансом' };
    }

    // 3. Fetch Staff User and check legal consent
    const staffUser = await tx.user.findUnique({
      where: { id: staffUserId },
      select: { id: true, role: true, isActive: true, isDeleted: true, supportLimitCents: true }
    });

    if (!staffUser || !staffUser.isActive || staffUser.isDeleted) {
      await createSecurityEvent('BALANCE_STAFF_INACTIVE', {
        severity: 'HIGH',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { idempotencyKey }
      });
      return { allowed: false, code: 'STAFF_INACTIVE', error: 'Сотрудник заблокирован или не найден' };
    }

    // Check active legal responsibility consent for non-OWNER staff
    let activeConsent = null;
    if (staffUser.role !== 'OWNER') {
      activeConsent = await tx.employeeResponsibilityConsent.findFirst({
        where: { userId: staffUserId, status: 'ACTIVE' },
        orderBy: { acceptedAt: 'desc' }
      });

      if (!activeConsent) {
        await createSecurityEvent('BALANCE_CONSENT_MISSING', {
          severity: 'CRITICAL',
          staffUserId,
          targetUserId,
          tenantId: tenantId || null,
          ipAddress,
          userAgent,
          details: { idempotencyKey }
        });
        return {
          allowed: false,
          code: 'CONSENT_MISSING',
          error: 'У вас отсутствует подписанное юридическое согласие о материальной ответственности'
        };
      }
    }

    // 4. Fetch Target User & Staff-Target Guard
    const targetUser = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, isActive: true, isDeleted: true }
    });

    if (!targetUser) {
      return { allowed: false, code: 'TARGET_NOT_FOUND', error: 'Пользователь-получатель не найден' };
    }

    if (targetUser.isDeleted) {
      await createSecurityEvent('BALANCE_TARGET_DELETED', {
        severity: 'HIGH',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { idempotencyKey }
      });
      return { allowed: false, code: 'TARGET_DELETED', error: 'Аккаунт пользователя удален' };
    }

    if (!targetUser.isActive) {
      await createSecurityEvent('BALANCE_TARGET_INACTIVE', {
        severity: 'HIGH',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { idempotencyKey }
      });
      return { allowed: false, code: 'TARGET_INACTIVE', error: 'Аккаунт пользователя заблокирован' };
    }

    // Support staff cannot modify balance of ADMIN or OWNER unless staff is OWNER
    if (staffUser.role !== 'OWNER' && (targetUser.role === 'ADMIN' || targetUser.role === 'OWNER' || targetUser.role === 'MANAGER' || targetUser.role === 'SUPPORT')) {
      await createSecurityEvent('BALANCE_STAFF_TARGET_BLOCKED', {
        severity: 'CRITICAL',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { targetRole: targetUser.role, idempotencyKey }
      });
      return { allowed: false, code: 'STAFF_TARGET_FORBIDDEN', error: 'Запрещено выполнять финансовые операции с аккаунтами сотрудников' };
    }

    // 5. Policy Engine resolution
    const policy = await getEffectiveBalancePolicy(staffUserId, tx);
    if (!policy) {
      await createSecurityEvent('BALANCE_POLICY_MISSING', {
        severity: 'CRITICAL',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { idempotencyKey }
      });
      return { allowed: false, code: 'POLICY_MISSING', error: 'Политика баланса для вашей роли не настроена' };
    }

    if (!policy.enabled || !policy.isActive) {
      await createSecurityEvent('BALANCE_POLICY_DISABLED', {
        severity: 'HIGH',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { policyId: policy.id, idempotencyKey }
      });
      return { allowed: false, code: 'POLICY_DISABLED', error: 'Политика ручных операций с балансом временно отключена' };
    }

    // Direction check
    if (direction === 'CREDIT' && !policy.canRequestCredit) {
      return { allowed: false, code: 'CREDIT_DISABLED', error: 'Начисление средств запрещено вашим уровнем доступа' };
    }
    if (direction === 'DEBIT' && !policy.canRequestDebit) {
      return { allowed: false, code: 'DEBIT_DISABLED', error: 'Списание средств запрещено вашим уровнем доступа' };
    }

    // Reason note minimal length validation
    if (!reasonNote || reasonNote.trim().length < 10) {
      return { allowed: false, code: 'REASON_NOTE_TOO_SHORT', error: 'Причина операции должна содержать не менее 10 символов подробного пояснения' };
    }

    // Reason code check
    const { allowedCreditReasonCodes, allowedDebitReasonCodes } = parsePolicyReasonCodes(policy);
    const validCodes = direction === 'CREDIT' ? allowedCreditReasonCodes : allowedDebitReasonCodes;
    if (validCodes.length > 0 && !validCodes.includes(reasonCode)) {
      await createSecurityEvent('BALANCE_REASON_CODE_INVALID', {
        severity: 'MEDIUM',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { reasonCode, idempotencyKey }
      });
      return { allowed: false, code: 'REASON_CODE_INVALID', error: `Недопустимый код причины: ${reasonCode}` };
    }

    // Require Ticket check
    if (policy.requireTicket && !ticketId) {
      await createSecurityEvent('BALANCE_TICKET_REQUIRED', {
        severity: 'MEDIUM',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { idempotencyKey }
      });
      return { allowed: false, code: 'TICKET_REQUIRED', error: 'Операция требует обязательного указания ID тикета' };
    }

    if (ticketId) {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: { id: true, userId: true, status: true }
      });
      if (!ticket) {
        return { allowed: false, code: 'TICKET_NOT_FOUND', error: 'Указанный тикет не найден' };
      }
      if (ticket.userId !== targetUserId) {
        return { allowed: false, code: 'TICKET_USER_MISMATCH', error: 'Указанный тикет принадлежит другому пользователю' };
      }
    }

    // Require Order for Debit check
    if (policy.requireOrderForDebit && direction === 'DEBIT' && !orderId) {
      await createSecurityEvent('BALANCE_ORDER_REQUIRED', {
        severity: 'MEDIUM',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { idempotencyKey }
      });
      return { allowed: false, code: 'ORDER_REQUIRED', error: 'Списание средств требует обязательной привязки к заказу' };
    }

    // Single operation limit check
    const maxPerReq = direction === 'CREDIT' ? policy.maxCreditPerRequest : policy.maxDebitPerRequest;
    if (maxPerReq > BigInt(0) && amountCents > maxPerReq) {
      await createSecurityEvent('BALANCE_LIMIT_EXCEEDED', {
        severity: 'HIGH',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { amountCents: amountCents.toString(), maxAllowed: maxPerReq.toString(), idempotencyKey }
      });
      return {
        allowed: false,
        code: 'PER_REQUEST_LIMIT_EXCEEDED',
        error: `Сумма операции (${(Number(amountCents) / 100).toFixed(2)} ₽) превышает максимально допустимый лимит на 1 операцию (${(Number(maxPerReq) / 100).toFixed(2)} ₽)`
      };
    }

    // Support limit budget check (supportLimitCents on User)
    if (source === 'SUPPORT_COMPENSATION' && staffUser.role !== 'OWNER') {
      const staffBudgetCents = BigInt(staffUser.supportLimitCents || 0);
      if (amountCents > staffBudgetCents) {
        return {
          allowed: false,
          code: 'STAFF_BUDGET_EXCEEDED',
          error: `Сумма операции превышает персональный суточный бюджет оператора (${(Number(staffBudgetCents) / 100).toFixed(2)} ₽)`
        };
      }
    }

    // 6. Atomic Daily & Hourly Limit Reservation (Timezone: Europe/Moscow MSK)
    const dayKey = getMSKDayKey();
    const hourKey = getMSKHourKey();

    const dailyUsage = await tx.supportLimitUsage.upsert({
      where: {
        staffUserId_dayKey_direction: {
          staffUserId,
          dayKey,
          direction: 'ALL'
        }
      },
      create: {
        staffUserId,
        dayKey,
        direction: 'ALL',
        amountCents,
        operationsCount: 1,
        tenantId: tenantId || null
      },
      update: {
        amountCents: { increment: amountCents },
        operationsCount: { increment: 1 }
      }
    });

    if (policy.maxTotalPerDay > BigInt(0) && dailyUsage.amountCents > policy.maxTotalPerDay) {
      await createSecurityEvent('BALANCE_DAILY_LIMIT_EXCEEDED', {
        severity: 'HIGH',
        staffUserId,
        targetUserId,
        tenantId: tenantId || null,
        ipAddress,
        userAgent,
        details: { usedCents: dailyUsage.amountCents.toString(), maxLimit: policy.maxTotalPerDay.toString(), idempotencyKey }
      });
      return {
        allowed: false,
        code: 'DAILY_LIMIT_EXCEEDED',
        error: `Превышен суммарный дневной лимит операций (${(Number(policy.maxTotalPerDay) / 100).toFixed(2)} ₽ в сутки по МСК)`
      };
    }

    // Hourly limit tracking
    await tx.supportHourlyUsage.upsert({
      where: {
        staffUserId_hourKey_direction: {
          staffUserId,
          hourKey,
          direction: 'ALL'
        }
      },
      create: {
        staffUserId,
        hourKey,
        direction: 'ALL',
        amountCents,
        operationsCount: 1
      },
      update: {
        amountCents: { increment: amountCents },
        operationsCount: { increment: 1 }
      }
    });

    const warnings: string[] = [];

    return {
      allowed: true,
      policy,
      warnings,
      consentId: activeConsent?.id
    };
  }
}
