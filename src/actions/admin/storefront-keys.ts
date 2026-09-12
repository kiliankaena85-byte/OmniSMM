'use server';

import { db } from '@/lib/db';
import { requireStaffPermission } from '@/lib/server/rbac';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { StorefrontKeyService, StorefrontKeyType } from '@/services/storefront/storefront-key.service';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const GenerateKeySchema = z.object({
  tenantId: z.string().min(1, 'Идентификатор тенанта обязателен'),
  type: z.enum(['PUBLISHABLE', 'SECRET']),
  name: z.string().trim().min(2, 'Название должно быть от 2 до 60 символов').max(60),
});

const RevokeKeySchema = z.object({
  id: z.string().min(1, 'Идентификатор ключа обязателен'),
  tenantId: z.string().min(1, 'Идентификатор тенанта обязателен'),
});

export async function listStorefrontKeysAction(tenantId: string) {
  return requireStaffPermission('settings', 'view', async () => {
    try {
      const keys = await db.storefrontKey.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: keys.map((k) => ({
          id: k.id,
          tenantId: k.tenantId,
          type: k.type as StorefrontKeyType,
          keyPrefix: k.keyPrefix,
          name: k.name,
          isActive: k.isActive,
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
          createdAt: k.createdAt.toISOString(),
        })),
      };
    } catch (error: any) {
      console.error('[StorefrontKeysAction] Failed to list keys:', error);
      return { success: false, error: 'Не удалось загрузить список ключей витрин' };
    }
  });
}

export async function generateStorefrontKeyAction(input: z.infer<typeof GenerateKeySchema>) {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    const parsed = GenerateKeySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Невалидные параметры' };
    }

    const { tenantId, type, name } = parsed.data;

    try {
      const result = await StorefrontKeyService.generateKey(tenantId, type, name);

      await auditAdminAwaitable({
        adminId: staffUser.id,
        adminEmail: staffUser.email,
        action: 'STOREFRONT_KEY_CREATE',
        target: result.key.id,
        targetType: 'StorefrontKey',
        newValue: {
          tenantId,
          keyId: result.key.id,
          type,
          name,
          keyPrefix: result.key.keyPrefix,
        },
      });

      try {
        revalidatePath('/admin/settings');
      } catch {
        // non-request / test environment ignore
      }

      return {
        success: true,
        data: {
          token: result.token,
          key: {
            id: result.key.id,
            tenantId: result.key.tenantId,
            type: result.key.type as StorefrontKeyType,
            keyPrefix: result.key.keyPrefix,
            name: result.key.name,
            isActive: result.key.isActive,
            createdAt: result.key.createdAt.toISOString(),
          },
        },
      };
    } catch (error: any) {
      console.error('[StorefrontKeysAction] Failed to generate key:', error);
      return { success: false, error: 'Ошибка генерации ключа витрины' };
    }
  });
}

export async function revokeStorefrontKeyAction(input: z.infer<typeof RevokeKeySchema>) {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    const parsed = RevokeKeySchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Невалидные параметры' };
    }

    const { id, tenantId } = parsed.data;

    try {
      const existing = await db.storefrontKey.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return { success: false, error: 'Ключ не найден или уже удален' };
      }

      await db.storefrontKey.update({
        where: { id },
        data: { isActive: false },
      });

      await auditAdminAwaitable({
        adminId: staffUser.id,
        adminEmail: staffUser.email,
        action: 'STOREFRONT_KEY_REVOKE',
        target: id,
        targetType: 'StorefrontKey',
        newValue: {
          tenantId,
          keyId: id,
          keyPrefix: existing.keyPrefix,
          type: existing.type,
          isActive: false,
        },
      });

      try {
        revalidatePath('/admin/settings');
      } catch {
        // non-request / test environment ignore
      }

      return { success: true };
    } catch (error: any) {
      console.error('[StorefrontKeysAction] Failed to revoke key:', error);
      return { success: false, error: 'Не удалось отозвать ключ витрины' };
    }
  });
}
