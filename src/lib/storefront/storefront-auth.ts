import { NextRequest } from 'next/server';
import { StorefrontKeyService } from '@/services/storefront/storefront-key.service';
import { db } from '@/lib/db';

export interface StorefrontContext {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  keyType: 'publishable' | 'secret';
  rateLimit: number;
}

export async function resolveStorefrontContext(req: NextRequest): Promise<StorefrontContext | null> {
  // 1. Извлечение токена из заголовков (X-Storefront-Key или Authorization: Bearer)
  const headerKey = req.headers.get('x-storefront-key');
  const authHeader = req.headers.get('authorization');
  let token = headerKey;

  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  // 2. Аутентификация по ключу
  if (token) {
    const keyContext = await StorefrontKeyService.verifyKey(token);
    if (keyContext) {
      return keyContext;
    }
  }

  // 3. Fallback: аутентификация по кастомному домену (investor-store.ru)
  // Применима только для публичных запросов (keyType = publishable)
  const host = req.headers.get('host') || '';
  if (host) {
    // Учитываем порты в dev окружении
    const domain = host.split(':')[0].toLowerCase();
    
    // Исключаем локальные и стандартные домены платформы из fallback (должны использовать ключи)
    if (!domain.includes('localhost') && !domain.includes('127.0.0.1') && !domain.includes('smmplan') && !domain.includes('smmflux')) {
      const tenant = await db.tenant.findUnique({
        where: { customDomain: domain },
      });

      if (tenant && tenant.isActive) {
        return {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          tenantName: tenant.name,
          keyType: 'publishable',
          rateLimit: 60,
        };
      }
    }
  }

  return null;
}
