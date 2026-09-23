import { Job } from 'bullmq';
import { db } from '../../lib/db';
import { PaymentGatewayJobPayload } from '../../lib/queue-manager';
import { PaymentGatewayFactory } from '../../services/financial/payment-gateway.service';
import { logger } from '../../lib/logger';

const log = logger.child({ component: 'PaymentGatewayProcessor' });

export default async function paymentGatewayProcessor(job: Job<PaymentGatewayJobPayload>) {
  let validatedData: PaymentGatewayJobPayload;
  try {
    const { PaymentGatewayJobSchema } = await import('../../schemas/jobs.schema');
    validatedData = PaymentGatewayJobSchema.parse(job.data) as PaymentGatewayJobPayload;
  } catch (zodErr) {
    const { UnrecoverableError } = await import('bullmq');
    log.error(`[PaymentGatewayProcessor] Invalid job payload for job ${job.id}`, { cause: zodErr });
    throw new UnrecoverableError('Invalid job payload');
  }

  const { paymentId, userId, amountRub, email, successUrl, description, isTestMode, gateway, metadata } = validatedData;
  log.info(`Processing payment generation for ${paymentId} via ${gateway}`);

  try {
    const payment = await db.payment.findUnique({
      where: { id: paymentId }
    });

    if (!payment) {
      log.error(`Payment ${paymentId} not found`);
      return;
    }

    if (payment.status !== 'PENDING' || payment.checkoutUrl) {
      log.warn(`Payment ${paymentId} already processed (status: ${payment.status}, url: ${payment.checkoutUrl ? 'yes' : 'no'})`);
      return;
    }

    const gatewaySvc = PaymentGatewayFactory.getGateway(gateway);
    const gatewayResult = await gatewaySvc.createPayment({
      paymentId,
      userId,
      amountRub,
      email,
      successUrl,
      description,
      isTestMode,
      metadata
    });

    if (gatewayResult.remoteGatewayId || gatewayResult.paymentUrl) {
      await db.payment.update({
        where: { id: paymentId },
        data: { 
          gatewayId: gatewayResult.remoteGatewayId || undefined,
          checkoutUrl: gatewayResult.paymentUrl || undefined
        }
      });
      log.info(`Payment ${paymentId} successfully registered with ${gateway}. URL generated.`);
    } else {
      log.error(`Failed to generate URL for payment ${paymentId} with ${gateway}.`);
      throw new Error(`Failed to generate URL for ${gateway}`);
    }

  } catch (err: unknown) {
    log.error(`Payment gateway generation error for ${paymentId}: ${(err instanceof Error ? err.message : String(err))}`, { cause: err });
    
    // Set status to failed if job is exhausted, or leave it for retry
    if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
      await db.payment.update({
        where: { id: paymentId },
        data: { status: 'CANCELED' }
      }).catch(e => log.error(`Fallback DB update failed: ${(e instanceof Error ? e.message : String(e))}`));
    }
    throw err; // BullMQ will retry
  }
}
