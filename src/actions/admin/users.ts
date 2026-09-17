'use server';

import { db } from '@/lib/db';
import { adminUserService } from '@/services/admin/user.service';
import { escrowService } from '@/services/admin/escrow.service';
import { WalletOps } from '@/services/financial/wallet-ops';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { auditAdmin, auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { SignJWT } from 'jose';
import { updateBalanceSchema, userIdSchema } from '@/validators/admin.validators';
import { requireStaffPermission } from '@/lib/server/rbac';
import { getClientIp } from '@/utils/ip';
import { z } from 'zod';

import { getEncodedKey, SESSION_COOKIE_NAME } from '@/lib/session';
import { resolveContourFromHost } from '@/lib/tenant-resolver-edge';
import { SupportBalancePolicyService } from '@/services/financial/support-balance-policy.service';
import { sendAdminAlert } from '@/lib/notifications';

export async function updateBalanceAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const payload = Object.fromEntries(formData.entries());
    const parsed = updateBalanceSchema.safeParse(payload);
    
    if (!parsed.success) {
      return { success: false as const, error: 'userId, amount (копейки) и reason обязательны' };
    }

    const { userId, amount, reason } = parsed.data;

    // 1. SECURITY GUARD: Block self-balance modification (only OWNER permitted with audit warning)
    if (userId === admin.id && admin.role !== 'OWNER') {
      console.warn(`[SECURITY] Blocked self-balance modification attempt by ${admin.id} (${admin.role})`);
      return { success: false as const, error: 'Запрещено изменять собственный баланс' };
    }

    // 2. Staff-Targeting Guard: Non-OWNER staff cannot adjust balance of other staff members
    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, balance: true, tenantId: true } });
    if (!targetUser) {
      return { success: false as const, error: 'Пользователь не найден' };
    }

    if (admin.role !== 'OWNER' && (targetUser.role === 'OWNER' || targetUser.role === 'ADMIN' || targetUser.role === 'MANAGER' || targetUser.role === 'SUPPORT')) {
      console.warn(`[SECURITY] Non-owner ${admin.id} (${admin.role}) attempted balance adjustment on staff target ${targetUser.id} (${targetUser.role})`);
      return { success: false as const, error: 'Только OWNER может изменять баланс других сотрудников' };
    }

    // Overdraft Protection: prevent debiting more than available balance
    if (amount < 0 && targetUser.balance < BigInt(Math.abs(amount))) {
      return { 
        success: false as const, 
        error: `Недостаточно средств на балансе клиента. Доступно: ${(Number(targetUser.balance) / 100).toFixed(2)} ₽` 
      };
    }

    // Poka-Yoke Server Validation: Negative amount cannot have Goodwill/Bonus/Compensation reason
    if (amount < 0) {
      const lowerReason = reason.toLowerCase();
      if (lowerReason.includes('компенсация') || lowerReason.includes('доброй воли') || lowerReason.includes('бонус')) {
        return {
          success: false as const,
          error: 'Недопустимая причина для списания. «Компенсация» и «Бонус» применяются только для начисления средств (+) клиенту.'
        };
      }
    }

    const ipAddress = await getClientIp('unknown');
    const reqHeaders = await headers();
    const userAgent = reqHeaders.get('user-agent') || 'Unknown';
    
    const clientKey = (formData.get('idempotencyKey') as string)?.trim();
    const idempotencyKey = clientKey || `direct-adjust-${userId}-${amount}-${Date.now()}`;

    // Anti-Double-Click & Idempotency Lock
    if (clientKey) {
      const existingAdj = await db.manualBalanceAdjustment.findFirst({
        where: { idempotencyKey: clientKey }
      });
      if (existingAdj) {
        return { success: true as const, message: 'Операция уже зарегистрирована (защита от двойного клика)' };
      }
      const existingAction = await db.supportFinancialAction.findFirst({
        where: { idempotencyKey: clientKey }
      });
      if (existingAction) {
        return { success: true as const, message: 'Операция уже выполнена (защита от двойного клика)' };
      }
      const existingLedger = await db.ledgerEntry.findFirst({
        where: {
          idempotencyKey: clientKey,
          ...(targetUser.tenantId ? { tenantId: targetUser.tenantId } : {})
        }
      });
      if (existingLedger) {
        return { success: true as const, message: 'Операция уже выполнена (защита от двойного клика)' };
      }
    }

    let policyCheck: Awaited<ReturnType<typeof SupportBalancePolicyService.validateAndReserveSupportOperation>> | null = null;
    if (admin.role !== 'OWNER') {
      policyCheck = await db.$transaction(async (tx) => {
        return SupportBalancePolicyService.validateAndReserveSupportOperation(tx, {
          staffUserId: admin.id,
          targetUserId: userId,
          direction: amount >= 0 ? 'CREDIT' : 'DEBIT',
          amountCents: BigInt(Math.abs(amount)),
          reasonCode: amount >= 0 ? 'GOODWILL_LOYALTY' : 'DIRECT_DEBIT',
          reasonNote: reason.trim(),
          source: 'DIRECT_ADJUSTMENT',
          idempotencyKey,
          ipAddress,
          userAgent
        });
      });

      if (!policyCheck.allowed) {
        // If exceeding limit, auto-create a ManualBalanceAdjustment pending approval
        const adj = await db.manualBalanceAdjustment.create({
          data: {
            userId,
            requestedBy: admin.id,
            direction: amount >= 0 ? 'CREDIT' : 'DEBIT',
            amount: BigInt(Math.abs(amount)),
            reasonCode: amount >= 0 ? 'GOODWILL_LOYALTY' : 'DIRECT_DEBIT',
            reasonNote: reason.trim(),
            status: 'PENDING_APPROVAL',
            idempotencyKey,
          }
        });

        await auditAdminAwaitable({
          adminId: admin.id,
          adminEmail: admin.email,
          action: 'BALANCE_ADJUSTMENT_REQUESTED',
          target: adj.id,
          targetType: 'ManualBalanceAdjustment',
          newValue: { amountCents: amount, reason: reason.trim(), status: 'PENDING_APPROVAL' },
          ipAddress
        });

        revalidatePath(`/admin/clients/${userId}`);
        revalidatePath('/admin/clients');
        return { 
          success: true as const, 
          status: 'PENDING_APPROVAL', 
          message: `Сумма превышает суточный лимит. Создана заявка #${adj.id.slice(-6)} на согласование администратору.` 
        };
      }
    }

    const escrowResult = await escrowService.evaluateBalanceAdjustment(
      userId,
      amount,
      reason.trim(),
      admin,
      idempotencyKey
    );

    // If policyCheck was executed, create a SupportFinancialAction record
    if (policyCheck && policyCheck.allowed) {
      const ledgerEntry = await db.ledgerEntry.findFirst({
        where: {
          adminId: admin.id,
          userId: userId,
          ...(targetUser.tenantId ? { tenantId: targetUser.tenantId } : {})
        },
        orderBy: { createdAt: 'desc' }
      });

      const isFlagged = Math.abs(amount) >= 500000 || policyCheck.warnings.length > 0;
      const reviewStatus = isFlagged ? 'FLAGGED' : 'PENDING';

      await db.supportFinancialAction.create({
        data: {
          staffUserId: admin.id,
          targetUserId: userId,
          direction: amount >= 0 ? 'CREDIT' : 'DEBIT',
          source: 'DIRECT_ADJUSTMENT',
          amountCents: BigInt(Math.abs(amount)),
          reasonCode: amount >= 0 ? 'GOODWILL_LOYALTY' : 'DIRECT_DEBIT',
          reasonNote: reason.trim(),
          policyId: policyCheck.policy.id,
          policySnapshot: JSON.parse(JSON.stringify(policyCheck.policy, (_, v) => typeof v === 'bigint' ? v.toString() : v)),
          idempotencyKey,
          status: escrowResult.status === 'APPROVED' ? 'EXECUTED' : 'QUARANTINE',
          ledgerEntryId: ledgerEntry?.id || null,
          consentId: policyCheck.consentId || null,
          reviewStatus,
          ipAddress,
          userAgent
        }
      });
    }

    // SD-13 SECURITY FIX: Await audit for balance modification (financial operation)
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_BALANCE_REQUEST',
      target: userId,
      targetType: 'USER',
      newValue: { amountCents: amount, reason: reason.trim(), status: escrowResult.status },
      ipAddress
    });

    const rubAmount = (Number(amount) / 100).toFixed(2);
    const isCredit = amount >= 0;
    const isBigAmount = Math.abs(amount) >= 100000; // >= 1000 RUB
    sendAdminAlert(
      `${isBigAmount ? '🚨' : '💳'} <b>РУЧНАЯ КОРРЕКТИРОВКА БАЛАНСА КЛИЕНТА</b>\n` +
      `<b>Сотрудник:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Клиент ID:</b> <code>${userId}</code>\n` +
      `<b>Операция:</b> ${isCredit ? '➕ Начисление' : '➖ Списание'} <b>${rubAmount} ₽</b>\n` +
      `<b>Статус:</b> <code>${escrowResult.status}</code>\n` +
      `<b>Причина:</b> <i>${reason.trim()}</i>`,
      isBigAmount ? 'CRITICAL' : 'INFO'
    );

    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath('/admin/clients');
    return { success: true as const, status: escrowResult.status };
  });
}

/**
 * Two-Step Refund Gateway:
 * Instantly debits user balance in the dashboard (to prevent double-spend),
 * and creates a pending payout request for the financier to execute in YooKassa.
 */
export async function requestCardRefundAction(formData: FormData) {
  return requireStaffPermission('balance_requests', 'edit', async (admin) => {
    const userId = formData.get('userId') as string;
    const paymentId = formData.get('paymentId') as string;
    const amountKopecksRaw = formData.get('amountKopecks') as string;
    const reason = (formData.get('reason') as string) || 'Возврат на карту по запросу клиента';

    if (!userId || !paymentId || !amountKopecksRaw) {
      return { success: false as const, error: 'Все поля обязательны' };
    }

    const amountKopecks = BigInt(amountKopecksRaw);
    if (amountKopecks <= BigInt(0)) {
      return { success: false as const, error: 'Сумма возврата должна быть больше 0' };
    }

    // 1. Verify target payment
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment || payment.userId !== userId) {
      return { success: false as const, error: 'Платеж не найден или не принадлежит пользователю' };
    }

    if (payment.status !== 'SUCCEEDED') {
      return { success: false as const, error: 'Возврат возможен только для успешно оплаченных платежей' };
    }

    const existingRefunds = await db.manualBalanceAdjustment.findMany({
      where: {
        paymentId: payment.id,
        reasonCode: 'REFUND_TO_CARD',
        status: { in: ['PENDING_APPROVAL', 'APPROVED', 'EXECUTED'] }
      }
    });
    const alreadyRefundedOrPendingKopecks = existingRefunds.reduce((acc, r) => acc + r.amount, BigInt(0));
    const availableForRefundKopecks = payment.amount - alreadyRefundedOrPendingKopecks;

    if (amountKopecks > availableForRefundKopecks) {
      return { 
        success: false as const, 
        error: `Сумма возврата превышает доступный остаток по платежу (${(Number(availableForRefundKopecks) / 100).toFixed(2)} ₽)` 
      };
    }

    // 2. Verify target user balance
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, balance: true, email: true },
    });

    if (user.balance < amountKopecks) {
      return { 
        success: false as const, 
        error: `Недостаточно средств на балансе клиента. Доступно: ${(Number(user.balance) / 100).toFixed(2)} ₽` 
      };
    }

    const ipAddress = await getClientIp('unknown');
    const clientKey = (formData.get('idempotencyKey') as string)?.trim();
    const idempotencyKey = clientKey || `card-refund-${userId}-${paymentId}-${Date.now()}`;

    if (clientKey) {
      const existingAdj = await db.manualBalanceAdjustment.findFirst({
        where: { idempotencyKey: clientKey }
      });
      if (existingAdj) {
        return { success: true as const, message: 'Заявка на возврат уже создана (защита от двойного клика)' };
      }
    }

    const gwName = (payment.gateway || 'эквайринг').toUpperCase();
    const isAutomatedGateway = payment.gateway.toLowerCase() === 'yookassa';

    // 3. Atomically debit user balance and create financier payout request
    const adjustment = await db.$transaction(async (tx) => {
      // Step A: Debit balance immediately so client cannot spend it (adminAdjust does not inflate totalSpent)
      const adjustResult = await WalletOps.adminAdjust(
        tx,
        userId,
        -amountKopecks,
        `REFUND_TO_CARD: Запрос на возврат через ${gwName} (${payment.gatewayId || payment.id})`,
        { idempotencyKey, adminId: admin.id, transactionType: 'REFUND' }
      );

      // Step B: Create adjustment / refund ticket for financier
      const adj = await tx.manualBalanceAdjustment.create({
        data: {
          userId,
          requestedBy: admin.id,
          direction: 'DEBIT',
          amount: amountKopecks,
          reasonCode: 'REFUND_TO_CARD',
          reasonNote: reason.trim(),
          paymentId: payment.id,
          status: 'PENDING_APPROVAL',
          idempotencyKey,
        },
      });

      return { adj, newBalance: adjustResult.balance };
    });

    // Step C: Audit log
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CARD_REFUND_REQUESTED',
      target: adjustment.adj.id,
      targetType: 'ManualBalanceAdjustment',
      newValue: {
        userId,
        paymentId,
        gateway: payment.gateway,
        gatewayId: payment.gatewayId,
        amountKopecks: amountKopecks.toString(),
        reason: reason.trim(),
        isAutomatedGateway,
      },
      ipAddress,
    });

    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath('/admin/clients');
    revalidatePath('/admin/finance/balance-requests');

    return { 
      success: true as const, 
      message: isAutomatedGateway
        ? `Баланс клиента списан на ${(Number(amountKopecks) / 100).toFixed(2)} ₽. Заявка на возврат через ЮKassa передана финансисту.`
        : `Баланс клиента списан на ${(Number(amountKopecks) / 100).toFixed(2)} ₽. Заявка создана. Внимание: шлюз ${gwName} требует ручного оформления возврата в личном кабинете эквайринга после утверждения.`
    };
  });
}

/**
 * Update client API configuration and company accounting fields.
 */
export async function updateUserApiAction(formData: FormData) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const userId = formData.get('userId') as string;
    const isApiEnabled = formData.get('isApiEnabled') === 'true';
    const prioritySupport = formData.get('prioritySupport') === 'true';
    const companyName = (formData.get('companyName') as string)?.trim() || null;
    const inn = (formData.get('inn') as string)?.trim() || null;
    const kpp = (formData.get('kpp') as string)?.trim() || null;
    const legalAddress = (formData.get('legalAddress') as string)?.trim() || null;
    const webhookUrl = (formData.get('webhookUrl') as string)?.trim() || null;

    if (!userId) {
      return { success: false as const, error: 'ID пользователя обязателен' };
    }

    await db.$transaction(async (tx) => {
      // 1. Update user fields
      await tx.user.update({
        where: { id: userId },
        data: {
          companyName,
          inn,
          kpp,
          legalAddress,
        },
      });

      // 2. Upsert API config
      await tx.apiConfig.upsert({
        where: { userId },
        create: {
          userId,
          isApiEnabled,
          prioritySupport,
          webhookUrl,
        },
        update: {
          isApiEnabled,
          prioritySupport,
          webhookUrl,
        },
      });
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UPDATE_CLIENT_API',
      target: userId,
      targetType: 'USER',
      newValue: { isApiEnabled, prioritySupport, companyName, inn, kpp, webhookUrl },
      ipAddress,
    });

    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath('/admin/clients');
    return { success: true as const, message: 'API реквизиты успешно сохранены' };
  });
}

export async function banUserAction(formData: FormData) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const parsed = userIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing userId' };
    
    const { userId } = parsed.data;

    const ipAddress = await getClientIp('unknown');

    await adminUserService.banUser(userId, {
      id: admin.id,
      email: admin.email,
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BAN_USER',
      target: userId,
      targetType: 'USER',
      ipAddress
    });

    sendAdminAlert(
      `🚫 <b>ПОЛЬЗОВАТЕЛЬ ЗАБЛОКИРОВАН (БАН)</b>\n` +
      `<b>Сотрудник:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Клиент ID:</b> <code>${userId}</code>`,
      'WARNING'
    );

    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

export async function unbanUserAction(formData: FormData) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const parsed = userIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing userId' };
    
    const { userId } = parsed.data;

    const ipAddress = await getClientIp('unknown');

    await adminUserService.unbanUser(userId, {
      id: admin.id,
      email: admin.email,
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'UNBAN_USER',
      target: userId,
      targetType: 'USER',
      ipAddress
    });

    sendAdminAlert(
      `✅ <b>ПОЛЬЗОВАТЕЛЬ РАЗБЛОКИРОВАН</b>\n` +
      `<b>Сотрудник:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Клиент ID:</b> <code>${userId}</code>`,
      'INFO'
    );

    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

/**
 * Login-As: creates a temporary session for the target user.
 * Critical security action — restricted to OWNER/ADMIN only.
 */
export async function loginAsAction(formData: FormData) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const parsed = userIdSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false as const, error: 'Missing userId' };
    
    const { userId } = parsed.data;

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Forbidden: Only OWNER and ADMIN can login as user' };
    }

    const targetUser = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (admin.role !== 'OWNER' && (targetUser.role === 'OWNER' || targetUser.role === 'ADMIN')) {
      return { success: false as const, error: 'Запрещено входить от имени администраторов и владельцев' };
    }
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

    // SD-07 SECURITY FIX: Record impersonation origin for audit trail integrity.
    // Without this, impersonated sessions are indistinguishable from real user sessions.
    const impersonationSession = await db.session.create({
      data: {
        userId: targetUser.id,
        expiresAt,
        impersonatedBy: admin.id,
      },
    });

    let host = '';
    try {
      const reqHeaders = await headers();
      host = reqHeaders.get('host') || reqHeaders.get('x-forwarded-host') || '';
    } catch {}

    const contour = resolveContourFromHost(host);
    const tenantId = targetUser.tenantId || 'smmplan';

    const sessionToken = await new SignJWT({
      sessionId: impersonationSession.id,
      userId: targetUser.id,
      impersonatedBy: admin.id,
      contour,
      tenantId,
      sessionVer: 1,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getEncodedKey());

    (await cookies()).set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
      sameSite: 'lax',
      path: '/',
    });

    const ipAddress = await getClientIp('unknown');

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'LOGIN_AS_USER',
      target: userId,
      targetType: 'USER',
      newValue: { targetEmail: targetUser.email, sessionExpires: expiresAt.toISOString(), impersonatedBy: admin.id },
      ipAddress
    });

    sendAdminAlert(
      `🕵️‍♂️ <b>ВХОД ОТ ИМЕНИ ПОЛЬЗОВАТЕЛЯ (ИМПЕРСОНАЦИЯ)</b>\n` +
      `<b>Сотрудник:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Клиент:</b> ${targetUser.email} (ID: <code>${userId}</code>)\n` +
      `⚠️ <i>Создана временная сессия сотрудника под аккаунтом клиента.</i>`,
      'WARNING'
    );

    revalidatePath('/dashboard/new-order');
    return { success: true as const };
  });
}

const quarantineActionSchema = z.object({
  entryId: z.string().min(1, 'Missing entryId')
});

export async function approveQuarantineAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = quarantineActionSchema.safeParse({ entryId: formData.get('entryId') });
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0]?.message || 'Missing entryId' };
    const { entryId } = parsed.data;

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Админ могут одобрять карантин' };
    }

    const ipAddress = await getClientIp('unknown');

    await escrowService.resolveQuarantine(entryId, 'APPROVE', {
      id: admin.id,
      email: admin.email
    }, ipAddress);

    revalidatePath('/admin/finance');
    return { success: true as const };
  });
}

export async function rejectQuarantineAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = quarantineActionSchema.safeParse({ entryId: formData.get('entryId') });
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0]?.message || 'Missing entryId' };
    const { entryId } = parsed.data;

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Админ могут отклонять карантин' };
    }

    const ipAddress = await getClientIp('unknown');

    await escrowService.resolveQuarantine(entryId, 'REJECT', {
      id: admin.id,
      email: admin.email
    }, ipAddress);

    revalidatePath('/admin/finance');
    return { success: true as const };
  });
}

export async function adminChangeUserPasswordAction(userId: string, newPass: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    if (!userId || !newPass || newPass.length < 8) {
      return { success: false as const, error: 'Пароль должен содержать минимум 8 символов' };
    }

    const { hashPassword } = await import('@/lib/auth/password');
    const hashed = await hashPassword(newPass);

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    // Hierarchy Guard: Protecting OWNER & Staff accounts from unauthorized password resets
    if (targetUser.role === 'OWNER' && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Запрещено сбрасывать пароль Владельца платформы' };
    }
    if (['ADMIN', 'MANAGER', 'SUPPORT', 'OPERATOR'].includes(targetUser.role) && !['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Администратор могут сбрасывать пароли сотрудников' };
    }

    await db.user.update({
      where: { id: userId },
      data: { 
        passwordHash: hashed,
        // Verify email automatically: admin-set password implies identity is confirmed
        isEmailVerified: true,
        isActive: true,
      }
    });

    // Сброс всех сессий пользователя ради безопасности
    await db.session.deleteMany({ where: { userId } });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_CHANGE_USER_PASSWORD',
      target: userId,
      targetType: 'USER',
      newValue: { targetEmail: targetUser.email },
      ipAddress
    });

    sendAdminAlert(
      `🔑 <b>АДМИНИСТРАТИВНЫЙ СБРОС ПАРОЛЯ</b>\n` +
      `<b>Сотрудник:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Пользователь:</b> ${targetUser.email} (ID: <code>${userId}</code>)\n` +
      `⚠️ <i>Все активные сессии пользователя аннулированы.</i>`,
      'WARNING'
    );

    revalidatePath(`/admin/clients/${userId}`);
    return { success: true as const };
  });
}

const deleteUserSchema = z.object({
  userId: z.string().min(1, 'Missing userId')
});

export async function adminDeleteUserAction(formData: FormData) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const parsed = deleteUserSchema.safeParse({ userId: formData.get('userId') });
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0]?.message || 'Missing userId' };
    const { userId } = parsed.data;

    if (!['OWNER', 'ADMIN'].includes(admin.role)) {
      return { success: false as const, error: 'Только Владелец и Админ могут удалять профили' };
    }

    if (userId === admin.id) {
      return { success: false as const, error: 'Вы не можете удалить собственный профиль' };
    }

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    // Hierarchy Guard: OWNER cannot be deleted, ADMIN can only be deleted by OWNER
    if (targetUser.role === 'OWNER') {
      return { success: false as const, error: 'Категорически запрещено удалять аккаунт Владельца платформы' };
    }
    if (targetUser.role === 'ADMIN' && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может удалять аккаунты Администраторов' };
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          email: `deleted_${userId}@smmplan.local`,
          telegramId: null,
          phoneHash: null,
          apiKeyHash: null,
          referralCode: null,
          companyName: null,
          inn: null,
          kpp: null,
          legalAddress: null,
          passwordHash: null,
          referredById: null,
          isDeleted: true,
          isActive: false,
          role: 'BANNED'
        }
      });
      await tx.session.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_DELETE_USER',
      target: userId,
      targetType: 'USER',
      oldValue: { email: targetUser.email },
      newValue: { isDeleted: true },
      ipAddress
    });

    sendAdminAlert(
      `🚨 <b>[P0 CRITICAL] ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ УДАЛЁН</b>\n` +
      `<b>Сотрудник:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Пользователь:</b> ${targetUser.email} (ID: <code>${userId}</code>)\n` +
      `⚠️ <i>Аккаунт деактивирован, данные замаскированы, сессии закрыты.</i>`,
      'CRITICAL'
    );

    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

const changeEmailSchema = z.object({
  userId: z.string().min(1, 'Missing userId'),
  newEmail: z.string().email('Некорректный формат email'),
  reason: z.string().min(3, 'Укажите причину смены (мин. 3 символа)')
});

/**
 * Изменение email пользователя (исправление опечаток или перенос)
 */
export async function adminChangeUserEmailAction(userId: string, newEmail: string, reason: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const parsed = changeEmailSchema.safeParse({ userId, newEmail, reason });
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Ошибка валидации' };
    }

    const cleanNewEmail = parsed.data.newEmail.toLowerCase().trim();

    const targetUser = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, balance: true, tenantId: true, role: true }
    });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    // Hierarchy Guard: Protecting OWNER & Staff accounts from unauthorized email changes
    if (targetUser.role === 'OWNER' && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Запрещено изменять email Владельца платформы' };
    }
    if (['ADMIN', 'MANAGER', 'SUPPORT', 'OPERATOR'].includes(targetUser.role) && admin.role !== 'OWNER') {
      return { success: false as const, error: 'Только Владелец может изменять email сотрудников' };
    }

    // Проверка уникальности
    const existing = await db.user.findFirst({
      where: { email: cleanNewEmail, tenantId: targetUser.tenantId }
    });
    if (existing && existing.id !== parsed.data.userId) {
      return { success: false as const, error: 'Пользователь с таким email уже существует' };
    }

    // SD-04 SECURITY GUARD: Require high-privilege confirmation for email change on accounts with balance > 0
    // SUPPORT is allowed — they must provide a mandatory reason, and a Telegram WARNING alert is always sent.
    if (targetUser.balance > BigInt(0)) {
      if (admin.role !== 'OWNER' && admin.role !== 'ADMIN' && admin.role !== 'SUPPORT') {
        return { 
          success: false as const, 
          error: 'Смена email для аккаунтов с положительным балансом разрешена только Администраторам и Саппорту' 
        };
      }
    }

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: parsed.data.userId },
        data: { email: cleanNewEmail }
      });
      // Сброс старых сессий ради безопасности
      await tx.session.deleteMany({ where: { userId: parsed.data.userId } });
      await tx.authToken.deleteMany({ where: { userId: parsed.data.userId } });
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_CHANGE_USER_EMAIL',
      target: parsed.data.userId,
      targetType: 'USER',
      oldValue: { email: targetUser.email },
      newValue: { email: cleanNewEmail, reason: parsed.data.reason.trim() },
      ipAddress
    });

    sendAdminAlert(
      `📧 <b>АДМИНИСТРАТИВНАЯ СМЕНА EMAIL КЛИЕНТА</b>\n` +
      `<b>Сотрудник:</b> ${admin.email} (IP: ${ipAddress || 'unknown'})\n` +
      `<b>Клиент ID:</b> <code>${parsed.data.userId}</code>\n` +
      `<b>Старый Email:</b> ${targetUser.email}\n` +
      `<b>Новый Email:</b> ${cleanNewEmail}\n` +
      `<b>Причина:</b> <i>${parsed.data.reason.trim()}</i>`,
      'WARNING'
    );

    revalidatePath(`/admin/clients/${parsed.data.userId}`);
    revalidatePath('/admin/clients');
    return { success: true as const, message: `Email успешно изменен на ${cleanNewEmail}` };
  });
}

/**
 * Генерация одноразовой защищенной ссылки прямого входа (Magic Link) на 15 минут
 */
export async function adminGenerateMagicLinkAction(userId: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    if (!userId) return { success: false as const, error: 'Missing userId' };

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, isActive: true, isDeleted: true }
    });

    if (!targetUser || targetUser.isDeleted || !targetUser.isActive) {
      return { success: false as const, error: 'Пользователь не найден или заблокирован' };
    }

    const crypto = await import('crypto');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 минут

    await db.authToken.create({
      data: {
        token: hashedToken,
        userId: targetUser.id,
        expiresAt,
        used: false
      }
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_GENERATE_MAGIC_LINK',
      target: targetUser.id,
      targetType: 'USER',
      newValue: { targetEmail: targetUser.email, expiresAt },
      ipAddress
    });

    const magicUrl = `/api/auth/verify?token=${rawToken}`;
    return { 
      success: true as const, 
      magicUrl,
      expiresMinutes: 15,
      message: 'Одноразовая ссылка прямого входа сгенерирована (действует 15 минут)' 
    };
  });
}

/**
 * Принудительный сброс всех активных сессий пользователя (Force Logout everywhere)
 */
export async function adminRevokeUserSessionsAction(userId: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    if (!userId) return { success: false as const, error: 'Missing userId' };

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!targetUser) return { success: false as const, error: 'Пользователь не найден' };

    await db.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { userId } });
      await tx.authToken.deleteMany({ where: { userId } });
    });

    const ipAddress = await getClientIp('unknown');
    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'ADMIN_REVOKE_USER_SESSIONS',
      target: userId,
      targetType: 'USER',
      newValue: { targetEmail: targetUser.email },
      ipAddress
    });

    revalidatePath(`/admin/clients/${userId}`);
    return { success: true as const, message: 'Все активные сессии пользователя успешно завершены' };
  });
}
