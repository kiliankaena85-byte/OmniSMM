'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { z } from 'zod';
import {
  createTemplateSchema,
  updateTemplateSchema,
  sanitizeTelegramHtml,
  extractTemplateVariables,
} from '@/schemas/telegram';
import type { TelegramTemplate, TelegramActionResponse } from '@/types/telegram';
import { getTenantId, generateCuid2 } from './helpers';

export async function listTelegramTemplatesAction(
  category?: string
): Promise<TelegramTemplate[] | TelegramActionResponse> {
  return requireStaffPermission('settings', 'view', async () => {
    const tenantId = await getTenantId();
    const rows = await db.telegramTemplate.findMany({
      where: { tenantId, ...(category && category !== 'all' ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r: any) => ({
      ...r,
      variables: typeof r.variables === 'string' ? JSON.parse(r.variables) : r.variables,
    })) as unknown as TelegramTemplate[];
  });
}

export async function getTelegramTemplateAction(
  templateId: string
): Promise<TelegramActionResponse & { data?: TelegramTemplate }> {
  return requireStaffPermission('settings', 'view', async () => {
    if (!templateId) return { success: false, error: 'ID шаблона обязателен' };
    const tenantId = await getTenantId();
    const template = await db.telegramTemplate.findFirst({ where: { id: templateId, tenantId } });
    if (!template) return { success: false, error: 'Шаблон не найден' };
    return {
      success: true,
      data: {
        ...template,
        variables: typeof template.variables === 'string' ? JSON.parse(template.variables) : template.variables,
      } as unknown as TelegramTemplate,
    };
  });
}

export async function createTelegramTemplateAction(
  raw: z.infer<typeof createTemplateSchema>
): Promise<TelegramActionResponse & { data?: TelegramTemplate }> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = createTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }
    const data = parsed.data;
    const tenantId = await getTenantId();

    const sanitizedBody = data.parseMode === 'HTML' ? sanitizeTelegramHtml(data.body) : data.body;
    const existing = await db.telegramTemplate.findFirst({ where: { tenantId, slug: data.slug } });
    if (existing) {
      return { success: false, error: `Шаблон со slug "${data.slug}" уже существует` };
    }

    const id = generateCuid2();
    const variables = extractTemplateVariables(sanitizedBody);

    const template = await db.telegramTemplate.create({
      data: {
        tenantId,
        ...data,
        body: sanitizedBody,
        variables: JSON.stringify(variables),
      } as any,
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_TEMPLATE_CREATE',
      target: id, targetType: 'TELEGRAM_TEMPLATE', ipAddress,
      newValue: JSON.stringify({ name: data.name, slug: data.slug, category: data.category }),
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Шаблон "${data.name}" создан`, data: { ...template, variables } as unknown as TelegramTemplate };
  });
}

export async function updateTelegramTemplateAction(
  raw: z.infer<typeof updateTemplateSchema>
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = updateTemplateSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    }
    const { id, body, ...data } = parsed.data;
    const tenantId = await getTenantId();

    const existing = await db.telegramTemplate.findFirst({ where: { id, tenantId } });
    if (!existing) {
      return { success: false, error: 'Шаблон не найден' };
    }

    if (data.slug) {
      const dup = await db.telegramTemplate.findFirst({
        where: { tenantId, slug: data.slug, id: { not: id } },
      });
      if (dup) {
        return { success: false, error: `Шаблон со slug "${data.slug}" уже существует` };
      }
    }

    const sanitizedBody = body
      ? (data.parseMode === 'HTML' || existing.parseMode === 'HTML' ? sanitizeTelegramHtml(body) : body)
      : undefined;
    const variables = sanitizedBody ? extractTemplateVariables(sanitizedBody) : undefined;

    const updated = await db.telegramTemplate.update({
      where: { id },
      data: ({
        ...data,
        ...(sanitizedBody !== undefined && { body: sanitizedBody }),
        ...(variables !== undefined && { variables: JSON.stringify(variables) }),
        version: { increment: 1 },
      }) as any,
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_TEMPLATE_UPDATE',
      target: id, targetType: 'TELEGRAM_TEMPLATE', ipAddress,
      oldValue: JSON.stringify({ name: existing.name, version: existing.version }),
      newValue: JSON.stringify({ name: updated.name, version: updated.version }),
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Шаблон "${updated.name}" обновлён (v${updated.version})` };
  });
}

export async function deleteTelegramTemplateAction(
  templateId: string
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    if (!templateId) return { success: false, error: 'ID шаблона обязателен' };
    const tenantId = await getTenantId();

    const existing = await db.telegramTemplate.findFirst({ where: { id: templateId, tenantId } });
    if (!existing) return { success: false, error: 'Шаблон не найден' };

    await db.telegramTemplate.delete({ where: { id: templateId } });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_TEMPLATE_DELETE',
      target: templateId, targetType: 'TELEGRAM_TEMPLATE', ipAddress,
      oldValue: JSON.stringify({ name: existing.name }),
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Шаблон "${existing.name}" удалён` };
  });
}
