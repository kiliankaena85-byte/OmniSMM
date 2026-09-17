export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { paymentService } from '@/services/financial/payment.service';
import { SettingsManager } from '@/lib/settings';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { MutexManager } from '@/lib/redis-lock';

const MAX_BODY_SIZE = 1024 * 64; // 64KB

export async function POST(request: NextRequest) {
  try {
    const { getClientIp } = await import('@/utils/ip');
    const ip = await getClientIp();

    const signature = request.headers.get('crypto-pay-api-signature');
    if (!signature) {
      await SecurityAlertService.record({
        event: 'MISSING_SIGNATURE',
        severity: 'CRITICAL',
        ip,
        details: { gateway: 'cryptobot' },
      });
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const payload = await request.text();
    if (payload.length > MAX_BODY_SIZE) {
      console.warn('[Webhook] Oversized payload rejected');
      await SecurityAlertService.record({
        event: 'OVERSIZED_PAYLOAD',
        severity: 'WARNING',
        ip,
        details: { gateway: 'cryptobot', size: payload.length },
      });
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let data: any = {};
    try {
      data = JSON.parse(payload);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const rawPayload = data.payload?.payload;
    let internalPaymentId: string | undefined = typeof rawPayload === 'string' ? rawPayload : undefined;
    let payloadTenantId: string | undefined;

    if (internalPaymentId && (internalPaymentId.startsWith('{') || internalPaymentId.startsWith('['))) {
      try {
        const parsed = JSON.parse(internalPaymentId);
        if (parsed.paymentId) internalPaymentId = parsed.paymentId;
        if (parsed.tenantId) payloadTenantId = parsed.tenantId;
      } catch {
        // Keep raw internalPaymentId
      }
    }

    if (!internalPaymentId && data.payload?.invoice_id) {
      internalPaymentId = data.payload.invoice_id.toString();
    }

    let resolvedTenantId = payloadTenantId || 'smmplan';
    if (internalPaymentId) {
      const p = await db.payment.findFirst({
        where: {
          OR: [
            { id: internalPaymentId },
            { gatewayId: String(internalPaymentId) }
          ]
        },
        select: { tenantId: true }
      });
      if (p?.tenantId) resolvedTenantId = p.tenantId;
    }

    const isTestMode = await SettingsManager.isTestMode(resolvedTenantId);
    const secrets = await SettingsManager.getPaymentSecrets(resolvedTenantId);
    const CRYPTO_BOT_TOKEN = secrets.cryptoBotToken;
    if (!CRYPTO_BOT_TOKEN) {
      console.error(`[Webhook] FATAL: CryptoBot token is not configured in SystemSettings for [${resolvedTenantId}]. Rejecting.`);
      return NextResponse.json({ error: 'CryptoBot webhook not configured' }, { status: 503 });
    }

    const secret = crypto.createHash('sha256').update(CRYPTO_BOT_TOKEN).digest();
    const checkString = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const HEX_REGEX = /^[0-9a-f]{64}$/i;
    if (!HEX_REGEX.test(signature)) {
      await SecurityAlertService.record({
        event: 'INVALID_SIGNATURE_FORMAT',
        severity: 'CRITICAL',
        ip,
        details: { gateway: 'cryptobot', signature },
      });
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 403 });
    }

    const expectedBuf = Buffer.from(checkString, 'hex');
    const providedBuf = Buffer.from(signature, 'hex');

    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
       console.error('[Webhook] Invalid CryptoBot signature');
       await SecurityAlertService.record({
         event: 'SIGNATURE_FAILED',
         severity: 'CRITICAL',
         ip,
         details: { gateway: 'cryptobot' },
       });
       return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
    
    // --- ANTI-REPLAY GUARD (NIST SP 800-63B / PCI DSS v4.0.1) ---
    const updateId = data.update_id;
    if (updateId !== undefined && updateId !== null) {
      try {
        const { redis } = await import('@/lib/redis');
        const replayKey = `webhook:crypto:event:${updateId}`;
        const isNew = await redis.set(replayKey, '1', 'EX', 86400, 'NX');
        if (!isNew) {
          console.info(`[CryptoBot Webhook] Idempotent duplicate event bypassed: ${updateId}`);
          return NextResponse.json({ ok: true, duplicate: true });
        }
      } catch (redisErr) {
        if (process.env.NODE_ENV === 'production') {
          console.error('[CryptoBot Webhook] Fail-Closed: Redis Anti-Replay Guard unreachable:', redisErr);
          return NextResponse.json({ error: 'Anti-Replay Guard service unavailable' }, { status: 503 });
        }
        console.warn('[CryptoBot Webhook] Dev/test mode: Redis unreachable, proceeding with DB lock.');
      }
    }

    // Replay protection (30 minutes window)
    const webhookCreatedAt = data.payload?.paid_at || data.payload?.created_at;
    if (webhookCreatedAt) {
      const webhookTime = new Date(webhookCreatedAt).getTime();
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      if (webhookTime < thirtyMinutesAgo) {
         await SecurityAlertService.record({
           event: 'REPLAY_ATTEMPT',
           severity: 'CRITICAL',
           ip,
           details: { gateway: 'cryptobot', webhookTime, gatewayId: data.payload?.invoice_id },
         });
         return NextResponse.json({ error: 'Stale webhook rejected' }, { status: 400 });
      }
    }

    // We only care about successfully paid invoices
    if (data.update_type === 'invoice_paid') {
      const invoice = data.payload;

      const invoiceIdNum = Number(invoice?.invoice_id);
      if (!invoice || isNaN(invoiceIdNum) || invoiceIdNum <= 0) {
        console.error('[Crypto Webhook] Invalid or missing invoice_id');
        return NextResponse.json({ error: 'Invalid invoice_id' }, { status: 400 });
      }

      const fiatCurrency = String(invoice.fiat_currency || invoice.paid_asset || 'RUB').toUpperCase();
      if (fiatCurrency !== 'RUB') {
        console.error(`[Crypto Webhook] Rejected unsupported fiat currency: ${fiatCurrency}`);
        return NextResponse.json({ error: 'Unsupported fiat currency' }, { status: 400 });
      }
      
      // BUG-008 FIX: Parse JSON payload (new format) or fall back to plain paymentId (legacy)
      let paymentId: string;
      let metadataType: string | undefined;
      try {
        const parsed = JSON.parse(invoice.payload);
        paymentId = parsed.paymentId;
        metadataType = parsed.type;
      } catch (err) {
        console.warn('[Crypto Webhook] JSON parse failed, falling back to raw payload:', err);
        // Legacy format: payload is just the paymentId string
        paymentId = invoice.payload;
      }

      const gatewayId = invoice.invoice_id.toString();

      try {
        const result = await MutexManager.withLock(`webhook_payment_crypto_${gatewayId}`, 15000, 10000, async () => {
          const payment = await db.payment.findFirst({
            where: {
              OR: [
                ...(paymentId ? [{ id: paymentId }] : []),
                { gatewayId }
              ]
            }
          });
          
          if (!payment) {
             console.error(`[Webhook] Payment record not found for payload ${paymentId} / gateway ${gatewayId}`);
             return NextResponse.json({ error: 'Payment context missing' }, { status: 400 });
          }

          if (payment.status === 'SUCCEEDED') {
             console.info(`[CryptoBot Webhook] Payment ${payment.id} already processed (idempotency hit)`);
             return NextResponse.json({ ok: true, duplicate: true });
          }

          const currency = String(payment.currency || '').toUpperCase();
          if (currency !== 'RUB' && currency !== 'USD') {
            console.error(`[CryptoBot Webhook] Invalid currency: ${currency}`);
            return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
          }

          // Strict Integer parsing from exact paid_fiat_amount string (no float multiplication!)
          if (typeof invoice.paid_fiat_amount !== 'string' && typeof invoice.paid_fiat_amount !== 'number') {
            console.error('[Crypto Webhook] Missing paid_fiat_amount in payload');
            return NextResponse.json({ error: 'Missing paid_fiat_amount' }, { status: 400 });
          }

          const rawAmountStr = String(invoice.paid_fiat_amount).trim();
          const amountMatch = /^(\d+)(?:\.(\d{1,2}))?$/.exec(rawAmountStr);
          if (!amountMatch) {
            console.error(`[Crypto Webhook] Invalid amount format: ${rawAmountStr}`);
            return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
          }
          const intCents = BigInt(amountMatch[1]) * BigInt(100);
          const decCents = BigInt((amountMatch[2] || '00').padEnd(2, '0').slice(0, 2));
          const amount = intCents + decCents;

          const success = await paymentService.confirmPayment(
            gatewayId, 
            amount, 
            payment.userId,
            isTestMode,
            'cryptobot',
            payment.id,
            metadataType
          );

          if (!success) {
             return NextResponse.json({ error: 'Payment double-check validation failed' }, { status: 400 });
          }

          console.info(`[Webhook] Successfully processed payment ${gatewayId}`);
          return NextResponse.json({ ok: true });
        });
        return result;
      } catch (lockError) {
        // Clear anti-replay key on transient lock acquisition timeout so gateway retries can be processed
        if (updateId !== undefined && updateId !== null) {
          try {
            const { redis } = await import('@/lib/redis');
            await redis.del(`webhook:crypto:event:${updateId}`);
          } catch {
            // ignore redis del errors during error handling
          }
        }
        console.error(`[CryptoBot Webhook] Failed to acquire lock for payment ${gatewayId}:`, lockError);
        return NextResponse.json({ error: 'Concurrent processing lock timeout' }, { status: 429 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('[Webhook] Processing error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


