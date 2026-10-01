'use server';

import { LinkGuideService, ServiceLinkGuidePayload } from '@/services/catalog/link-guide.service';

/**
 * @public Server Action to get link guide for a specific service.
 * Accessible to all tenants (smmplan, flux, satellites).
 */
export async function getServiceLinkGuideAction(
  networkSlug?: string | null,
  categorySlug?: string | null,
  serviceName?: string | null
): Promise<{ success: boolean; data?: ServiceLinkGuidePayload; error?: string }> {
  try {
    const isTgViews = LinkGuideService.isTelegramViewsService(networkSlug, categorySlug, serviceName);
    if (!isTgViews) {
      return {
        success: true,
        data: {
          hasGuide: false,
          serviceType: 'GENERIC',
          title: '',
          devices: []
        }
      };
    }

    const payload = LinkGuideService.getTelegramPhotoViewsGuide();
    return {
      success: true,
      data: payload
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Ошибка загрузки подсказки';
    return { success: false, error: message };
  }
}
