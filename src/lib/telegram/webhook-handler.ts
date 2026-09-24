/**
 * (c) 2024-2026 SMMplan / OmniSMM 1.0. All rights reserved.
 * Centralized Multi-Tenant Telegram Webhook Handler.
 * Shared between dynamic route (/api/webhooks/telegram/[tenantId]) and legacy fallback (/api/webhooks/telegram).
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';
import { resolveTelegramWebhookSecret } from '@/lib/telegram/token-resolver';
import { sanitizeTenantSlug } from '@/lib/tenant-resolver-edge';
import { logTelegramError } from '@/lib/telegram/telegram-error-logger.service';

export interface TelegramWebhookDispatcher {
  handleWebhookUpdate(tenantId: string, update: unknown): Promise<{ success: boolean; error?: string }>;
}

let registeredDispatcher: TelegramWebhookDispatcher | null = null;

export function registerTelegramWebhookDispatcher(dispatcher: TelegramWebhookDispatcher): void {
  registeredDispatcher = dispatcher;
}

export function getRegisteredTelegramWebhookDispatcher(): TelegramWebhookDispatcher | null {
  return registeredDispatcher;
}

export async function handleTelegramWebhookRequest(
  req: NextRequest,
  targetTenantId?: string,
  customDispatcher?: TelegramWebhookDispatcher
): Promise<NextResponse> {
  const cleanTenant = sanitizeTenantSlug(targetTenantId);

  try {
    // 1. Fetch tenant-specific settings (or fallback for default tenant)
    let settings = await db.systemSettings.findUnique({
      where: { id: cleanTenant },
      select: {
        telegramWebhookSecret: true,
        telegramAllowedIps: true,
        telegramMaintenanceMode: true,
      },
    });

    if (!settings && cleanTenant === 'smmplan') {
      settings = await db.systemSettings.findFirst({
        select: {
          telegramWebhookSecret: true,
          telegramAllowedIps: true,
          telegramMaintenanceMode: true,
        },
      });
    }

    // 2. Maintenance Mode Guard
    if (settings?.telegramMaintenanceMode) {
      return NextResponse.json({ ok: false, error: 'Maintenance mode' }, { status: 503 });
    }

    // 3. Resolve & Verify HMAC Webhook Secret (OWASP A07 & Timing Attack Defense)
    const expectedSecret = await resolveTelegramWebhookSecret(cleanTenant);

    if (!expectedSecret) {
      console.error(
        `[TelegramWebhook] FATAL: TELEGRAM_WEBHOOK_SECRET is not configured for tenant "${cleanTenant}". Rejecting all requests.`
      );
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const providedToken = req.headers.get('x-telegram-bot-api-secret-token');
    if (!providedToken) {
      console.warn(`[Telegram Webhook] Unauthorized request for tenant "${cleanTenant}": missing secret token`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expected = Buffer.from(expectedSecret, 'utf8');
    const provided = Buffer.from(providedToken, 'utf8');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      console.warn(`[Telegram Webhook] Unauthorized request for tenant "${cleanTenant}": secret token mismatch`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 4. IP Allowlist Verification (if configured)
    if (settings?.telegramAllowedIps) {
      try {
        const allowedIps: string[] = JSON.parse(settings.telegramAllowedIps);
        if (Array.isArray(allowedIps) && allowedIps.length > 0) {
          const clientIp =
            req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip');
          if (clientIp && !allowedIps.includes(clientIp)) {
            console.warn(
              `[Telegram Webhook] Forbidden request for tenant "${cleanTenant}": IP ${clientIp} not in allowlist`
            );
            return NextResponse.json({ error: 'Forbidden IP' }, { status: 403 });
          }
        }
      } catch {
        /* ignore parsing errors */
      }
    }

    // 5. Parse and dispatch update via TelegramWebhookDispatcher
    const body = await req.json();
    const dispatcher = customDispatcher || registeredDispatcher;

    if (!dispatcher) {
      console.error(
        `[Telegram Webhook] FATAL: No TelegramWebhookDispatcher registered for tenant "${cleanTenant}". Rejecting update.`
      );
      return NextResponse.json({ error: 'Webhook dispatcher unavailable' }, { status: 503 });
    }

    const dispatchResult = await dispatcher.handleWebhookUpdate(cleanTenant, body);

    if (!dispatchResult.success) {
      console.error(
        `[Telegram Webhook] Dispatch error for tenant "${cleanTenant}":`,
        dispatchResult.error
      );
      return NextResponse.json(
        { error: dispatchResult.error || 'Failed to dispatch webhook update' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Telegram Webhook] Error processing update for tenant "${cleanTenant}":`, error);

    await logTelegramError({
      level: 'ERROR',
      source: 'webhook',
      errorMessage: errorMsg,
      stackTrace: error instanceof Error ? error.stack?.slice(0, 1000) : undefined,
      tenantId: cleanTenant,
    }).catch(() => {});

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
