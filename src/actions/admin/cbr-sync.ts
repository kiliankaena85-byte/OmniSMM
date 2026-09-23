'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { CBRRateService } from '@/services/system/cbr-rate.service';
import { auditAdminAwaitable } from '@/lib/admin-audit';
import { getClientIp } from '@/utils/ip';
import { revalidatePath } from 'next/cache';

import { normalizeTenantId } from '@/lib/tenant-resolver-edge';
import { cookies } from 'next/headers';

export async function syncCBRExchangeRateAction(tenantId?: string) {
  return await requireStaffPermission('settings', 'edit', async (admin) => {
    try {
      const cookieStore = await cookies();
      const cookieTenant = cookieStore.get('x_admin_tenant')?.value;
      const targetTenant = normalizeTenantId(tenantId || cookieTenant || admin.tenantId) || 'smmplan';

      const result = await CBRRateService.syncCBRExchangeRate(targetTenant);
      if (!result.updated) {
        return { 
          success: false as const, 
          error: 'Не удалось получить актуальные котировки с серверов ЦБ РФ. Курс оставлен без изменений.' 
        };
      }

      const ipAddress = await getClientIp();

      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'SYSTEM_SETTINGS_UPDATE',
        target: `exchangeRateUSD:${targetTenant}`,
        targetType: 'SYSTEM_SETTINGS',
        newValue: { 
          nominalRate: result.nominalRate, 
          systemRate: result.systemRate, 
          source: result.source || 'CBR_API' 
        },
        ipAddress
      });

      revalidatePath('/admin/settings');
      revalidatePath('/admin/catalog');
      return { 
        success: true as const, 
        rate: result.systemRate,
        nominalRate: result.nominalRate,
        source: result.source 
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return { success: false as const, error: errorMsg || 'Ошибка синхронизации с ЦБ РФ' };
    }
  });
}
