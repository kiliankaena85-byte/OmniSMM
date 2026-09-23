import { logger } from './logger';

const log = logger.child({ component: 'CacheRevalidator' });

/**
 * Triggers a Next.js cache revalidation for the given tags.
 * This function is safe to call from background workers (BullMQ) or external scripts.
 * 
 * @param tags Array of Next.js cache tags to invalidate (e.g., ['catalog', 'services'])
 */
export async function triggerCacheRevalidation(tags: string[]): Promise<boolean> {
  const secret = process.env.INTERNAL_API_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';

  if (!secret) {
    log.warn('INTERNAL_API_SECRET is missing. Cache revalidation skipped. This is normal during build/dev, but critical in production.');
    return false;
  }

  try {
    const url = new URL('/api/internal/revalidate', baseUrl).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secret}`
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log.error(`Failed to revalidate tags: ${tags.join(', ')}. Status: ${response.status} ${response.statusText}`);
      return false;
    }

    log.info(`Successfully triggered cache revalidation for tags: ${tags.join(', ')}`);
    return true;
  } catch (error) {
    log.error(`Network error while trying to revalidate tags: ${tags.join(', ')}`, { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}
