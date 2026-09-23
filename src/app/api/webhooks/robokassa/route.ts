export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { paymentService } from '@/services/financial/payment.service';
import { db } from '@/lib/db';
import { createHash, timingSafeEqual } from 'crypto';
import { MutexManager } from '@/lib/redis-lock';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { logger } from '@/lib/logger';

const MAX_BODY_SIZE = 1024 * 64; // 64KB

export async function POST(req: NextRequest) {
  try {
    const { getClientIp } = await import('@/utils/ip');
    const rawIp = await getClientIp();
    const ip = rawIp.replace(/^::ffff:/, '');

    const { SettingsProvider } = await import('@/lib/settings');
    const isTestMode = await SettingsProvider.isTestMode();
    const isDev = process.env.NODE_ENV === 'development';

    // --- SECURITY GUARD: Robokassa Official IP Range Validation ---
    const isLocalhost = ip === '::1' || ip === '127.0.0.1' || ip.startsWith('127.0.0.');
    const allowedPrefixes = [
      '185.59.216.', '185.59.217.', '185.59.218.', '185.59.219.',
      '217.175.227.', '91.227.52.', '91.227.53.', '91.227.54.', '91.227.55.',
      '109.120.150.', '109.120.151.', '109.120.152.', '109.120.153.', '109.120.154.', '109.120.155.'
    ];
    const isAllowedIp = isDev || isTestMode || isLocalhost || allowedPrefixes.some(prefix => ip.startsWith(prefix));

    if (!isAllowedIp) {
      console.error(`[Robokassa Webhook] BLOCKED: IP spoofing attempt from ${ip}`);
      await SecurityAlertService.record({
        event: 'SPOOFED_IP_WEBHOOK',
        severity: 'CRITICAL',
        ip,
        details: { gateway: 'robokassa' },
      });
      return NextResponse.json({ error: 'Unauthorized IP' }, { status: 403 });
    }

    // 1. Extract query params or form parameters
    const urlObj = new URL(req.url);
    let outSum = urlObj.searchParams.get('OutSum');
    let invId = urlObj.searchParams.get('InvId');
    let signatureValue = urlObj.searchParams.get('SignatureValue');
    let shp_paymentId = urlObj.searchParams.get('shp_paymentId');

    // Parse body if empty query params
    if (!outSum || !signatureValue || !shp_paymentId) {
      try {
        const text = await req.text();
        if (text.length > MAX_BODY_SIZE) {
          console.warn('[Webhook] Oversized Robokassa payload rejected');
          await SecurityAlertService.record({
            event: 'OVERSIZED_PAYLOAD',
            severity: 'WARNING',
            ip,
            details: { gateway: 'robokassa', size: text.length },
          });
          return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
        }
        const body = new URLSearchParams(text);
        outSum = body.get('OutSum') || outSum;
        invId = body.get('InvId') || invId;
        signatureValue = body.get('SignatureValue') || signatureValue;
        shp_paymentId = body.get('shp_paymentId') || shp_paymentId;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // Ignore parsing exceptions
      }
    }

    if (!outSum || !signatureValue || !shp_paymentId) {
      console.error('[Robokassa Webhook] Missing required parameters');
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const currency = urlObj.searchParams.get('OutSumCurrency') || 'RUB';
    if (currency !== 'RUB') {
      console.error(`[Robokassa Webhook] Rejected invalid currency: ${currency}`);
      return NextResponse.json({ error: 'Unsupported currency' }, { status: 400 });
    }

    // 2. Resolve tenantId and fetch system secrets
    let resolvedTenantId = 'smmplan';
    if (shp_paymentId) {
      const p = await db.payment.findUnique({
        where: { id: shp_paymentId },
        select: { tenantId: true }
      });
      if (p?.tenantId) resolvedTenantId = p.tenantId;
    }

    const secrets = await SettingsProvider.getPaymentSecrets(resolvedTenantId);
    const password = secrets.robokassaWebhookPassword;

    if (!password) {
      console.error(`[CRITICAL] RobokassaWebhookPassword (Password#2) is not configured in settings for tenant [${resolvedTenantId}].`);
      return NextResponse.json({ error: 'Gateway unconfigured' }, { status: 500 });
    }

    // 3. Re-calculate SHA-256 signature for verification
    // Robokassa signature formula for webhook (ResultURL): OutSum:InvId:MerchantPassword2:shp_paymentId=paymentId
    const sigStr = `${outSum}:${invId || '0'}:${password}:shp_paymentId=${shp_paymentId}`;
    const expectedSig = createHash('sha256')
      .update(sigStr)
      .digest('hex')
      .toLowerCase();

    const signatureHex = signatureValue.toLowerCase();

    const a = Buffer.from(signatureHex);
    const b = Buffer.from(expectedSig);
    const isMatch = a.length === b.length && timingSafeEqual(a, b);

    if (!isMatch) {
      console.error(`[Robokassa Webhook] Cryptographic signature mismatch for payment ${shp_paymentId}`);
      if (ip) {
        await SecurityAlertService.record({
          event: 'SIGNATURE_FAILED',
          severity: 'CRITICAL',
          ip,
          details: { gateway: 'robokassa', paymentId: shp_paymentId },
        });
      }
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // --- ANTI-REPLAY GUARD (NIST SP 800-63B / PCI DSS v4.0.1) ---
    const replayKey = `webhook:robo:event:${shp_paymentId}:${invId || '0'}:${outSum}`;
    try {
      const { redis } = await import('@/lib/redis');
      const isNew = await redis.set(replayKey, '1', 'EX', 86400, 'NX');
      if (!isNew) {
        logger.info('[Robokassa Webhook] Idempotent duplicate event bypassed', { shp_paymentId });
        return new NextResponse(`OK${invId || '0'}`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
    } catch (redisErr) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[Robokassa Webhook] Fail-Closed: Redis Anti-Replay Guard unreachable:', redisErr);
        return NextResponse.json({ error: 'Anti-Replay Guard service unavailable' }, { status: 503 });
      }
      console.warn('[Robokassa Webhook] Dev/test mode: Redis unreachable, proceeding with DB lock.');
    }

    // 4. Atomic processing with MutexManager distributed lock
    try {
      const result = await MutexManager.withLock(`webhook_payment_robo_${shp_paymentId}`, 15000, 10000, async () => {
        // Fetch the payment record in our DB
        const payment = await db.payment.findUnique({
          where: { id: shp_paymentId }
        });

        if (!payment) {
          console.error(`[Robokassa Webhook] Payment not found for shp_paymentId: ${shp_paymentId}`);
          return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        if (payment.status === 'SUCCEEDED') {
          console.info(`[Robokassa Webhook] Payment ${shp_paymentId} already processed (idempotency hit)`);
          return new NextResponse(`OK${invId || '0'}`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }

        // Convert outSum to kopecks (bigint)
        const amountMatch = /^(\d+)(?:\.(\d{1,2}))?$/.exec(outSum.trim());
        if (!amountMatch) {
          console.error(`[Robokassa Webhook] Invalid outSum format: ${outSum}`);
          return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
        }
        const intCents = BigInt(amountMatch[1]) * BigInt(100);
        const decCents = BigInt((amountMatch[2] || '00').padEnd(2, '0').slice(0, 2));
        const amountCents = intCents + decCents;

        if (payment.amount > amountCents) {
          console.error(`[Robokassa Webhook] Amount underpayment exploit attempt: expected ${payment.amount}, got ${amountCents}`);
          return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 });
        }

        // 5. Confirm the payment atomically
        const success = await paymentService.confirmPayment(
          payment.gatewayId || `robo_${shp_paymentId}`,
          amountCents,
          payment.userId,
          isTestMode,
          'robokassa',
          shp_paymentId,
          payment.orderId ? 'order' : 'deposit'
        );

        if (success) {
          console.info(`[Robokassa Webhook] Payment ${shp_paymentId} confirmed successfully.`);
          // Robokassa ResultURL expects text "OK" followed by InvId to confirm receipt
          return new NextResponse(`OK${invId || '0'}`, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        } else {
          return NextResponse.json({ error: 'Confirm failed' }, { status: 400 });
        }
      });

      return result;
    } catch (lockError) {
      console.error(`[Robokassa Webhook] Failed to acquire lock for payment ${shp_paymentId}:`, lockError);
      return NextResponse.json({ error: 'Concurrent processing lock timeout' }, { status: 429 });
    }
  } catch (error: unknown) {
    console.error('[Robokassa Webhook] Error:', (error instanceof Error ? error.message : String(error)));
    return NextResponse.json({ error: 'Webhook execution failed' }, { status: 500 });
  }
}
