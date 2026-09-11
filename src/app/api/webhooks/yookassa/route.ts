interface YooKassaWebhookPayload {
  type?: string;
  event?: string;
  created_at?: string;
  object?: {
    id?: string;
    status?: string;
    paid?: boolean;
    amount?: {
      value?: string;
      currency?: string;
    };
    created_at?: string;
    metadata?: {
      paymentId?: string;
      userId?: string;
      orderId?: string;
      source?: string;
      [key: string]: unknown;
    };
    receipt_registration?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { paymentService } from '@/services/financial/payment.service';
import { db } from '@/lib/db';
import { MutexManager } from '@/lib/redis-lock';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { logger } from '@/lib/logger';

const MAX_BODY_SIZE = 1024 * 64; // 64KB

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function rubToKopecks(value: unknown): bigint {
  if (typeof value !== 'string') {
    throw new Error('INVALID_AMOUNT_FORMAT');
  }

  const normalized = value.trim();

  const decimalMatch = /^(\d+)\.(\d{2})$/.exec(normalized);
  if (decimalMatch) {
    return BigInt(decimalMatch[1]) * BigInt(100) + BigInt(decimalMatch[2]);
  }

  const integerMatch = /^(\d+)$/.exec(normalized);
  if (integerMatch) {
    return BigInt(integerMatch[1]) * BigInt(100);
  }

  throw new Error('INVALID_AMOUNT_FORMAT');
}

export async function POST(req: NextRequest) {
  try {
    const { getClientIp } = await import('@/utils/ip');
    const rawIp = await getClientIp();
    const ip = rawIp.replace(/^::ffff:/, '');

    const { SettingsProvider } = await import('@/lib/settings');
    const isTestMode = await SettingsProvider.isTestMode();

    const isDev = process.env.NODE_ENV === 'development';

    // --- SECURITY GUARD: Yookassa Official IP Range Validation ---
    const allowedPrefixes = [
      '185.75.120.', '185.75.121.', '185.75.122.', '185.75.123.',
      '37.110.12.', '37.110.13.', '37.110.14.', '37.110.15.',
      '37.110.16.', '37.110.17.', '37.110.18.', '37.110.19.',
      '193.106.92.', '193.106.93.', '193.106.94.', '193.106.95.',
      '91.232.108.', '91.232.109.', '91.232.110.', '91.232.111.'
    ];
    const isLocal = ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.0.0.');
    const isAllowedIp = (isDev || isTestMode) ? true : (allowedPrefixes.some(prefix => ip.startsWith(prefix)) || isLocal);
    
    if (!isAllowedIp) {
      console.error(`[YooKassa Webhook] BLOCKED: IP spoofing attempt from ${ip}`);
      await SecurityAlertService.record({
        event: 'SPOOFED_IP_WEBHOOK',
        severity: 'CRITICAL',
        ip,
        details: { gateway: 'yookassa' },
      });
      return NextResponse.json({ error: 'Unauthorized IP' }, { status: 403 });
    }

    const rawText = await req.text();
    if (rawText.length > MAX_BODY_SIZE) {
      console.warn('[Webhook] Oversized payload rejected');
      await SecurityAlertService.record({
        event: 'OVERSIZED_PAYLOAD',
        severity: 'WARNING',
        ip,
        details: { gateway: 'yookassa', size: rawText.length },
      });
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let rawBody: YooKassaWebhookPayload = {};
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const internalPaymentId = rawBody.object?.metadata?.paymentId;
    const gatewayId = rawBody.object?.id;
    const metadataTenantId = rawBody.object?.metadata?.tenantId as string | undefined;

    // Zero-Trust Database Resolution: determine tenant strictly from DB payment record first
    let webhookTenantId: string | undefined;
    if (internalPaymentId || gatewayId) {
      const p = await db.payment.findFirst({
        where: {
          OR: [
            ...(internalPaymentId ? [{ id: internalPaymentId }] : []),
            ...(gatewayId ? [{ gatewayId }] : [])
          ]
        },
        select: { tenantId: true }
      });
      if (p?.tenantId) webhookTenantId = p.tenantId;
    }
    webhookTenantId = webhookTenantId || metadataTenantId || 'smmplan';

    const { SettingsManager } = await import('@/lib/settings');
    const secrets = await SettingsManager.getPaymentSecrets(webhookTenantId);
    const expectedSecret = secrets.yookassaWebhookSecret || process.env.YOOKASSA_WEBHOOK_SECRET;

    const providedSignature = req.headers.get('x-sha256-signature') || req.headers.get('x-content-signature') || req.headers.get('digest');

    // --- SECURITY PROTOCOL (YooKassa Official Specification): ---
    // YooKassa delivers webhooks from official IP ranges (verified above) and does not require HMAC headers by default.
    // 1. If an HMAC signature IS provided by the sender, strictly verify it (reject on forgery/mismatch).
    // 2. Authenticity is double-checked by paymentService.confirmPayment via Active Pull directly querying https://api.yookassa.ru/v3/payments/{id}.
    if (providedSignature) {
      if (!expectedSecret) {
        console.error('[YooKassa] Webhook signature provided but secret is not configured on server (Fail-Closed)');
        return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
      }

      const crypto = (await import('crypto')).default;
      const expectedSig = crypto
        .createHmac('sha256', expectedSecret)
        .update(rawText, 'utf8')
        .digest('hex');

      const signatureHex = providedSignature.replace(/^sha256=/i, '');
      const HEX_REGEX = /^[0-9a-f]{64}$/i;

      if (!HEX_REGEX.test(signatureHex)) {
        await SecurityAlertService.record({
          event: 'INVALID_SIGNATURE_FORMAT',
          severity: 'CRITICAL',
          ip,
          details: { gateway: 'yookassa', signature: providedSignature },
        });
        return NextResponse.json({ error: 'Invalid signature format' }, { status: 403 });
      }

      if (!safeCompare(expectedSig, signatureHex)) {
        console.error('[YooKassa] HMAC signature mismatch — possible webhook forgery attempt');
        await SecurityAlertService.record({
          event: 'SIGNATURE_FAILED',
          severity: 'CRITICAL',
          ip,
          details: { gateway: 'yookassa' },
        });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
      }
    }
    
    const webhookCreatedAt = rawBody.object?.created_at || rawBody.created_at;
    if (webhookCreatedAt) {
      const webhookTime = new Date(webhookCreatedAt).getTime();
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      if (webhookTime < twentyFourHoursAgo) {
        await SecurityAlertService.record({
          event: 'REPLAY_ATTEMPT',
          severity: 'CRITICAL',
          ip,
          details: { gateway: 'yookassa', webhookTime, gatewayId: rawBody.object?.id },
        });
        return NextResponse.json({ error: 'Stale webhook rejected' }, { status: 400 });
      }
    }

    // --- ANTI-REPLAY GUARD (NIST SP 800-63B / PCI DSS v4.0.1) ---
    // Executed ONLY after authenticating signature and freshness
    const webhookEventId = (rawBody as Record<string, unknown>).id as string | undefined || 
      (gatewayId ? `yoo:${rawBody.event || 'evt'}:${gatewayId}:${rawBody.object?.status || 'status'}` : undefined);
    
    if (webhookEventId) {
      try {
        const { redis } = await import('@/lib/redis');
        const replayKey = `webhook:yoo:event:${webhookEventId}`;
        const isNew = await redis.set(replayKey, '1', 'EX', 86400, 'NX');
        if (!isNew) {
          logger.info('[YooKassa Webhook] Idempotent duplicate event bypassed', { webhookEventId });
          return NextResponse.json({ success: true, duplicate: true });
        }
      } catch (redisErr) {
        if (process.env.NODE_ENV === 'production') {
          console.error('[YooKassa Webhook] Fail-Closed: Redis Anti-Replay Guard unreachable:', redisErr);
          return NextResponse.json({ error: 'Anti-Replay Guard service unavailable' }, { status: 503 });
        }
        // Dev/test fallback
        console.warn('[YooKassa Webhook] Dev/test mode: Redis unreachable, proceeding with DB lock.');
      }
    }

    if (rawBody.event === 'payment.succeeded' && rawBody.object) {
      const gatewayId = rawBody.object.id;
      if (typeof gatewayId !== 'string' || gatewayId.trim().length === 0) {
        console.error('[YooKassa Webhook] Missing or invalid gatewayId');
        return NextResponse.json({ error: 'Invalid gatewayId' }, { status: 400 });
      }

      const currency = String(rawBody.object.amount?.currency || '').toUpperCase();
      if (currency !== 'RUB') {
        console.error(`[YooKassa Webhook] Invalid currency: ${currency}`);
        return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
      }

      let amountCents: bigint;
      try {
        amountCents = rubToKopecks(rawBody.object.amount?.value);
      } catch {
        console.error('[YooKassa Webhook] Failed to parse amount via rubToKopecks');
        return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
      }
      
      const userId = rawBody.object.metadata?.userId;
      const internalPaymentId = rawBody.object.metadata?.paymentId;
      const metadataType = typeof rawBody.object.metadata?.type === "string" ? rawBody.object.metadata.type : undefined;

      const receiptId = rawBody.object.receipt_registration === 'succeeded' 
        ? `yookassa_receipt_${gatewayId}` 
        : undefined;

      if (!userId) {
        return NextResponse.json({ error: 'Missing userId in metadata' }, { status: 400 });
      }

      try {
        const result = await MutexManager.withLock(`webhook_payment_${gatewayId}`, 15000, 10000, async () => {
          let existingPayment = null;
          if (internalPaymentId) {
            existingPayment = await db.payment.findUnique({ where: { id: internalPaymentId } });
          }
          if (!existingPayment && gatewayId) {
            existingPayment = await db.payment.findUnique({ where: { gatewayId } });
          }
          if (existingPayment && existingPayment.status === 'SUCCEEDED') {
            console.info(`[YooKassa Webhook] Payment ${existingPayment.id} already processed (idempotency hit)`);
            return NextResponse.json({ success: true, status: 'Payment processed strictly (idempotent)' }, { status: 200 });
          }

          const success = await paymentService.confirmPayment(
            gatewayId, amountCents, userId, isTestMode, 'yookassa', internalPaymentId, metadataType, receiptId
          );

          if (success) {
            // Webhook Latency & Health Analytics
            if (existingPayment?.createdAt) {
              const latencySec = Math.round((Date.now() - new Date(existingPayment.createdAt).getTime()) / 1000);
              if (latencySec > 900) { // > 15 minutes lag
                import('@/lib/notifications').then(async ({ sendAdminAlert }) => {
                  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
                  const email = user?.email || 'неизвестен';
                  const maskedEmail = email.includes('@')
                    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(4, b.length))}${c}`)
                    : email;
                  sendAdminAlert(
                    `⏱️ <b>[Платёжный шлюз] Задержка вебхука ЮKassa</b>\n\n• Платеж: <code>${existingPayment.id}</code>\n• Клиент: <code>${maskedEmail}</code>\n• Сумма: <b>${(Number(amountCents) / 100).toFixed(2)} ₽</b>\n• Задержка доставки: <b>${Math.round(latencySec / 60)} мин</b>\n• Статус: <b>Успешно зачислено</b>`,
                    'WARNING'
                  );
                }).catch(err => console.error('[YooKassa Webhook] Latency alert failed', err));
              }
            }

            const LARGE_PAYMENT_THRESHOLD = BigInt(50_000_00);
            if (amountCents >= LARGE_PAYMENT_THRESHOLD) {
              import('@/lib/notifications').then(async ({ sendAdminAlert }) => {
                const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
                const email = user?.email || userId;
                const formattedRub = (Number(amountCents) / 100).toLocaleString('ru-RU');
                sendAdminAlert(
                  `💰 Large payment: ${formattedRub} ₽ from ${email}`,
                  'INFO'
                );
              }).catch(err => console.error('[YooKassa Webhook] Large payment alert failed', err));
            }
            return NextResponse.json({ success: true, status: 'Payment processed strictly' }, { status: 200 });
          } else {
            return NextResponse.json({ error: 'Payment double-check validation failed' }, { status: 400 });
          }
        });
        
        return result;
      } catch (lockError) {
        console.error(`[YooKassa Webhook] Failed to acquire lock for payment ${gatewayId}:`, lockError);
        return NextResponse.json({ error: 'Concurrent processing lock timeout' }, { status: 429 });
      }
    }

    return NextResponse.json({ status: 'Ignored unsupported event' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Webhook error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
