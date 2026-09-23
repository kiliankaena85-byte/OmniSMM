import { Prisma } from '@prisma/client';
export async function logPromoCodeUsageIfNeeded(tx: Prisma.TransactionClient, orderId: string, userId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      promoCodeId: true,
      discountCents: true,
      charge: true,
      providerCost: true,
    },
  });

  if (!order || !order.promoCodeId) {
    return;
  }

  // Check if PromoCodeUsage already exists for this orderId to prevent duplicate logging
  const existingUsage = await tx.promoCodeUsage.findUnique({
    where: { orderId },
  });

  if (existingUsage) {
    return;
  }

  // Query the PromoCode model for isSuspicious
  const promo = await tx.promoCode.findUnique({
    where: { id: order.promoCodeId },
    select: {
      isSuspicious: true,
    },
  });

  const isSuspicious = promo?.isSuspicious ?? false;

  // Create a PromoCodeUsage record under the transaction tx
  await tx.promoCodeUsage.create({
    data: {
      promoCodeId: order.promoCodeId,
      userId,
      orderId,
      discountCents: order.discountCents,
      revenueCents: order.charge,
      profitCents: order.charge - order.providerCost,
      isSuspicious,
    },
  });
}
