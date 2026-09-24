/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Centralized Telegram Error Logger Service (Services Layer).
 * Clean Architecture compliant: zero dependencies on Application layer (actions/bot).
 */

import { db } from '@/lib/db';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export function generateCuid2(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const timestamp = Math.floor(Date.now() / 1000).toString(36);
  let random = '';
  for (let i = 0; i < 16; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${timestamp}${random}`;
}

export interface TelegramErrorLogParams {
  level: 'ERROR' | 'WARN' | 'FATAL';
  source: 'webhook' | 'polling' | 'command' | 'callback_query' | 'scene';
  errorCode?: string;
  errorMessage: string;
  stackTrace?: string;
  updateData?: string;
  userId?: string;
  chatId?: string;
  tenantId?: string;
}

export async function logTelegramError(params: TelegramErrorLogParams): Promise<void> {
  try {
    let tenantId = params.tenantId;
    if (!tenantId) {
      try {
        const { headers: getHeaders } = await import('next/headers');
        const reqHeaders = await getHeaders();
        const headerTenant = reqHeaders.get('x-tenant-id');
        if (headerTenant) tenantId = (normalizeTenantId(headerTenant) as string) || 'smmplan';
      } catch {
        // Outside request context
      }
    }
    const resolvedTenant = normalizeTenantId(tenantId) || 'smmplan';
    const oneHourAgo = new Date(Date.now() - 3600000);
    const existing = await db.telegramErrorLog.findFirst({
      where: {
        tenantId: resolvedTenant,
        errorCode: params.errorCode || null,
        source: params.source,
        isResolved: false,
        lastSeenAt: { gte: oneHourAgo },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (existing) {
      await db.telegramErrorLog.update({
        where: { id: existing.id },
        data: {
          occurrenceCount: { increment: 1 },
          lastSeenAt: new Date(),
          ...(params.level === 'FATAL' && { level: 'FATAL' }),
        },
      });
    } else {
      const id = generateCuid2();
      await db.telegramErrorLog.create({
        data: {
          id,
          tenantId: resolvedTenant,
          level: params.level,
          source: params.source,
          errorCode: params.errorCode,
          errorMessage: params.errorMessage,
          stackTrace: params.stackTrace,
          updateData: params.updateData,
          userId: params.userId,
          chatId: params.chatId,
        },
      });
    }
  } catch (err) {
    console.error('[TelegramErrorLog] Failed to log error:', err);
  }
}
