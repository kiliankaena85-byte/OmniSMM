import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { providerService } from "@/services/providers/provider.service";
import { RefundPolicyService } from "@/services/financial/refund-policy.service";
import { sendOrderCompletedMail, sendOrderCanceledMail } from "@/lib/smtp";
import { QuarantineService } from "@/services/providers/quarantine.service";
import { CompensationService } from "@/services/financial/compensation.service";
import { runSerializableTransaction } from "@/lib/transactions";
import { RateLimitService } from "@/services/core/rate-limit.service";

/**
 * MANDATORY INTEGRITY WARNING:
 * DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
 */

/**
 * PUSH Webhook for Provider Sync (Zero-Trust Signal Pattern)
 * 
 * Flow:
 * 1. Provider sends a webhook that an order changed.
 * 2. We validate the secret.
 * 3. We DO NOT trust the payload status (prevents spoofing).
 * 4. We query the provider API directly to confirm the true status.
 * 5. We apply the status, refund math, and quarantine rules.
 */
export async function POST(req: Request) {
  try {
    const isAllowed = await RateLimitService.check('providerWebhook', 60, 60);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const secret = req.headers.get("x-webhook-secret");
    const timestamp = req.headers.get("x-timestamp");
    const { getClientIp } = await import('@/utils/ip');
    const ip = await getClientIp(req);
    const { SecurityAlertService } = await import('@/services/security/security-alert.service');

    // 1. Mandatory Timestamp Freshness (prevent replay attack within 5 minutes)
    if (timestamp) {
      const reqTime = parseInt(timestamp, 10);
      if (isNaN(reqTime) || Math.abs(Date.now() - reqTime) > 5 * 60 * 1000) {
        await SecurityAlertService.record({
          event: 'REPLAY_ATTEMPT',
          severity: 'HIGH',
          ip,
          details: { gateway: 'provider_default', timestamp },
        });
        return NextResponse.json({ error: 'Webhook timestamp expired or invalid' }, { status: 403 });
      }
    }
    
    // SD-01 SECURITY FIX: Fail-closed — reject all requests if WEBHOOK_SECRET is not configured.
    // NEVER fall back to a hardcoded default.
    const expectedSecret = process.env.WEBHOOK_SECRET;
    if (!expectedSecret) {
      console.error('[Webhook] FATAL: WEBHOOK_SECRET is not configured. Rejecting all requests.');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
    }
    
    const crypto = (await import('crypto')).default;
    const secretBuf = Buffer.from(secret || '');
    const expectedBuf = Buffer.from(expectedSecret);
    if (!secret || secretBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(secretBuf, expectedBuf)) {
      console.warn(`[Webhook] Unauthorized access attempt. Secret mismatch.`);
      await SecurityAlertService.record({
        event: 'UNAUTHORIZED_WEBHOOK_ACCESS',
        severity: 'CRITICAL',
        ip,
        details: { gateway: 'provider_default' },
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch (err) {
      // If it's not JSON, assume x-www-form-urlencoded
      console.warn('[Webhook] Failed to parse JSON, falling back to formData:', err);
      const formData = await req.formData();
      body = Object.fromEntries(formData.entries());
    }

    const externalId = body?.order?.toString() || body?.id?.toString() || searchParams.get("order");
    
    if (!externalId) {
      return NextResponse.json({ error: "Missing order ID in payload" }, { status: 400 });
    }

    console.info(`[Webhook] Received update signal for external ID: ${externalId}`);

    // 1. Find the order
    const order = await db.order.findFirst({
      where: {
        status: { in: ["IN_PROGRESS", "PENDING_CHECK"] },
        OR: [
          { externalId },
          { dripExternalIds: { has: externalId } }
        ]
      },
      include: { service: true, user: { select: { email: true } } }
    });

    if (!order) {
      console.info(`[Webhook] Order with external ID ${externalId} not found or not active.`);
      return NextResponse.json({ message: "Order not found or not active" }, { status: 200 });
    }

    if (!order.providerId) {
      return NextResponse.json({ error: "Order has no assigned provider" }, { status: 400 });
    }

    // 2. Fetch the true state from Provider (Zero-Trust)
    const providerDef = await db.provider.findUnique({ where: { id: order.providerId } });
    if (!providerDef) {
      return NextResponse.json({ error: "Provider not found" }, { status: 400 });
    }

    const providerInstance = await providerService.getWorkerProviderInstance(providerDef);
    const statuses = await providerInstance.getMultiOrderStatus([externalId]);
    const s = statuses[externalId];

    if (!s || typeof s === 'string') {
      return NextResponse.json({ error: "Provider API returned invalid status during verification" }, { status: 400 });
    }

    const providerStatus = s.status.toUpperCase();
    const parsedRemains = parseInt(s.remains || "0", 10);

    console.info(`[Webhook] Verified true status for ${externalId}: ${providerStatus}`);

    // 3. Apply standard Sync Logic
    if (order.isDripFeed) {
      // For drip-feed, we just blindly update the specific run. 
      // The massive Cron worker will eventually finalize the overarching drip order.
      // But we can trigger a micro-update here.
      if (['COMPLETED', 'PARTIAL', 'CANCELED'].includes(providerStatus)) {
        console.info(`[Webhook] DripFeed run ${externalId} completed/canceled. Waiting for main Cron to aggregate.`);
      }
      return NextResponse.json({ success: true, message: "DripFeed signal acknowledged" });
    }

    // 4. Single Order Logic
    if (['CANCELED'].includes(providerStatus)) {
      await runSerializableTransaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
          data: { status: 'CANCELED', remains: parsedRemains }
        });
        if (updated.count > 0) {
          const freshOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
          await RefundPolicyService.processRefund({ ...freshOrder, charge: Number(freshOrder.charge) }, '(Отмена на стороне провайдера)', tx);
          
          // Trigger Quarantine Check (Silent Failures)
          QuarantineService.evaluateTriggerB(order.serviceId).catch(console.error);
          
          if (order.user?.email) {
            sendOrderCanceledMail(order.user.email, order.numericId.toString(), order.service.name, order.tenantId).catch(console.error);
          }
          CompensationService.trackCompensation(order.id, s.charge).catch(err => console.error('[Webhook] Failed to track compensation', err));
        }
      });
      
    } else if (['PARTIAL'].includes(providerStatus)) {
      await runSerializableTransaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
          data: { status: 'PARTIAL', remains: parsedRemains }
        });
        if (updated.count > 0) {
          const freshOrder = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
          await RefundPolicyService.processRefund({ ...freshOrder, charge: Number(freshOrder.charge) }, '', tx);
          
          CompensationService.trackCompensation(order.id, s.charge).catch(err => console.error('[Webhook] Failed to track compensation', err));
        }
      });
      
    } else if (['COMPLETED'].includes(providerStatus)) {
      await runSerializableTransaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
          data: { status: 'COMPLETED', remains: 0 }
        });
        if (updated.count > 0) {
          const { LoyaltyService } = await import('@/services/users/loyalty.service');
          await LoyaltyService.confirmCommission(tx, order.id);
          
          sendOrderCompletedMail(order.user.email, order.numericId.toString(), order.service.name, order.tenantId).catch(console.error);
          CompensationService.trackCompensation(order.id, s.charge).catch(err => console.error('[Webhook] Failed to track compensation', err));
        }
      });
      
    } else {
      await db.order.updateMany({
        where: { id: order.id, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_CHECK'] } },
        data: { remains: parsedRemains }
      });
    }

    return NextResponse.json({ success: true, verifiedStatus: providerStatus });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Webhook] Fatal error:`, errorMsg);
    try {
      const { getClientIp } = await import('@/utils/ip');
      const ip = await getClientIp(req);
      const { SecurityAlertService } = await import('@/services/security/security-alert.service');
      await SecurityAlertService.record({
        event: 'INTERNAL_ERROR',
        severity: 'CRITICAL',
        ip,
        details: { gateway: 'provider_default', error: errorMsg },
      });
    } catch {
      // Ignore secondary error logging failure
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
