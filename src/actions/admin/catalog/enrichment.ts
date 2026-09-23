'use server';

import { requireStaffPermission } from "@/lib/server/rbac";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getClientIp } from "@/utils/ip";
import { auditAdminAwaitable } from "@/lib/admin-audit";
import { handleServerError } from "@/utils/error-handler";

export async function updateServiceDescription(serviceId: string, description: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    try {
      await db.service.update({
        where: { id: serviceId },
        data: { description },
      });

      const ipAddress = await getClientIp('unknown');

      // Log the action
      await auditAdminAwaitable({
        adminId: admin.id,
        adminEmail: admin.email,
        action: "UPDATE_SERVICE_DESCRIPTION",
        target: serviceId,
        targetType: "SERVICE",
        newValue: { description },
        ipAddress
      });

      revalidatePath("/admin/catalog/enrichment");
      return { success: true };
    } catch (error: unknown) {
      console.error("Failed to update service description:", error);
      return { success: false, error: handleServerError(error).message };
    }
  });
}
