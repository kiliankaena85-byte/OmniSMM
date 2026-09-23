'use server';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { verifySession } from '@/lib/session';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { db } from '@/lib/db';
import { adminCatalogService } from '@/services/admin/catalog.service';
import { catalogQueue } from '@/lib/queue-manager';
import { revalidatePath } from 'next/cache';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { z } from 'zod';
import { updateMarkupSchema, toggleServiceSchema, bulkUpdateMarkupSchema } from '@/validators/admin.validators';
import { auditAdmin } from '@/lib/admin-audit';

import { requireStaffPermission } from '@/lib/server/rbac';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function updateMarkupAction(formData: FormData) {
  const result = await requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = updateMarkupSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false, error: 'serviceId и markup обязательны' };
    const { serviceId, markup } = parsed.data;

    await adminCatalogService.updateMarkup(serviceId, markup, {
      id: admin.id,
      email: admin.email,
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'SERVICE_MARKUP_UPDATE',
      target: serviceId,
      targetType: 'SERVICE',
      newValue: { markup }
    });

    revalidatePath('/admin/catalog');
    return { success: true };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    return result;
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function toggleServiceAction(formData: FormData) {
  const result = await requireStaffPermission('catalog', 'edit', async (admin) => {
    const parsed = toggleServiceSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { success: false, error: 'Missing serviceId' };
    const { serviceId, isActive } = parsed.data;

    await adminCatalogService.toggleService(serviceId, isActive, {
      id: admin.id,
      email: admin.email,
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: isActive ? 'SERVICE_ENABLE' : 'SERVICE_DISABLE',
      target: serviceId,
      targetType: 'SERVICE',
    });

    revalidatePath('/admin/catalog');
    return { success: true };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    return result;
  }
  return result;
}

/**
 * Bulk update markup for all services in a category or platform.
 * Pass markup=0 to auto-calculate from Pricing Ladder.
 */
export async function bulkUpdateMarkupAction(formData: FormData) {
  const result = await requireStaffPermission('finance', 'edit', async (admin) => {
    const parsed = bulkUpdateMarkupSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) {
      return { success: false, error: 'Наценка должна быть в диапазоне 1.0–151.0' };
    }
    const { categoryId, platform, markup, tenantId } = parsed.data;

    const filter: { categoryId?: string; platform?: string; tenantId?: string } = {};
    if (categoryId) filter.categoryId = categoryId;
    if (platform) filter.platform = platform;
    if (tenantId) filter.tenantId = tenantId;

    // 🌊 WAVE 1.3: Background Catalog Processing
    // We send this to the BullMQ worker to prevent Vercel 15s timeout
    await catalogQueue.add('bulk-markup-bg', {
      type: 'BULK_MARKUP',
      filter,
      markupPercent: markup,
      admin: { id: admin.id, email: admin.email, role: admin.role }
    });

    auditAdmin({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'BULK_MARKUP_UPDATE',
      target: categoryId || platform || 'ALL',
      targetType: 'SERVICE',
      newValue: { markup, filter },
    });

    revalidatePath('/admin/catalog');
    return { success: true };
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    return result;
  }
  return result;
}

/**
 * Returns markup distribution analytics for the admin dashboard.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getMarkupAnalyticsAction() {
  const result = await requireStaffPermission('catalog', 'view', async () => {
    return adminCatalogService.getMarkupAnalytics();
  });

  if (result && typeof result === 'object' && 'success' in result && !result.success) {
    throw new Error(result.error);
  }
  return result;
}
