import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { providerService } from '@/services/providers/provider.service';
import { RefundPolicyService } from '@/services/financial/refund-policy.service';
import { runSerializableTransaction } from '@/lib/transactions';
import { SecurityAlertService } from '@/services/security/security-alert.service';
import { getClientIp } from '@/utils/ip';
import crypto from 'crypto';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ providerName: string }> }
) {
  const { providerName } = await params;
  const ip = await getClientIp(request);

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-signature') || request.headers.get('x-hub-signature-256');
    const timestamp = request.headers.get('x-timestamp');

    // 1. Mandatory Timestamp Freshness (prevent replay attack within 5 minutes)
    if (!timestamp) {
      await SecurityAlertService.record({
        event: 'MISSING_TIMESTAMP',
        severity: 'HIGH',
        ip,
        details: { provider: providerName },
      });
      return NextResponse.json({ error: 'Missing x-timestamp header' }, { status: 403 });
    }
    const reqTime = parseInt(timestamp, 10);
    if (isNaN(reqTime) || Math.abs(Date.now() - reqTime) > 5 * 60 * 1000) {
      await SecurityAlertService.record({
        event: 'REPLAY_ATTEMPT',
        severity: 'HIGH',
        ip,
        details: { provider: providerName, timestamp },
      });
      return NextResponse.json({ error: 'Webhook timestamp expired or invalid' }, { status: 403 });
    }

    // Whitelist of provider names allowed to receive webhooks.
    // Add new providers here ONLY after integration testing.
    const ALLOWED_PROVIDER_NAMES = new Set([
      'vexboost',
      'smmstone',
    ]);

    if (!ALLOWED_PROVIDER_NAMES.has(providerName.toLowerCase())) {
      await SecurityAlertService.record({
        event: 'UNKNOWN_PROVIDER',
        severity: 'WARNING',
        ip,
        details: { provider: providerName },
      });
      return NextResponse.json({ error: 'Provider not supported' }, { status: 404 });
    }

    // 2. Fetch Provider
    const provider = await db.provider.findUnique({
      where: { name: providerName },
    });

    if (!provider || !provider.isActive) {
      return NextResponse.json({ error: 'Provider inactive or not found' }, { status: 404 });
    }

    // 3. Mandatory HMAC Signature Verification
    const secret = process.env.PROVIDER_WEBHOOK_SECRET;
    if (!secret) {
      console.error(`[ProviderWebhook:${providerName}] FATAL: PROVIDER_WEBHOOK_SECRET is not configured.`);
      return NextResponse.json({ error: 'Provider webhook secret not configured' }, { status: 503 });
    }
    if (!signature) {
      await SecurityAlertService.record({
        event: 'MISSING_SIGNATURE',
        severity: 'HIGH',
        ip,
        details: { provider: providerName },
      });
      return NextResponse.json({ error: 'Missing x-signature header' }, { status: 403 });
    }

    const expectedSigDot = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
    const expectedSigWithTs = crypto.createHmac('sha256', secret).update(`${rawBody}:${timestamp}`).digest('hex');
    const expectedSigRaw = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
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
        details: { provider: providerName },
      });
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 403 });
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const externalId = String(payload.providerOrderId || payload.orderId || payload.id || payload.order || '');
    if (!externalId) {
      return NextResponse.json({ error: 'Missing order identifiers' }, { status: 400 });
    }

    // 4. Zero-Trust Verification: Query Provider Instance directly
    const order = await db.order.findFirst({
      where: {
        status: { in: ['IN_PROGRESS', 'PENDING_CHECK'] },
        OR: [
          { externalId },
          { id: externalId },
          { dripExternalIds: { has: externalId } }
        ]
      },
      include: { service: true, user: { select: { email: true } } }
    });

    if (!order) {
      return NextResponse.json({ message: 'Order not found or not active' }, { status: 200 });
    }

    const providerInstance = await providerService.getWorkerProviderInstance(provider);
    const lookupId = order.externalId || externalId;
    const statuses = await providerInstance.getMultiOrderStatus([lookupId]);
    const s = statuses[lookupId];

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
          await RefundPolicyService.processRefund({ ...freshOrder, charge: Number(freshOrder.charge) }, `(Отмена на стороне провайдера ${providerName})`, tx);
          if (order.user?.email) {
            const { sendOrderCanceledMail } = await import('@/lib/smtp');
            sendOrderCanceledMail(order.user.email, order.numericId.toString(), order.service.name, order.tenantId).catch(console.error);
          }
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
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
          data: { status: 'COMPLETED', remains: 0 }
        });
        if (updated.count > 0) {
          const { LoyaltyService } = await import('@/services/users/loyalty.service');
          await LoyaltyService.confirmCommission(tx, order.id);
          if (order.user?.email) {
            const { sendOrderCompletedMail } = await import('@/lib/smtp');
            sendOrderCompletedMail(order.user.email, order.numericId.toString(), order.service.name, order.tenantId).catch(console.error);
          }
        }
      });
    } else {
      await db.order.updateMany({
        where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
        data: { remains: parsedRemains }
      });
    }

    return NextResponse.json({ success: true, verifiedStatus, orderId: order.id });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[ProviderWebhook:${providerName}] Error processing webhook:`, errorMsg);
    await SecurityAlertService.record({
      event: 'INTERNAL_ERROR',
      severity: 'CRITICAL',
      ip,
      details: { provider: providerName, error: errorMsg },
    }).catch(() => {});
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
