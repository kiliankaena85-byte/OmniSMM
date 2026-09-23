'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { globalSettingsSchema } from '@/validators/admin.validators';
import { db } from '@/lib/db';
import { settingsService } from '@/services/admin/settings.service';
import { SettingsProvider } from '@/lib/settings';
import { catalogQueue } from '@/lib/queue-manager';
import { getClientIp } from '@/utils/ip';
import {
  validateSettingsSecurity,
  mapSettingsFormData,
  dispatchSettingsAlerts,
  logSettingsAudit,
} from './helpers';

// ── System Settings Update ──
export async function updateGlobalSettings(formData: FormData) {
  if (!formData || typeof formData.entries !== 'function') {
    return { success: false, errors: { _form: ['Некорректные данные формы'] } };
  }

  const result = await requireStaffPermission('settings', 'edit', async (user) => {
    const parsed = globalSettingsSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return {
        success: false as const,
        errors: parsed.error.flatten().fieldErrors,
      };
    }

    // ── CRITICAL: Resolve active tenantId from formData or x-tenant-id header ──
    const formTenant = formData.get('tenantId') as string | null;
    const headerTenant = await SettingsProvider.getTenantId();
    const activeTenantId = (formTenant && formTenant.trim()) || headerTenant || 'smmplan';

    // 1. Security & RBAC Guard
    const securityCheck = await validateSettingsSecurity(parsed.data, formData, user.role);
    if (!securityCheck.success) {
      return {
        success: false as const,
        errors: securityCheck.errors,
      };
    }

    const oldSettings = await db.systemSettings.findUnique({ where: { id: activeTenantId } });

    // 2. Form Mapping to Prisma Input
    const { dataToUpdate, isRateChanged, finalExchangeRate } = await mapSettingsFormData(
      formData,
      parsed.data,
      oldSettings
    );

    // 3. Database Persistence
    await settingsService.updateSystemSettings(
      dataToUpdate as Parameters<typeof settingsService.updateSystemSettings>[0],
      activeTenantId
    );

    // 4. Background Price Sync (if exchange rate changed)
    if (isRateChanged && finalExchangeRate) {
      try {
        await catalogQueue.add('sync-prices-bg', { type: 'SYNC_PRICES', usdToRub: finalExchangeRate });
      } catch (err) {
        console.error('[SettingsAction] Failed to enqueue background price sync:', err);
      }
    }

    // 5. Audit Logging (with sensitive key masking)
    const ipAddress = await getClientIp();
    await logSettingsAudit({
      adminId: user.id,
      adminEmail: user.email,
      activeTenantId,
      dataToUpdate,
      oldSettings,
      ipAddress,
    });

    // 6. Dispatch Realtime Admin Alerts & Bot Invalidation
    await dispatchSettingsAlerts({
      activeTenantId,
      userEmail: user.email,
      ipAddress,
      dataToUpdate,
      oldSettings,
      isRateChanged,
      finalExchangeRate,
    });

    // 7. Cache Revalidation
    try {
      const { revalidateTag, revalidatePath } = (await import('next/cache')) as unknown as {
        revalidateTag: (tag: string) => unknown;
        revalidatePath: (path: string, type?: 'layout' | 'page') => unknown;
      };
      revalidateTag('settings');
      revalidateTag(`settings-${activeTenantId}`);
      revalidatePath('/admin/settings');
      revalidatePath('/', 'layout');
    } catch (revalErr) {
      console.warn('[settings] Cache revalidation warning in action:', revalErr);
    }

    return {
      success: true as const,
      message: 'Настройки успешно сохранены',
    };
  });

  return result;
}
