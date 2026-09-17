'use server';

import { db } from "@/lib/db";
import { requireStaffPermission } from "@/lib/server/rbac";
import { SettingsManager } from "@/lib/settings";
import { getClientIp } from "@/utils/ip";
import { auditAdminAwaitable } from "@/lib/admin-audit";

/**
 * Toggles the global mock test mode.
 */
export async function adminToggleTestMode(enable: boolean) {
  return requireStaffPermission('settings', 'edit', async (admin, _role, tenantId) => {
    const activeTenantId = tenantId || 'smmplan';
    const ipAddress = await getClientIp('unknown');
    const oldSettings = await db.systemSettings.findUnique({ where: { id: activeTenantId }, select: { isTestMode: true } });
    
    await SettingsManager.setTestMode(enable, activeTenantId);

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SYSTEM_TEST_MODE_TOGGLE',
      target: activeTenantId,
      targetType: 'SETTINGS',
      oldValue: oldSettings,
      newValue: { isTestMode: enable },
      ipAddress
    });

    return { success: true, message: `Режим тестирования для ${activeTenantId}: ${enable ? 'ВКЛ' : 'ВЫКЛ'}` };
  });
}

/**
 * Irreversibly deletes all data marked with the isTest flag.
 * This is the Nucleus Clear for the Mock Environment.
 */
export async function adminClearTestData() {
  return requireStaffPermission('settings', 'edit', async (admin, _role, tenantId) => {
    const activeTenantId = tenantId || 'smmplan';
    try {
      // Safe Delete: Only delete pure SANDBOX mock orders, NEVER delete live HYBRID or PRODUCTION orders!
      const resultOrders = await db.order.deleteMany({
        where: { 
          isTest: true,
          environmentMode: 'SANDBOX',
          tenantId: activeTenantId 
        }
      });

      
      const ipAddress = await getClientIp('unknown');
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'SYSTEM_TEST_DATA_CLEAR',
        target: activeTenantId,
        targetType: 'SETTINGS',
        newValue: { deletedOrdersCount: resultOrders.count },
        ipAddress
      });

      return { 
        success: true, 
        message: `Удалено ${resultOrders.count} тестовых заказов для бренда ${activeTenantId}.` 
      };
    } catch (e: unknown) {
      console.error("Failed to clear test data:", e);
      return { success: false, error: "Ошибка при очистке тестовых данных." };
    }
  });
}
