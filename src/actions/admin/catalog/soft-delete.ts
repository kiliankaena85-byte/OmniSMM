'use server';

/**
 * Soft Delete Service Action — Sprint 1.8
 *
 * Archives a service (isActive=false, [ARCHIVED] prefix).
 * Does not hard-delete — preserves full order history integrity.
 */

import { requireStaffPermission } from '@/lib/server/rbac';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { auditAdminAwaitable } from '@/lib/admin-audit';

const serviceIdSchema = z.string().min(1);

export async function softDeleteServiceAction(serviceId: string) {
  return requireStaffPermission('CATALOG', 'edit', async (admin) => {
    const id = serviceIdSchema.safeParse(serviceId);
    if (!id.success) {
      return { success: false as const, error: 'Неверный ID услуги' };
    }

    await adminCatalogService.softDeleteService(id.data, {
      id: admin.id,
      email: admin.email,
    });

    await auditAdminAwaitable({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_ARCHIVE',
      target: id.data,
      targetType: 'SERVICE'
    });

    revalidatePath('/admin/catalog');
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    return { success: true as const };
  });
}
