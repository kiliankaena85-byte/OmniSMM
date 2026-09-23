'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { servicesLifecycleService } from '@/services/admin/services-lifecycle.service';
import type { CreateDraftInput, UpdateDraftInput, CustomerGroupInput } from '@/services/admin/services-lifecycle.service';
import { handleServerError } from '@/utils/error-handler';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export async function createServiceDraftAction(input: CreateDraftInput) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      const draft = await servicesLifecycleService.createDraft(input, {
        id: admin.id,
        email: admin.email,
        ip,
      });

      revalidatePath('/admin/catalog');
      revalidatePath('/admin/providers/import');

      return { success: true, draft };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function updateServiceDraftAction(draftId: string, input: UpdateDraftInput) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      const updated = await servicesLifecycleService.updateDraft(draftId, input, {
        id: admin.id,
        email: admin.email,
        ip,
      });

      revalidatePath('/admin/catalog');

      return { success: true, draft: updated };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function testServiceLinkAction(testUrl: string, targetType: string, draftId?: string, serviceId?: string) {
  return requireStaffPermission('catalog', 'view', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      const result = await servicesLifecycleService.testLink(testUrl, targetType, {
        id: admin.id,
        email: admin.email,
        ip,
      }, serviceId, draftId);

      return { success: true, result };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function promoteServiceToTestingAction(draftId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      const updated = await servicesLifecycleService.promoteToTesting(draftId, {
        id: admin.id,
        email: admin.email,
        ip,
      });

      revalidatePath('/admin/catalog');

      return { success: true, draft: updated };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function publishServiceDraftAction(draftId: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      const res = await servicesLifecycleService.publishDraft(draftId, {
        id: admin.id,
        email: admin.email,
        ip,
      });

      revalidatePath('/admin/catalog');
      revalidatePath('/admin/providers/import');

      return { success: true, serviceId: res.serviceId };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function archiveServiceAction(serviceId: string, reason: string) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      await servicesLifecycleService.archiveService(serviceId, reason, {
        id: admin.id,
        email: admin.email,
        ip,
      });

      revalidatePath('/admin/catalog');

      return { success: true };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function createCustomerGroupAction(data: CustomerGroupInput) {
  return requireStaffPermission('clients', 'edit', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      const group = await servicesLifecycleService.createCustomerGroup(data, {
        id: admin.id,
        email: admin.email,
        ip,
      });

      return { success: true, group };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function assignCustomerGroupAccessAction(
  serviceId: string,
  customerGroupIds: string[],
  customPricesRub?: Record<string, number>
) {
  return requireStaffPermission('catalog', 'edit', async (admin) => {
    try {
      const reqHeaders = await headers();
      const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || '127.0.0.1';

      const res = await servicesLifecycleService.assignCustomerGroupAccess(
        serviceId,
        customerGroupIds,
        customPricesRub,
        {
          id: admin.id,
          email: admin.email,
          ip,
        }
      );

      return { success: true, assignedCount: res.assignedCount };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}

export async function getServiceEditHistoryAction(query: { serviceId?: string; draftId?: string }) {
  return requireStaffPermission('catalog', 'view', async () => {
    try {
      const history = await servicesLifecycleService.getServiceEditHistory(query);
      return { success: true, history };
    } catch (e: unknown) {
      const err = handleServerError(e);
      return { success: false, error: err.message };
    }
  });
}
