/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * TelegramErrorLogService — Level 1 (Services) persistence of Telegram bot/webhook errors.
 *
 * Shared by the webhook handler (Application layer) and admin Server Actions.
 * Must NOT import 'use server' modules or anything from src/actions, src/bot, src/app.
 */

import { db } from '@/lib/db';
import { normalizeTenantId } from '@/lib/tenant-resolver-edge';

export interface TelegramErrorLogParams {
  level: 'ERROR' | 'WARN' | 'FATAL';
  source: 'webhook' | 'polling' | 'command' | 'callback_query' | 'scene';
  errorCode?: string;
  errorMessage: string;
  stackTrace?: string;
  updateData?: string;
  userId?: string;
  chatId?: string;
}

const DEDUP_WINDOW_MS = 3_600_000;

function generateCuid2(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const timestamp = Math.floor(Date.now() / 1000).toString(36);
  let random = '';
  for (let i = 0; i < 16; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${timestamp}${random}`;
}

export const TelegramErrorLogService = {
  /**
   * Records (or de-duplicates within 1h) a Telegram error for an explicit tenant.
   * Never throws: logging failures must not break the webhook/bot flow.
   */
  async log(tenantId: string, params: TelegramErrorLogParams): Promise<void> {
    const cleanTenant = (normalizeTenantId(tenantId) as string) || 'smmplan';
    try {
      const oneHourAgo = new Date(Date.now() - DEDUP_WINDOW_MS);
      const existing = await db.telegramErrorLog.findFirst({
        where: {
          tenantId: cleanTenant,
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
        await db.telegramErrorLog.create({
          data: { id: generateCuid2(), tenantId: cleanTenant, ...params },
        });
      }
    } catch (err) {
      console.error('[TelegramErrorLog] Failed to log error:', err);
    }
  },
};
