/**
 * BotCatalogService — Canonical Taxonomy and Visibility Service for Telegram Bot.
 * 
 * Synchronized with storefront taxonomy (AUD-05 / AUD-07):
 * - Hides empty networks (networks with no categories or no active, non-quarantined services).
 * - Hides empty categories.
 * - Filters out quarantined services (isQuarantined: false) and services in cooldown.
 * - Enforces tenant isolation (tenantVisibilityFilter).
 */

import { db } from '@/lib/db';
import { tenantVisibilityFilter } from '@/lib/tenant-scope';

export function botStorefrontCategoryFilter(tenantId: string) {
  const tenant = tenantVisibilityFilter(tenantId);
  return {
    tenantId: tenant,
    services: {
      some: {
        isActive: true,
        isQuarantined: false,
        tenantId: tenant,
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lt: new Date() } }]
      }
    }
  };
}

export class BotCatalogService {
  /**
   * Finds an active, non-empty network by detected platform slug or name.
   */
  static async findNetworkByPlatform(platform: string, tenantId: string = 'smmplan') {
    const normalized = (platform || '').toLowerCase().trim();
    if (!normalized || normalized === 'other') return null;

    const slugCandidates: string[] = [normalized];
    if (normalized === 'vk') slugCandidates.push('vkontakte');
    if (normalized === 'vkontakte') slugCandidates.push('vk');
    if (normalized === 'ok') slugCandidates.push('odnoklassniki');
    if (normalized === 'odnoklassniki') slugCandidates.push('ok');
    if (normalized === 'tg') slugCandidates.push('telegram');
    if (normalized === 'yt') slugCandidates.push('youtube');
    if (normalized === 'ig') slugCandidates.push('instagram');

    return await db.network.findFirst({
      where: {
        isActive: true,
        tenantId: tenantVisibilityFilter(tenantId),
        OR: [
          { slug: { in: slugCandidates } },
          { name: { in: slugCandidates, mode: 'insensitive' } }
        ],
        categories: {
          some: botStorefrontCategoryFilter(tenantId)
        }
      },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });
  }

  /**
   * Fetches only active networks that contain at least one visible category with active services.
   */
  static async getVisibleNetworks(tenantId: string = 'smmplan') {
    return await db.network.findMany({
      where: {
        isActive: true,
        tenantId: tenantVisibilityFilter(tenantId),
        categories: {
          some: botStorefrontCategoryFilter(tenantId)
        }
      },
      orderBy: { sort: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true
      }
    });
  }

  /**
   * Fetches only active categories in the given network that contain active, non-quarantined services.
   */
  static async getVisibleCategories(networkId: string, tenantId: string = 'smmplan') {
    return await db.category.findMany({
      where: {
        networkId,
        ...botStorefrontCategoryFilter(tenantId)
      },
      orderBy: { sort: 'asc' },
      select: {
        id: true,
        name: true,
        networkId: true
      }
    });
  }

  /**
   * Fetches only active, non-quarantined services for the given category.
   */
  static async getVisibleServices(categoryId: string, tenantId: string = 'smmplan') {
    return await db.service.findMany({
      where: {
        categoryId,
        isActive: true,
        isQuarantined: false,
        tenantId: tenantVisibilityFilter(tenantId),
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lt: new Date() } }]
      },
      orderBy: { rate: 'asc' },
      select: {
        id: true,
        numericId: true,
        name: true,
        rate: true,
        markup: true,
        providerCurrency: true,
        minQty: true,
        maxQty: true,
        isDripFeedEnabled: true,
        targetType: true,
        features: true
      }
    });
  }

  /**
   * Validates and returns full service details for starting an order.
   * Rejects quarantined, inactive, or mismatched tenant services.
   */
  static async getServiceForOrder(serviceId: string, tenantId: string = 'smmplan') {
    return await db.service.findFirst({
      where: {
        id: serviceId,
        isActive: true,
        isQuarantined: false,
        tenantId: tenantVisibilityFilter(tenantId),
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lt: new Date() } }]
      },
      include: {
        category: {
          include: {
            network: true
          }
        }
      }
    });
  }
}
