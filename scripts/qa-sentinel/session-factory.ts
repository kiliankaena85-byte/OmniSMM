/**
 * scripts/qa-sentinel/session-factory.ts
 *
 * Фабрика криптографически подписанных сессий JWT для различных ролей в OmniSMM 1.0.
 */

import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { getEncodedKey } from '../../src/lib/session-edge';
import { UserRole } from './types';

const prisma = new PrismaClient();

export interface TestSessionResult {
  role: UserRole;
  tenantId: string;
  token: string;
  userId: string;
}

/**
 * Создание или получение пользователя под роль и генерация сессионного JWT
 */
export async function createOrGetTestSession(role: UserRole, tenantId: string = 'smmplan'): Promise<string | null> {
  if (role === 'GUEST') {
    return null;
  }

  try {
    const prismaRole = role === 'OWNER' ? 'OWNER' : role === 'SUPPORT' ? 'SUPPORT' : 'USER';

    // 1. Поиск существующего пользователя
    let user = await prisma.user.findFirst({
      where: {
        role: prismaRole as any,
        tenantId,
        isActive: true,
      },
    });

    // 2. Если пользователь не найден — создаем временного тестового
    if (!user) {
      const email = `qa_sentinel_${tenantId}_${role.toLowerCase()}_${Date.now()}@smmplan.pro`;
      user = await prisma.user.create({
        data: {
          email,
          role: prismaRole as any,
          tenantId,
          balance: 500000n, // 5 000 руб
          isActive: true,
        },
      });
    }

    // 3. Создаем сессию в базе
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt,
        userAgent: 'Omni-Sentinel-QA-Agent',
        ipAddress: '127.0.0.1',
      },
    });

    // 4. Подписываем токен HS256
    const token = await new SignJWT({
      sessionId: session.id,
      userId: user.id,
      canResetPassword: false,
      role: prismaRole,
      tenantId,
      contour: 'test',
      sessionVer: 1,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(getEncodedKey());

    return token;
  } catch (err: any) {
    console.warn(`   ⚠️ [Session Warning] Unable to generate DB session for role ${role}: ${err.message}. Proceeding with guest/fallback.`);
    return null;
  }
}
