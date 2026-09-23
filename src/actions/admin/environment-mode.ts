'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { SettingsManager, type EnvironmentMode } from '@/lib/settings';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { revalidatePath } from 'next/cache';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { cookies } from 'next/headers';

export async function getEnvironmentModeAction(tenantId?: string) {
  return requireStaffPermission('settings', 'view', async (staffUser) => {
    try {
      const cookieStore = await cookies();
      const cookieTenant = cookieStore.get('x_admin_tenant')?.value;
      const targetTenant = normalizeTenantId(tenantId || cookieTenant || staffUser.tenantId) || 'smmplan';

      const mode = await SettingsManager.getEnvironmentMode(targetTenant);
      const isMockPayment = await SettingsManager.isMockPaymentEnabled(targetTenant);
      const isMockProvider = await SettingsManager.isMockProviderEnabled(targetTenant);
      return {
        success: true,
        mode,
        isMockPayment,
        isMockProvider
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Не удалось получить режим окружения'
      };
    }
  });
}

export async function setEnvironmentModeAction(input: {
  mode: EnvironmentMode;
  tenantId?: string;
}) {
  return requireStaffPermission('settings', 'edit', async (staffUser) => {
    try {
      const validModes: EnvironmentMode[] = ['SANDBOX', 'HYBRID', 'ACQUIRING_TEST', 'PRODUCTION'];
      if (!validModes.includes(input.mode)) {
        return { success: false, error: 'Некорректный режим окружения' };
      }

      const cookieStore = await cookies();
      const cookieTenant = cookieStore.get('x_admin_tenant')?.value;
      const targetTenant = normalizeTenantId(input.tenantId || cookieTenant || staffUser.tenantId) || 'smmplan';

      const oldMode = await SettingsManager.getEnvironmentMode(targetTenant);
      await SettingsManager.setEnvironmentMode(input.mode, targetTenant);

      await auditAdminAwaitable({
        adminId: staffUser.id,
        adminEmail: staffUser.email,
        action: 'ENVIRONMENT_MODE_CHANGED',
        target: `SYSTEM_SETTINGS:${targetTenant}`,
        targetType: 'SETTINGS',
        oldValue: { mode: oldMode, tenantId: targetTenant },
        newValue: { mode: input.mode, tenantId: targetTenant }
      });

      // Crucial: Invalidate Next.js Server Components layout cache
      revalidatePath('/admin', 'layout');
      revalidatePath('/', 'layout');

      return {
        success: true,
        mode: input.mode,
        message: `Режим окружения успешно переключен на ${input.mode}`
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Ошибка смены режима окружения'
      };
    }
  });
}
