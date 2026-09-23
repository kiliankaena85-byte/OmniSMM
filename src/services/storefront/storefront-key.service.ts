import crypto from 'crypto';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'StorefrontKeyService' });

export type StorefrontKeyType = 'PUBLISHABLE' | 'SECRET';

export class StorefrontKeyService {
  /**
   * Генерация нового ключа витрины
   */
  static async generateKey(tenantId: string, type: StorefrontKeyType, name?: string) {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = type === 'PUBLISHABLE' ? 'pk_live_' : 'sk_live_';
    const fullToken = `${prefix}${rawKey}`;
    
    const keyHash = crypto.createHash('sha256').update(fullToken).digest('hex');
    const keyPrefixVisual = fullToken.substring(0, 16);

    const keyRecord = await db.storefrontKey.create({
      data: {
        tenantId,
        type,
        keyPrefix: keyPrefixVisual,
        keyHash,
        name: name || `${type} Key`,
      },
    });

    log.info(`Generated new StorefrontKey`, { tenantId, type, keyId: keyRecord.id });

    return {
      token: fullToken,
      key: keyRecord,
    };
  }

  /**
   * Проверка и резолвинг ключа
   */
  static async verifyKey(token: string) {
    if (!token || (!token.startsWith('pk_live_') && !token.startsWith('sk_live_'))) {
      return null;
    }

    const keyHash = crypto.createHash('sha256').update(token).digest('hex');

    const keyRecord = await db.storefrontKey.findUnique({
      where: { keyHash },
      include: { tenant: true },
    });

    if (!keyRecord || !keyRecord.isActive || !keyRecord.tenant.isActive) {
      return null;
    }

    // Fire and forget updating lastUsedAt
    db.storefrontKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    }).catch((err: any) => log.error('Failed to update lastUsedAt for StorefrontKey', { err: err?.message }));

    return {
      tenantId: keyRecord.tenantId,
      tenantSlug: keyRecord.tenant.slug,
      tenantName: keyRecord.tenant.name,
      keyType: keyRecord.type.toLowerCase() as 'publishable' | 'secret',
      rateLimit: keyRecord.type === 'PUBLISHABLE' ? 60 : 120, // Strict limit for public keys
    };
  }

  /**
   * Отзыв ключа
   */
  static async revokeKey(id: string, tenantId: string) {
    const keyRecord = await db.storefrontKey.findFirst({
      where: { id, tenantId },
    });

    if (!keyRecord) throw new Error('Key not found');

    await db.storefrontKey.update({
      where: { id },
      data: { isActive: false },
    });

    log.info(`Revoked StorefrontKey`, { tenantId, keyId: id });
    return true;
  }
}
