'use server';

import { requireStaffPermission } from '@/lib/server/rbac';
import { searchShadowServices, getLinkSpecification, ShadowServiceSearchResult, LinkSpecification } from '@/services/admin/smart-provider-matcher';

export async function searchShadowServicesAction(params: {
  query?: string;
  providerId?: string;
  platform?: string;
  targetType?: string;
  limit?: number;
}): Promise<{ success: boolean; items?: ShadowServiceSearchResult[]; error?: string }> {
  try {
    return await requireStaffPermission('CATALOG', 'view', async () => {
      const items = await searchShadowServices(params);
      return { success: true, items };
    });
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message || 'Ошибка поиска услуг провайдеров' };
  }
}

export async function getLinkSpecificationAction(params: {
  targetType: string;
  networkSlug?: string;
  activityType?: string;
}): Promise<{ success: boolean; spec?: LinkSpecification; error?: string }> {
  try {
    return await requireStaffPermission('CATALOG', 'view', async () => {
      const spec = getLinkSpecification(
        params.targetType,
        params.networkSlug || 'telegram',
        params.activityType || 'OTHER'
      );
      return { success: true, spec };
    });
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message || 'Ошибка получения параметров ссылки' };
  }
}
