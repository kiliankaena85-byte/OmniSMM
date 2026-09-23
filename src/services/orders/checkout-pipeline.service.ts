/**
 * (c) 2024-2026 SMMplan. All rights reserved.
 * Main checkout pipeline service coordinating preflight, transaction, and payment dispatch.
 */
import { headers } from 'next/headers';
import { getClientIp } from '@/utils/ip';
import { verifySession } from '@/lib/session';
import { CheckoutPreflightGuard, type PreflightOrderInput } from './checkout-preflight-guard.service';
import { CheckoutTransactionService, IdempotencyConflictError } from './checkout-transaction.service';
import { CheckoutPaymentService } from './checkout-payment.service';

export interface CheckoutPipelineInput extends PreflightOrderInput {
  idempotencyKey?: string;
  abVariant?: 'A' | 'B' | 'C';
}

export class CheckoutPipelineService {
  static async processOrder(input: CheckoutPipelineInput) {
    const preflight = await CheckoutPreflightGuard.validate(input);

    const consentIp = await getClientIp();
    let reqHeaders: Awaited<ReturnType<typeof headers>> | null = null;
    try {
      reqHeaders = await headers();
    } catch {
      /* ignore context */
    }
    const consentUserAgent = reqHeaders?.get("user-agent") || "Unknown";
    const currentSession = await verifySession();

    try {
      const txResult = await CheckoutTransactionService.execute({
        service: preflight.service,
        normalizedLink: preflight.normalizedLink,
        normalizedMediaGroupLink: preflight.normalizedMediaGroupLink,
        hasMediaGroup: preflight.hasMediaGroup,
        quantity: input.quantity,
        email: input.email,
        normalizedPromo: preflight.normalizedPromo,
        effectiveRuns: preflight.effectiveRuns,
        effectiveInterval: preflight.effectiveInterval,
        customData: input.customData,
        gateway: input.gateway || 'yookassa',
        idempotencyKey: input.idempotencyKey,
        isLinkOverridden: input.isLinkOverridden,
        isSmartDrip: input.isSmartDrip,
        smartDripDays: input.smartDripDays,
        abVariant: input.abVariant,
        tenantId: preflight.tenantId,
        consentIp,
        consentUserAgent,
        currentSessionUserId: currentSession?.userId
      });

      return await CheckoutPaymentService.dispatch({
        result: txResult.result,
        user: txResult.user,
        service: preflight.service,
        gateway: input.gateway || 'yookassa',
        isNewUser: txResult.isNewUser,
        isTestMode: txResult.isTestMode,
        finalTotalCents: txResult.finalTotalCents,
        paymentAmount: txResult.paymentAmount,
        email: input.email,
        normalizedPromo: preflight.normalizedPromo,
        isLinkOverridden: input.isLinkOverridden,
        link: input.link,
        tenantId: preflight.tenantId,
        currentSessionUserId: currentSession?.userId
      });
    } catch (err: unknown) {
      if (err instanceof IdempotencyConflictError) {
        const existingOrder = err.existingOrder as {
          id: string;
          numericId?: number;
          paymentId?: string;
          payment?: { checkoutUrl?: string };
          charge?: number | bigint;
        };
        console.info(`[Checkout] Idempotency hit for key ${input.idempotencyKey}, returning existing order.`);
        return {
          orderId: existingOrder.id,
          numericId: existingOrder.numericId,
          paymentId: existingOrder.paymentId || '',
          paymentUrl: existingOrder.payment?.checkoutUrl || null,
          redirectUrl: undefined,
          guestOrderToken: undefined,
          remainingBalanceRub: undefined,
          totalKopecks: existingOrder.charge ? Number(existingOrder.charge) : 0,
        };
      }
      throw err;
    }
  }
}
