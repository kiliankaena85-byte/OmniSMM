'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { z } from 'zod';
import {
  createButtonSchema,
  updateButtonSchema,
  reorderButtonsSchema,
} from '@/schemas/telegram';
import type { TelegramButton, TelegramActionResponse } from '@/types/telegram';
import { getTenantId, generateCuid2 } from './helpers';

export async function listTelegramButtonsAction(): Promise<TelegramButton[] | TelegramActionResponse> {
  return requireStaffPermission('settings', 'view', async () => {
    const tenantId = await getTenantId();
    return db.telegramButton.findMany({
      where: { tenantId },
      orderBy: [{ sortOrder: 'asc' }, { row: 'asc' }, { col: 'asc' }],
    }) as unknown as TelegramButton[];
  });
}

export async function createTelegramButtonAction(
  raw: z.infer<typeof createButtonSchema>
): Promise<TelegramActionResponse & { data?: TelegramButton }> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = createButtonSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }
    const data = parsed.data;
    const tenantId = await getTenantId();

    const count = await db.telegramButton.count({ where: { tenantId } });
    if (count >= 30) {
      return { success: false, error: 'Максимум 30 кнопок для одного тенанта' };
    }

    const existing = await db.telegramButton.findFirst({ where: { tenantId, command: data.command } });
    if (existing) {
      return { success: false, error: `Команда "/${data.command}" уже существует` };
    }

    const id = generateCuid2();
    const button = await db.telegramButton.create({
      data: { tenantId, ...data } as unknown as any,
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_BUTTON_CREATE',
      target: id, targetType: 'TELEGRAM_BUTTON', ipAddress,
      newValue: JSON.stringify({ label: data.label, command: data.command }),
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Кнопка "${data.label}" создана`, data: button as unknown as TelegramButton };
  });
}

export async function updateTelegramButtonAction(
  raw: z.infer<typeof updateButtonSchema>
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = updateButtonSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }
    const { id, ...data } = parsed.data;
    const tenantId = await getTenantId();

    const existing = await db.telegramButton.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return { success: false, error: 'Кнопка не найдена' };
    }

    if (data.command) {
      const dup = await db.telegramButton.findFirst({
        where: { tenantId, command: data.command, id: { not: id } },
      });
      if (dup) {
        return { success: false, error: `Команда "/${data.command}" уже используется другой кнопкой` };
      }
    }

    const updated = await db.telegramButton.update({ where: { id }, data: data as any });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_BUTTON_UPDATE',
      target: id, targetType: 'TELEGRAM_BUTTON', ipAddress,
      oldValue: JSON.stringify({ label: existing.label, command: existing.command }),
      newValue: JSON.stringify({ label: updated.label, command: updated.command }),
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Кнопка "${updated.label}" обновлена` };
  });
}

export async function deleteTelegramButtonAction(
  buttonId: string
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    if (!buttonId || buttonId.length < 5) {
      return { success: false, error: 'Некорректный ID кнопки' };
    }
    const tenantId = await getTenantId();

    const existing = await db.telegramButton.findFirst({ where: { id: buttonId, tenantId } });
    if (!existing) {
      return { success: false, error: 'Кнопка не найдена' };
    }

    await db.telegramButton.delete({ where: { id: buttonId } });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_BUTTON_DELETE',
      target: buttonId, targetType: 'TELEGRAM_BUTTON', ipAddress,
      oldValue: JSON.stringify({ label: existing.label, command: existing.command }),
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Кнопка "${existing.label}" удалена` };
  });
}

export async function reorderTelegramButtonsAction(
  raw: z.infer<typeof reorderButtonsSchema>
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = reorderButtonsSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }

    await db.$transaction(
      parsed.data.items.map((item) =>
        db.telegramButton.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder, row: item.row, col: item.col },
        })
      )
    );

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_BUTTONS_REORDERED',
      target: 'all', targetType: 'TELEGRAM_BUTTON', ipAddress,
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: 'Порядок кнопок обновлён' };
  });
}
