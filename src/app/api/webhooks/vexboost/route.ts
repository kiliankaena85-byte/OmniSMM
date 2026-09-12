import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { providerService } from '@/services/providers/provider.service';
import { RefundPolicyService } from '@/services/financial/refund-policy.service';
import { runSerializableTransaction } from '@/lib/transactions';
import { RateLimitService } from '@/services/core/rate-limit.service';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { getClientIp } from '@/utils/ip';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const ip = await getClientIp(request);

  try {
    const isAllowed = await RateLimitService.check('vexboostWebhook', 60, 60);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const secret = request.headers.get('x-webhook-secret') || request.headers.get('x-vexboost-secret');
    const signature = request.headers.get('x-signature') || request.headers.get('x-vexboost-signature');
    const timestamp = request.headers.get('x-timestamp');

    // 1. Replay defense check (Mandatory timestamp)
    if (!timestamp) {
      await SecurityAlertService.record({
        event: 'MISSING_TIMESTAMP',
        severity: 'HIGH',
        ip,
        details: { gateway: 'vexboost' },
      });
      return NextResponse.json({ error: 'Missing x-timestamp header' }, { status: 403 });
    }

    const reqTime = parseInt(timestamp, 10);
    if (isNaN(reqTime) || Math.abs(Date.now() - reqTime) > 5 * 60 * 1000) {
      await SecurityAlertService.record({
        event: 'REPLAY_ATTEMPT',
        severity: 'HIGH',
        ip,
        details: { gateway: 'vexboost', timestamp },
      });
      return NextResponse.json({ error: 'Webhook timestamp expired or invalid' }, { status: 403 });
    }

    // 2. Secret / Signature validation
    const expectedSecret = process.env.VEXBOOST_WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[VexBoost Webhook] FATAL: VEXBOOST_WEBHOOK_SECRET is not configured. Rejecting all requests.');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }

    // Support HMAC signature if provided, or fallback to header secret
    if (signature) {
      const rawText = await request.clone().text().catch(() => '');
      const expectedSigDot = crypto.createHmac('sha256', expectedSecret).update(`${timestamp}.${rawText}`).digest('hex');
      const expectedSigWithTs = crypto.createHmac('sha256', expectedSecret).update(`${rawText}:${timestamp}`).digest('hex');
      const expectedSigRaw = crypto.createHmac('sha256', expectedSecret).update(rawText).digest('hex');
      const cleanSig = signature.startsWith('sha256=') ? signature.slice(7) : signature;

      const sigBuffer = Buffer.from(cleanSig);
      const isMatchDot = sigBuffer.length === expectedSigDot.length && crypto.timingSafeEqual(sigBuffer, Buffer.from(expectedSigDot));
      const isMatchWithTs = sigBuffer.length === expectedSigWithTs.length && crypto.timingSafeEqual(sigBuffer, Buffer.from(expectedSigWithTs));
      const isMatchRaw = sigBuffer.length === expectedSigRaw.length && crypto.timingSafeEqual(sigBuffer, Buffer.from(expectedSigRaw));

      if (!isMatchDot && !isMatchWithTs && !isMatchRaw) {
        await SecurityAlertService.record({
          event: 'INVALID_SIGNATURE',
          severity: 'CRITICAL',
          ip,
          details: { gateway: 'vexboost' },
        });
        return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 403 });
      }
    } else {
      if (!secret) {
        console.warn('[VexBoost Webhook] Missing webhook secret.');
        await SecurityAlertService.record({
          event: 'MISSING_SECRET',
          severity: 'WARNING',
          ip,
          details: { gateway: 'vexboost' },
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const secretBuffer = Buffer.from(secret);
      const expectedBuffer = Buffer.from(expectedSecret);

      if (
        secretBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(secretBuffer, expectedBuffer)
      ) {
        console.warn('[VexBoost Webhook] Unauthorized access attempt. Secret mismatch.');
        await SecurityAlertService.record({
          event: 'UNAUTHORIZED_WEBHOOK_ACCESS',
          severity: 'CRITICAL',
          ip,
          details: { gateway: 'vexboost' },
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    let externalId: string | undefined;
    try {
      const data = await request.formData();
      externalId = data.get('id')?.toString() || data.get('order')?.toString();
    } catch {
      const jsonData = await request.json().catch(() => ({}));
      externalId = jsonData.id?.toString() || jsonData.order?.toString();
    }

    if (!externalId) {
      return NextResponse.json({ error: 'Missing order ID in payload' }, { status: 400 });
    }

    // 3. Zero-Trust Verification: Find order and fetch genuine status from Provider API
    const order = await db.order.findFirst({
      where: {
        status: { in: ['IN_PROGRESS', 'PENDING_CHECK'] },
        OR: [
          { externalId },
          { dripExternalIds: { has: externalId } }
        ]
      },
      include: { service: true, user: { select: { email: true } } }
    });

    if (!order) {
      return NextResponse.json({ message: 'Order not found or not active' }, { status: 200 });
    }

    if (!order.providerId) {
      return NextResponse.json({ error: 'Order has no assigned provider' }, { status: 400 });
    }

    const providerDef = await db.provider.findUnique({ where: { id: order.providerId } });
    if (!providerDef) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 400 });
    }

    const providerInstance = await providerService.getWorkerProviderInstance(providerDef);
    const statuses = await providerInstance.getMultiOrderStatus([externalId]);
    const s = statuses[externalId];

    if (!s || typeof s === 'string') {
      return NextResponse.json({ error: 'Provider API returned invalid status during verification' }, { status: 400 });
    }

    const verifiedStatus = s.status.toUpperCase();
    const parsedRemains = parseInt(s.remains || '0', 10);

    if (['CANCELED', 'CANCELLED'].includes(verifiedStatus)) {
      await runSerializableTransaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
          data: { status: 'CANCELED', remains: parsedRemains }
        });
        if (updated.count > 0) {
          const freshOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
          await RefundPolicyService.processRefund({ ...freshOrder, charge: Number(freshOrder.charge) }, '(Отмена на стороне провайдера VexBoost)', tx);
        }
      });
    } else if (['PARTIAL'].includes(verifiedStatus)) {
      await runSerializableTransaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
          data: { status: 'PARTIAL', remains: parsedRemains }
        });
        if (updated.count > 0) {
          const freshOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
          await RefundPolicyService.processRefund({ ...freshOrder, charge: Number(freshOrder.charge) }, '', tx);
        }
      });
    } else if (['COMPLETED'].includes(verifiedStatus)) {
      await runSerializableTransaction(async (tx) => {
        await tx.order.updateMany({
          where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
          data: { status: 'COMPLETED', remains: 0 }
        });
      });
    } else {
      await db.order.updateMany({
        where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
        data: { remains: parsedRemains }
      });
    }

    return NextResponse.json({ success: true, verifiedStatus, orderId: order.id });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[VexBoost Webhook] Error:', errorMsg);
    await SecurityAlertService.record({
      event: 'INTERNAL_ERROR',
      severity: 'CRITICAL',
      ip,
      details: { gateway: 'vexboost', error: errorMsg },
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/** @public Support GET for simple health checks or ping tests */
export async function GET() {
  return NextResponse.json({ status: 'active', provider: 'VexBoost' });
}
