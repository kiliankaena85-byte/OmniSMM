'use server';

/**
 * Client management Server Actions (Sprint 1.4)
 *
 * updateClientDiscountAction — set personalDiscount + optional expiry
 * updateClientNoteAction — set/clear internal operator note
 *
 * Security:
 * - requireAdmin on all actions
 * - adminNote is NEVER exposed to client-facing APIs
 * - discount capped at 50% (business rule)
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { auditAdmin } from '@/lib/admin-audit';
import { serializeForClient } from '@/lib/bigint-serializer';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

const MAX_DISCOUNT = 50; // Business rule: max personal discount

const discountSchema = z.object({
  userId: z.string().min(1),
  discount: z.number().min(0).max(MAX_DISCOUNT),
  endsAt: z.string().datetime().optional(), // ISO 8601
}).refine((data) => {
  if (data.endsAt) {
    return new Date(data.endsAt).getTime() > Date.now();
  }
  return true;
}, {
  message: "Срок окончания скидки должен быть в будущем",
  path: ["endsAt"]
});

const noteSchema = z.object({
  userId: z.string().min(1),
  note: z.string().max(2000).optional(),
});

/** Set personal discount for a client (0 = remove discount) */
export async function updateClientDiscountAction(
  userId: string,
  discount: number,
  endsAt?: string
) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const parsed = discountSchema.safeParse({ userId, discount, endsAt });
    if (!parsed.success) {
      return { success: false as const, error: `Максимальная скидка ${MAX_DISCOUNT}%` };
    }

    const user = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, personalDiscount: true },
    });
    if (!user) return { success: false as const, error: 'Пользователь не найден' };

    await db.user.update({
      where: { id: user.id },
      data: {
        personalDiscount: parsed.data.discount,
        discountEndsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_DISCOUNT_SET',
      target: user.id,
      targetType: 'USER',
      oldValue: { discount: user.personalDiscount },
      newValue: { discount: parsed.data.discount, endsAt: parsed.data.endsAt },
    });

    revalidatePath(`/admin/clients/${user.id}`);
    revalidatePath('/admin/clients');
    return { success: true as const };
  });
}

import { SUPPORT_CREDIT_REASONS, SUPPORT_DEBIT_REASONS } from '@/lib/constants/support-reasons';

/** Get all historical notes for a client */
export async function getClientNotesAction(userId: string) {
  return requireStaffPermission('clients', 'view', async () => {
    if (!userId) {
      return { success: false as const, error: 'Не указан ID клиента' };
    }

    const notes = await db.userNote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { email: true }
        }
      }
    });

    return {
      success: true as const,
      notes: notes.map(n => ({
        id: n.id,
        userId: n.userId,
        content: n.content,
        authorEmail: n.author?.email || 'Оператор',
        createdAt: n.createdAt.toISOString(),
      }))
    };
  });
}

/** Create a new internal operator note in client history */
export async function createClientNoteAction(userId: string, content: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const trimmed = content?.trim();
    if (!userId || !trimmed) {
      return { success: false as const, error: 'Текст заметки не может быть пустым' };
    }
    if (trimmed.length > 2000) {
      return { success: false as const, error: 'Заметка слишком длинная (макс 2000 символов)' };
    }

    const authorExists = admin.id ? await db.user.findUnique({ where: { id: admin.id }, select: { id: true } }) : null;

    const newNote = await db.userNote.create({
      data: {
        userId,
        authorId: authorExists ? admin.id : null,
        content: trimmed,
      },
      include: {
        author: { select: { email: true } }
      }
    });

    // Sync latest note to User.adminNote for backward compatibility
    await db.user.update({
      where: { id: userId },
      data: {
        adminNote: trimmed,
        adminNoteUpdatedAt: newNote.createdAt,
        adminNoteUpdatedBy: admin.email,
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_NOTE_CREATE',
      target: userId,
      targetType: 'USER',
    });

    revalidatePath(`/admin/clients/${userId}`);
    return {
      success: true as const,
      note: {
        id: newNote.id,
        userId: newNote.userId,
        content: newNote.content,
        authorEmail: newNote.author?.email || admin.email,
        createdAt: newNote.createdAt.toISOString(),
      }
    };
  });
}

/** Edit existing client note */
export async function editClientNoteAction(noteId: string, userId: string, content: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const trimmed = content?.trim();
    if (!noteId || !trimmed) {
      return { success: false as const, error: 'Текст заметки не может быть пустым' };
    }

    if (noteId === 'legacy-note') {
      const authorExists = admin.id ? await db.user.findUnique({ where: { id: admin.id }, select: { id: true } }) : null;
      const created = await db.userNote.create({
        data: {
          userId,
          authorId: authorExists ? admin.id : null,
          content: trimmed,
        },
        include: { author: { select: { email: true } } }
      });

      await db.user.update({
        where: { id: userId },
        data: {
          adminNote: trimmed,
          adminNoteUpdatedAt: new Date(),
          adminNoteUpdatedBy: admin.email,
        }
      });

      auditAdmin({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'CLIENT_NOTE_CREATE',
        target: created.id,
        targetType: 'USER',
      });

      revalidatePath(`/admin/clients/${userId}`);
      return {
        success: true as const,
        note: {
          id: created.id,
          userId: created.userId,
          content: created.content,
          authorEmail: created.author?.email || admin.email,
          createdAt: created.createdAt.toISOString(),
        }
      };
    }

    const updated = await db.userNote.update({
      where: { id: noteId },
      data: { content: trimmed },
      include: { author: { select: { email: true } } }
    });

    await db.user.update({
      where: { id: userId },
      data: {
        adminNote: trimmed,
        adminNoteUpdatedAt: new Date(),
        adminNoteUpdatedBy: admin.email,
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_NOTE_EDIT',
      target: noteId,
      targetType: 'USER',
    });

    revalidatePath(`/admin/clients/${userId}`);
    return {
      success: true as const,
      note: {
        id: updated.id,
        userId: updated.userId,
        content: updated.content,
        authorEmail: updated.author?.email || admin.email,
        createdAt: updated.createdAt.toISOString(),
      }
    };
  });
}

/** Delete an individual note from client history */
export async function deleteClientNoteAction(noteId: string, userId: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    if (!noteId) {
      return { success: false as const, error: 'Не указан ID заметки' };
    }

    if (noteId === 'legacy-note') {
      await db.user.update({
        where: { id: userId },
        data: {
          adminNote: null,
          adminNoteUpdatedAt: null,
          adminNoteUpdatedBy: null,
        }
      });
      revalidatePath(`/admin/clients/${userId}`);
      return { success: true as const };
    }

    await db.userNote.delete({
      where: { id: noteId }
    }).catch(() => null);

    // Sync latest remaining note to User.adminNote
    const latest = await db.userNote.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { email: true } } }
    });

    await db.user.update({
      where: { id: userId },
      data: {
        adminNote: latest?.content || null,
        adminNoteUpdatedAt: latest?.createdAt || null,
        adminNoteUpdatedBy: latest?.author?.email || null,
      }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_NOTE_DELETE',
      target: noteId,
      targetType: 'USER',
    });

    revalidatePath(`/admin/clients/${userId}`);
    return { success: true as const };
  });
}

/** Update internal admin note for a client (single-field legacy compatibility) */
export async function updateClientNoteAction(userId: string, note: string) {
  return createClientNoteAction(userId, note);
}

/** Clear / delete all internal admin notes for a client */
export async function clearClientNoteAction(userId: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    if (!userId) {
      return { success: false as const, error: 'Не указан ID клиента' };
    }

    await db.userNote.deleteMany({
      where: { userId }
    });

    await db.user.update({
      where: { id: userId },
      data: {
        adminNote: null,
        adminNoteUpdatedAt: null,
        adminNoteUpdatedBy: null,
      },
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_NOTES_CLEAR',
      target: userId,
      targetType: 'USER',
    });

    revalidatePath(`/admin/clients/${userId}`);
    return { success: true as const };
  });
}

/** Send password reset link to client email */
export async function sendPasswordResetEmailAction(userId: string) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, tenantId: true },
    });

    if (!user) {
      return { success: false as const, error: 'Клиент не найден' };
    }

    const rawToken = (await import('crypto')).randomBytes(32).toString('hex');
    const hashedToken = (await import('crypto')).createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const targetTenant = user.tenantId || 'smmplan';

    await db.authToken.create({
      data: {
        userId: user.id,
        token: hashedToken,
        tenantId: targetTenant,
        expiresAt,
        ipIssued: '127.0.0.1',
        userAgentIssued: `password-reset:staff:${admin.email}`,
      },
    });

    const { headers } = await import('next/headers');
    const reqHeaders = await headers();
    const incomingHost = reqHeaders.get('host');
    const { absoluteCanonical } = await import('@/lib/seo-helpers');
    const resetUrl = absoluteCanonical(
      targetTenant,
      `/login?tab=reset&token=${rawToken}&tenant=${targetTenant}`,
      incomingHost
    );

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'CLIENT_PASSWORD_RESET_SENT',
      target: user.id,
      targetType: 'USER',
    });

    return { 
      success: true as const, 
      message: `Ссылка для сброса пароля сгенерирована: ${resetUrl}`,
      resetUrl 
    };
  });
}

/** Staff Balance Credit / Debit / Goodwill with Poka-Yoke policy limits and admin escalation */
export async function supportGoodwillCreditAction(formData: FormData) {
  return requireStaffPermission('clients', 'edit', async (admin, _role, tenantId) => {
    const userId = formData.get('userId') as string;
    const amountStr = formData.get('amount') as string;
    const direction = ((formData.get('direction') as string) || 'CREDIT').toUpperCase() as 'CREDIT' | 'DEBIT';
    const reason = (formData.get('reason') as string) || (direction === 'CREDIT' ? 'Компенсация за задержку заказа' : 'Корректировка ошибочного начисления');
    const comment = (formData.get('comment') as string) || '';

    if (!userId || !amountStr) {
      return { success: false as const, error: 'Не указан клиент или сумма' };
    }

    const amountRub = parseFloat(amountStr);
    if (isNaN(amountRub) || amountRub <= 0) {
      return { success: false as const, error: 'Сумма должна быть положительным числом' };
    }

    // Poka-Yoke Server Validation: Ensure Debit operations cannot use Credit compensation reasons
    if (direction === 'DEBIT') {
      const lowerReason = reason.toLowerCase();
      if (lowerReason.includes('компенсация') || lowerReason.includes('доброй воли') || lowerReason.includes('бонус')) {
        return {
          success: false as const,
          error: 'Недопустимая причина для списания. «Компенсация» и «Бонус» применяются только для начисления средств (+) клиенту.'
        };
      }
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, balance: true, tenantId: true }
    });

    if (!targetUser) {
      return { success: false as const, error: 'Клиент не найден' };
    }

    const amountKopecks = BigInt(Math.round(amountRub * 100));

    // GUARD: Zero-negative invariant for DEBIT operations
    if (direction === 'DEBIT') {
      if (amountKopecks > targetUser.balance) {
        const currentRub = Number(targetUser.balance) / 100;
        return {
          success: false as const,
          error: `Невозможно списать в минус. Текущий баланс клиента: ${currentRub.toLocaleString('ru-RU')} ₽, запрошено списание: ${amountRub} ₽`
        };
      }
    }

    // Dynamic Policy Limit Check for SUPPORT
    const { getEffectiveBalancePolicy } = await import('@/services/admin/balance-policy.service');
    const policy = await getEffectiveBalancePolicy(admin.id);
    
    // Default limits: 2 000 ₽ per request if policy not configured
    const maxInstantCreditLimitKopecks = policy?.maxCreditPerRequest ?? BigInt(200_000);
    const maxInstantCreditLimitRub = Number(maxInstantCreditLimitKopecks) / 100;
    const maxInstantDebitLimitKopecks = policy?.maxDebitPerRequest ?? BigInt(200_000);
    const maxInstantDebitLimitRub = Number(maxInstantDebitLimitKopecks) / 100;

    // If SUPPORT wants to credit more than instant limit -> Escalate to Admin approval flow
    if (direction === 'CREDIT' && admin.role === 'SUPPORT' && amountKopecks > maxInstantCreditLimitKopecks) {
      const { createBalanceAdjustmentRequestAction } = await import('@/actions/admin/balance-adjustments');
      const reqFormData = new FormData();
      reqFormData.set('userId', userId);
      reqFormData.set('targetUserId', userId);
      reqFormData.set('direction', 'CREDIT');
      reqFormData.set('amount', (Number(amountKopecks) / 100).toFixed(2));
      reqFormData.set('amountCents', amountKopecks.toString());
      reqFormData.set('reasonCode', 'GOODWILL');
      reqFormData.set('reasonNote', `Goodwill > ${maxInstantCreditLimitRub} ₽: ${reason}${comment ? ` (${comment})` : ''}`);
      reqFormData.set('idempotencyKey', crypto.randomUUID());

      const requestRes = await createBalanceAdjustmentRequestAction(reqFormData);
      if (requestRes.success) {
        return {
          success: true as const,
          pendingApproval: true,
          message: `Сумма ${amountRub} ₽ превышает ваш мгновенный лимит (${maxInstantCreditLimitRub} ₽). Заявка отправлена администратору на согласование.`
        };
      }
      return { success: false as const, error: requestRes.error || 'Ошибка создания заявки администратору' };
    }

    // If SUPPORT wants to debit more than instant limit -> Escalate to Admin approval flow
    if (direction === 'DEBIT' && admin.role === 'SUPPORT' && amountKopecks > maxInstantDebitLimitKopecks) {
      const { createBalanceAdjustmentRequestAction } = await import('@/actions/admin/balance-adjustments');
      const reqFormData = new FormData();
      reqFormData.set('userId', userId);
      reqFormData.set('targetUserId', userId);
      reqFormData.set('direction', 'DEBIT');
      reqFormData.set('amount', (Number(amountKopecks) / 100).toFixed(2));
      reqFormData.set('amountCents', amountKopecks.toString());
      reqFormData.set('reasonCode', 'CORRECTION_DEBIT');
      reqFormData.set('reasonNote', `Списание > ${maxInstantDebitLimitRub} ₽: ${reason}${comment ? ` (${comment})` : ''}`);
      reqFormData.set('idempotencyKey', crypto.randomUUID());

      const requestRes = await createBalanceAdjustmentRequestAction(reqFormData);
      if (requestRes.success) {
        return {
          success: true as const,
          pendingApproval: true,
          message: `Списание ${amountRub} ₽ превышает ваш мгновенный лимит (${maxInstantDebitLimitRub} ₽). Заявка отправлена администратору на согласование.`
        };
      }
      return { success: false as const, error: requestRes.error || 'Ошибка создания заявки администратору' };
    }

    const { WalletOps } = await import('@/services/financial/wallet-ops');
    const { auditAdminAwaitable } = await import('@/lib/admin-audit');

    if (direction === 'DEBIT') {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { balance: true }
      });
      if (!user || user.balance < amountKopecks) {
        return {
          success: false as const,
          error: `Недостаточно средств у клиента для списания. Текущий баланс: ${(Number(user?.balance || 0) / 100).toFixed(2)} ₽`
        };
      }
    }

    const resolvedTenant = targetUser.tenantId || tenantId || 'smmplan';
    const txIdempotencyKey = crypto.randomUUID();

    const result = await db.$transaction(async (tx) => {
      if (direction === 'CREDIT') {
        return await WalletOps.credit(
          tx,
          userId,
          amountKopecks,
          `Начисление: ${reason}${comment ? ` (${comment})` : ''}`,
          {
            adminId: admin.id,
            tenantId: resolvedTenant,
            transactionType: 'ADJUSTMENT',
            idempotencyKey: txIdempotencyKey,
          }
        );
      } else {
        return await WalletOps.adminAdjust(
          tx,
          userId,
          -amountKopecks,
          `Списание: ${reason}${comment ? ` (${comment})` : ''}`,
          {
            adminId: admin.id,
            tenantId: resolvedTenant,
            idempotencyKey: txIdempotencyKey,
            allowElevatedCap: admin.role === 'OWNER' || admin.role === 'ADMIN',
          }
        );
      }
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: direction === 'CREDIT' ? 'SUPPORT_GOODWILL_CREDIT' : 'SUPPORT_BALANCE_DEBIT',
      target: userId,
      targetType: 'USER',
      newValue: { amountRub, direction, reason, comment },
    });

    revalidatePath(`/admin/clients/${userId}`);
    revalidatePath('/admin/clients');
    return { 
      success: true as const, 
      newBalanceRub: Number(result.balance) / 100,
      message: `${direction === 'CREDIT' ? 'Начислено' : 'Списано'} ${amountRub} ₽`
    };
  });
}

/** Get client ledger entries and comprehensive financial summary */
export async function getClientLedgerAction(userId: string, filterType = 'ALL') {
  return requireStaffPermission('clients', 'view', async (admin) => {
    if (!userId) {
      return { success: false as const, error: 'Не указан ID клиента' };
    }

    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true }
    });
    if (!targetUser) {
      return { success: false as const, error: 'Пользователь не найден' };
    }

    const where: Prisma.LedgerEntryWhereInput = {
      userId,
      ...(targetUser.tenantId ? { tenantId: targetUser.tenantId } : {})
    };

    if (filterType === 'TOPUP') {
      where.OR = [
        { transactionType: 'TOPUP' },
        { transactionType: 'PAYMENT', amount: { gt: BigInt(0) } },
        { transactionType: 'ADJUSTMENT', amount: { gt: BigInt(0) } },
      ];
    } else if (filterType === 'ORDER_CHARGE') {
      where.OR = [
        { transactionType: 'ORDER_CHARGE' },
        { transactionType: 'REROUTE' },
        { amount: { lt: BigInt(0) }, reason: { contains: 'Заказ' } }
      ];
    } else if (filterType === 'REFUND') {
      where.OR = [
        { transactionType: 'REFUND' },
        { transactionType: 'ORDER_CANCEL' },
        { reason: { contains: 'возврат', mode: 'insensitive' } }
      ];
    } else if (filterType === 'ADJUSTMENT') {
      where.OR = [
        { transactionType: 'ADJUSTMENT' },
        { transactionType: 'COMPENSATION' },
        { adminId: { not: null } }
      ];
    }

    const [entries, rawSummary] = await Promise.all([
      db.ledgerEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          amount: true,
          reason: true,
          status: true,
          transactionType: true,
          idempotencyKey: true,
          adminId: true,
          createdAt: true,
        }
      }),
      db.ledgerEntry.groupBy({
        by: ['transactionType'],
        where: {
          userId,
          ...(targetUser.tenantId ? { tenantId: targetUser.tenantId } : {})
        },
        _sum: { amount: true },
      })
    ]);

    // Fetch admin emails if needed
    const adminIds = Array.from(new Set(entries.map(e => e.adminId).filter(Boolean))) as string[];
    // tenant-isolation-ignore: Global staff account lookup to display admin email on ledger entries
    const admins = adminIds.length > 0 ? await db.user.findMany({
      where: { id: { in: adminIds } },
      select: { id: true, email: true }
    }) : [];
    const adminMap = new Map(admins.map(a => [a.id, a.email]));

    // Calculate aggregated totals
    let totalDepositedKopecks = BigInt(0);
    let totalSpentKopecks = BigInt(0);
    let totalRefundedKopecks = BigInt(0);
    let totalAdjustedKopecks = BigInt(0);

    for (const group of rawSummary) {
      const sum = group._sum.amount ?? BigInt(0);
      const type = group.transactionType;

      if (type === 'TOPUP' || (type === 'PAYMENT' && sum > BigInt(0))) {
        totalDepositedKopecks += sum;
      } else if (type === 'ORDER_CHARGE' || type === 'REROUTE') {
        totalSpentKopecks += (sum < BigInt(0) ? -sum : sum);
      } else if (type === 'REFUND' || type === 'ORDER_CANCEL') {
        totalRefundedKopecks += (sum > BigInt(0) ? sum : -sum);
      } else if (type === 'ADJUSTMENT' || type === 'COMPENSATION') {
        totalAdjustedKopecks += sum;
      } else if (sum > BigInt(0)) {
        totalDepositedKopecks += sum;
      } else if (sum < BigInt(0)) {
        totalSpentKopecks += -sum;
      }
    }

    return {
      success: true as const,
      entries: entries.map(e => {
        const amountNum = Number(e.amount) / 100;
        return {
          id: e.id,
          amountRub: Math.abs(amountNum),
          amountCents: Number(e.amount),
          direction: e.amount >= BigInt(0) ? ('INCOME' as const) : ('EXPENSE' as const),
          reason: e.reason,
          status: e.status,
          transactionType: e.transactionType,
          idempotencyKey: e.idempotencyKey ?? null,
          adminEmail: e.adminId ? (adminMap.get(e.adminId) || 'Оператор') : null,
          createdAt: e.createdAt.toISOString(),
        };
      }),
      summary: {
        totalDepositedRub: Number(totalDepositedKopecks) / 100,
        totalSpentRub: Number(totalSpentKopecks) / 100,
        totalRefundedRub: Number(totalRefundedKopecks) / 100,
        totalAdjustedRub: Number(totalAdjustedKopecks) / 100,
      }
    };
  });
}

/** Fetch full client profile for the detail page */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getClientProfileAction(userId: string) {
  return requireStaffPermission('clients', 'view', async () => {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        balance: true,
        quarantineBalance: true,
        totalSpent: true,
        personalDiscount: true,
        discountEndsAt: true,
        adminNote: true,
        adminNoteUpdatedAt: true,
        adminNoteUpdatedBy: true,
        telegramId: true,
        apiKeyHash: true,
        referralCode: true,
        referralBalance: true,
        createdAt: true,
        _count: { select: { orders: true, payments: true, tickets: true } },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            numericId: true,
            status: true,
            quantity: true,
            charge: true,
            createdAt: true,
            service: { select: { name: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) return { success: false as const, error: 'Пользователь не найден' };

    return { success: true as const, user: serializeForClient(user) };
  });
}
