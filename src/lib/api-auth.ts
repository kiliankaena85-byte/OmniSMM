import { db } from './db';
import { User } from '@prisma/client';
import crypto from 'crypto';
import { normalizeTenantId, resolveContourFromHost, type ContourId } from './tenant-resolver-edge';

export async function verifyAPIKey(
  key?: string | null, 
  requiredTenantId?: string | null,
  requiredContour?: ContourId | null
): Promise<User | null> {
  if (!key || key.length < 10) return null;

  try {
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
    const user = await db.user.findFirst({
      where: { 
        apiKeyHash: hashedKey,
        isActive: true,
        isDeleted: false,
        role: { not: 'BANNED' }
      }
    });

    if (!user) return null;

    if (requiredTenantId) {
      const normRequired = normalizeTenantId(requiredTenantId);
      const normUserTenant = normalizeTenantId(user.tenantId);
      if (normRequired && normUserTenant && normRequired !== normUserTenant) {
        console.warn(`[verifyAPIKey] Cross-tenant API key rejected: user tenant "${normUserTenant}" vs required "${normRequired}"`);
        return null;
      }
    }

    if (requiredContour === 'prod') {
      // Production contour strictly rejects test/pentest accounts (F-7.3)
      if (user.email.includes('pentest') || user.email.includes('test_')) {
        console.warn(`[verifyAPIKey] Test account "${user.email}" rejected on production contour`);
        return null;
      }
    }

    return user;
  } catch (error) {
    console.error('API Auth Error:', error);
    return null;
  }
}
