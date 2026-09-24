'use server';

import { requireStaffPermission, requireOwnerPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { z } from 'zod';
import { resolveErrorSchema, massResolveErrorsSchema } from '@/schemas/telegram';
import type { TelegramErrorLog, TelegramActionResponse } from '@/types/telegram';
import { getTenantId, generateCuid2 } from './helpers';

export async function listTelegramErrorsAction(params?: {
  level?: string;
  source?: string;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}): Promise<TelegramActionResponse & { data?: { errors: TelegramErrorLog[]; total: number } }> {
  return requireStaffPermission('settings', 'view', async () => {
    const tenantId = await getTenantId();
    const limit = Math.min(params?.limit || 50, 200);
    const offset = params?.offset || 0;

    const where: Record<string, unknown> = { tenantId };
    if (params?.level) where.level = params.level;
    if (params?.source) where.source = params.source;
    if (params?.resolved !== undefined) where.isResolved = params.resolved;

    const [errors, total] = await Promise.all([
      db.telegramErrorLog.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.telegramErrorLog.count({ where }),
    ]);

    return { success: true, data: { errors: errors as unknown as TelegramErrorLog[], total } };
  });
}

export async function resolveTelegramErrorAction(
  raw: z.infer<typeof resolveErrorSchema>
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = resolveErrorSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }

    await db.telegramErrorLog.update({
      where: { id: parsed.data.errorId },
      data: {
        isResolved: true,
        resolvedBy: admin.id,
        resolvedAt: new Date(),
      },
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_ERROR_RESOLVED',
      target: parsed.data.errorId, targetType: 'TELEGRAM_ERROR', ipAddress,
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: 'Ошибка помечена как решённая' };
  });
}

export async function massResolveTelegramErrorsAction(
  raw: z.infer<typeof massResolveErrorsSchema>
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = massResolveErrorsSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }

    const count = await db.telegramErrorLog.updateMany({
      where: { id: { in: parsed.data.errorIds } },
      data: {
        isResolved: true,
        resolvedBy: admin.id,
        resolvedAt: new Date(),
      },
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_ERRORS_MASS_RESOLVE',
      target: `${count.count} errors`, targetType: 'TELEGRAM_ERROR', ipAddress,
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `${count.count} ошибок помечено как решённые` };
  });
}

export async function deleteTelegramErrorAction(errorId: string): Promise<TelegramActionResponse> {
  return requireOwnerPermission(async (admin) => {
    if (!errorId) return { success: false, error: 'ID ошибки обязателен' };
    await db.telegramErrorLog.delete({ where: { id: errorId } });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_ERROR_DELETE',
      target: errorId, targetType: 'TELEGRAM_ERROR', ipAddress,
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: 'Запись об ошибке удалена' };
  });
}

import { TelegramErrorLogService, type TelegramErrorLogParams } from '@/services/telegram/telegram-error-log.service';

/**
 * Admin-only Server Action for manual error logging.
 * [SECURITY] Previously this was an unauthenticated public RPC endpoint ('use server' export)
 * allowing anyone to write into telegramErrorLog of any tenant. Internal callers
 * (webhook, bot) must use TelegramErrorLogService directly.
 */
export async function logTelegramError(params: TelegramErrorLogParams): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (_admin, _role, activeTenantId) => {
    const tenantId = activeTenantId ?? (await getTenantId());
    await TelegramErrorLogService.log(tenantId, params);
    return { success: true };
  });
}

