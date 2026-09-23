/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Admin Catalog Cache Invalidation Helper — TASK 4
 */

import { revalidateTag } from 'next/cache';

/**
 * Invalidates public catalog cache tags upon admin mutations.
 */
export function revalidateCatalogCache(tenantId?: string) {
  try {
    revalidateTag('catalog', 'default');
    revalidateTag('services', 'default');
    if (tenantId) {
      revalidateTag(`catalog-${tenantId}`, 'default');
    } else {
      revalidateTag('catalog-smmplan', 'default');
      revalidateTag('catalog-flux', 'default');
    }
  } catch {
    // revalidateTag might throw if called outside Next.js request context during unit tests
  }
}
