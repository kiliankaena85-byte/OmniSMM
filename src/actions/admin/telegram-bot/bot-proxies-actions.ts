'use server';

import { requireStaffPermission, requireOwnerPermission } from '@/lib/server/rbac';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { z } from 'zod';
import { createProxySchema, updateProxySchema } from '@/schemas/telegram';
import type { TelegramProxy, TelegramActionResponse, ProxyTestResult } from '@/types/telegram';
import { getTenantId, getBotToken, safeTelegramFetch, generateCuid2 } from './helpers';

export async function listTelegramProxiesAction(): Promise<TelegramProxy[] | TelegramActionResponse> {
  return requireStaffPermission('settings', 'view', async () => {
    const tenantId = await getTenantId();
    const rows = await db.telegramProxy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, tenantId: true, label: true, protocol: true,
        host: true, port: true, username: true, isActive: true,
        lastTestAt: true, lastTestLatencyMs: true, lastTestSuccess: true,
        createdAt: true, updatedAt: true,
      },
    });
    return rows as unknown as TelegramProxy[];
  });
}

export async function createTelegramProxyAction(
  raw: z.infer<typeof createProxySchema>
): Promise<TelegramActionResponse & { data?: TelegramProxy }> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = createProxySchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    const data = parsed.data;
    const tenantId = await getTenantId();
    const id = generateCuid2();

    let passwordEncrypted: string | null = null;
    if (data.password) {
      try {
        const { VaultService } = await import('@/lib/vault');
        passwordEncrypted = VaultService.encrypt(data.password);
      } catch {
        return { success: false, error: 'Ошибка шифрования пароля прокси' };
      }
    }

    const proxy = await db.telegramProxy.create({
      data: {
        tenantId, label: data.label, protocol: data.protocol,
        host: data.host, port: data.port, username: data.username,
        passwordEncrypted,
      } as any,
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_PROXY_CREATE',
      target: id, targetType: 'TELEGRAM_PROXY', ipAddress,
      newValue: JSON.stringify({ label: data.label, protocol: data.protocol, host: data.host }),
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Прокси "${data.label}" добавлен`, data: proxy as unknown as TelegramProxy };
  });
}

export async function updateTelegramProxyAction(
  raw: z.infer<typeof updateProxySchema>
): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    const parsed = updateProxySchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || 'Ошибка валидации' };
    const { id, password, ...data } = parsed.data;
    const tenantId = await getTenantId();

    const existing = await db.telegramProxy.findFirst({ where: { id, tenantId } });
    if (!existing) return { success: false, error: 'Прокси не найден' };

    let passwordEncrypted: string | null | undefined;
    if (password !== undefined) {
      try {
        const { VaultService } = await import('@/lib/vault');
        passwordEncrypted = password ? VaultService.encrypt(password) : null;
      } catch {
        return { success: false, error: 'Ошибка шифрования пароля' };
      }
    }

    await db.telegramProxy.update({
      where: { id },
      data: { ...data, ...(passwordEncrypted !== undefined && { passwordEncrypted: passwordEncrypted ?? null }) } as any,
    });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_PROXY_UPDATE',
      target: id, targetType: 'TELEGRAM_PROXY', ipAddress,
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Прокси "${data.label || existing.label}" обновлён` };
  });
}

export async function deleteTelegramProxyAction(proxyId: string): Promise<TelegramActionResponse> {
  return requireStaffPermission('settings', 'edit', async (admin) => {
    if (!proxyId) return { success: false, error: 'ID прокси обязателен' };
    const tenantId = await getTenantId();

    const existing = await db.telegramProxy.findFirst({ where: { id: proxyId, tenantId } });
    if (!existing) return { success: false, error: 'Прокси не найден' };

    await db.telegramProxy.delete({ where: { id: proxyId } });
    await db.systemSettings.updateMany({ where: { telegramProxyId: proxyId }, data: { telegramProxyId: null } });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: 'TELEGRAM_PROXY_DELETE',
      target: proxyId, targetType: 'TELEGRAM_PROXY', ipAddress,
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: `Прокси "${existing.label}" удалён` };
  });
}

export async function testTelegramProxyAction(
  proxyId: string
): Promise<TelegramActionResponse & { data?: ProxyTestResult }> {
  return requireStaffPermission('settings', 'edit', async () => {
    if (!proxyId) return { success: false, error: 'ID прокси обязателен' };
    const tenantId = await getTenantId();

    const proxy = await db.telegramProxy.findFirst({ where: { id: proxyId, tenantId } });
    if (!proxy) return { success: false, error: 'Прокси не найден' };

    const token = await getBotToken();
    if (!token) return { success: false, error: 'Бот токен не настроен' };

    try {
      const startTime = Date.now();
      const res = await safeTelegramFetch(`https://api.telegram.org/bot${token}/getMe`);
      const latencyMs = Date.now() - startTime;
      const data = await res.json();
      const success = data.ok === true;
      const result: ProxyTestResult = {
        success,
        latencyMs,
        error: success ? undefined : data.description || 'Ошибка подключения',
        testedAt: new Date().toISOString(),
      };

      await db.telegramProxy.update({
        where: { id: proxyId },
        data: { lastTestAt: new Date(), lastTestLatencyMs: latencyMs, lastTestSuccess: success },
      });

      return {
        success: true,
        message: success ? `Прокси активен (${latencyMs}ms)` : `Ошибка: ${result.error}`,
        data: result,
      };
    } catch (err) {
      return { success: false, error: `Тест не удался: ${err instanceof Error ? err.message : String(err)}` };
    }
  });
}

export async function setActiveTelegramProxyAction(
  proxyId: string | null
): Promise<TelegramActionResponse> {
  return requireOwnerPermission(async (admin) => {
    const tenantId = await getTenantId();
    if (proxyId) {
      const proxy = await db.telegramProxy.findFirst({ where: { id: proxyId, tenantId } });
      if (!proxy) return { success: false, error: 'Прокси не найден' };
    }

    await db.telegramProxy.updateMany({ where: { tenantId }, data: { isActive: false } });
    if (proxyId) {
      await db.telegramProxy.update({ where: { id: proxyId }, data: { isActive: true } });
    }
    await db.systemSettings.updateMany({ where: { id: tenantId }, data: { telegramProxyId: proxyId } });

    const ipAddress = await getClientIp();
    await auditAdminAwaitable({
      adminId: admin.id, adminEmail: admin.email,
      action: proxyId ? 'TELEGRAM_PROXY_ACTIVATE' : 'TELEGRAM_PROXY_DEACTIVATE',
      target: proxyId || 'none', targetType: 'TELEGRAM_PROXY', ipAddress,
    });

    revalidatePath('/admin/settings?tab=telegram');
    return { success: true, message: proxyId ? 'Прокси активирован' : 'Прокси деактивирован (прямое подключение)' };
  });
}
