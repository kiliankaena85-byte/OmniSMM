'use server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { revalidatePath } from 'next/cache';
import { createSecurityEvent } from '@/lib/security-events';
import { z } from 'zod';

export async function getSupportActionsReviewListAction(options?: {
  page?: number;
  limit?: number;
  reviewStatus?: string;
  staffUserId?: string;
  targetUserId?: string;
}) {
  return requireStaffPermission('finance', 'view', async () => {
    const page = Math.max(1, options?.page || 1);
    const limit = Math.min(100, Math.max(10, options?.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.SupportFinancialActionWhereInput = {};
    if (options?.reviewStatus && options.reviewStatus !== 'ALL') {
      where.reviewStatus = options.reviewStatus;
    }
    if (options?.staffUserId) {
      where.staffUserId = options.staffUserId;
    }
    if (options?.targetUserId) {
      where.targetUserId = options.targetUserId;
    }

    const [total, items] = await Promise.all([
      db.supportFinancialAction.count({ where }),
      db.supportFinancialAction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: { select: { id: true, email: true, role: true } },
          target: { select: { id: true, email: true } }
        }
      })
    ]);

    // Format BigInt fields for Client Components
    const formattedItems = items.map(item => ({
      ...item,
      amountCents: item.amountCents.toString(),
      amountRub: (Number(item.amountCents) / 100).toFixed(2)
    }));

    return {
      success: true as const,
      items: formattedItems,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  });
}

const reviewSupportActionSchema = z.object({
  actionId: z.string().min(1, 'ID операции обязателен'),
  reviewStatus: z.enum(['REVIEWED', 'FLAGGED', 'VIOLATION', 'APPROVED'], {
    errorMap: () => ({ message: 'Неверный статус проверки' })
  }),
  reviewNote: z.string().default(''),
});

export async function reviewSupportFinancialAction(formData: FormData) {
  return requireStaffPermission('finance', 'edit', async (admin) => {
    const rawPayload = {
      actionId: formData.get('actionId'),
      reviewStatus: formData.get('reviewStatus'),
      reviewNote: formData.get('reviewNote') || '',
    };
    const parsed = reviewSupportActionSchema.safeParse(rawPayload);
    if (!parsed.success) {
      return { success: false as const, error: parsed.error.errors[0]?.message || 'Неверные параметры проверки' };
    }
    const { actionId, reviewStatus, reviewNote } = parsed.data;

    const action = await db.supportFinancialAction.findUnique({
      where: { id: actionId },
      select: { id: true, staffUserId: true, targetUserId: true, reviewStatus: true }
    });

    if (!action) {
      return { success: false as const, error: 'Операция не найдена' };
    }

    const updated = await db.supportFinancialAction.update({
      where: { id: actionId },
      data: {
        reviewStatus,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote.trim()
      }
    });

    const ipAddress = await getClientIp('unknown');

    if (reviewStatus === 'VIOLATION') {
      await createSecurityEvent('SUPPORT_FINANCIAL_VIOLATION_FLAGGED', {
        severity: 'CRITICAL',
        staffUserId: action.staffUserId,
        targetUserId: action.targetUserId,
        ipAddress,
        details: { actionId, reviewedBy: admin.id, reviewNote }
      });
    }

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'REVIEW_SUPPORT_FINANCIAL_ACTION',
      target: actionId,
      targetType: 'SUPPORT_FINANCIAL_ACTION',
      oldValue: JSON.stringify({ reviewStatus: action.reviewStatus }),
      newValue: JSON.stringify({ reviewStatus, reviewNote }),
      ipAddress
    });

    revalidatePath('/admin/finance/support-review');
    return { success: true as const, action: updated };
  });
}

export async function exportSupportActionsCSVAction() {
  return requireStaffPermission('finance', 'view', async () => {
    const items = await db.supportFinancialAction.findMany({
      take: 1000,
      orderBy: { createdAt: 'desc' },
      include: {
        staff: { select: { email: true } },
        target: { select: { email: true } }
      }
    });

    // Sanitizer for CSV Formula Injection Protection (OWASP)
    const sanitizeCSV = (val: string | null | undefined) => {
      if (!val) return '""';
      let str = String(val).replace(/"/g, '""');
      if (['=', '+', '-', '@'].includes(str.charAt(0))) {
        str = "'" + str;
      }
      return `"${str}"`;
    };

    const headersList = ['ID', 'Date (MSK)', 'Staff Email', 'Target Email', 'Direction', 'Source', 'Amount (RUB)', 'Reason Code', 'Reason Note', 'Ticket ID', 'Review Status'];
    const rows = items.map(i => [
      sanitizeCSV(i.id),
      sanitizeCSV(new Date(i.createdAt).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })),
      sanitizeCSV(i.staff.email),
      sanitizeCSV(i.target.email),
      sanitizeCSV(i.direction),
      sanitizeCSV(i.source),
      sanitizeCSV((Number(i.amountCents) / 100).toFixed(2)),
      sanitizeCSV(i.reasonCode),
      sanitizeCSV(i.reasonNote),
      sanitizeCSV(i.ticketId || ''),
      sanitizeCSV(i.reviewStatus)
    ]);

    const csvContent = [headersList.join(','), ...rows.map(r => r.join(','))].join('\n');
    return { success: true as const, csv: csvContent };
  });
}
