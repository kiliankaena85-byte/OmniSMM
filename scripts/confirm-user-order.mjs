import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

const prisma = new PrismaClient();

async function main() {
  const orderId = 'cmuow3ver000313thudslzgz1';
  const paymentId = 'cmuow3vf8000513thl580rm5s';

  console.log(`[OrderConfirmation] Confirming payment ${paymentId} for order ${orderId}...`);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true, service: true, user: true }
  });

  if (!order) {
    console.error(`Order ${orderId} not found`);
    return;
  }

  console.log(`Order found: service=${order.service.name}, link=${order.link}, status=${order.status}`);

  // 1. Transaction to mark Payment and Order as confirmed
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: 'SUCCEEDED',
        updatedAt: new Date()
      }
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PENDING',
        updatedAt: new Date()
      }
    });

    // Credit user ledger
    await tx.ledgerEntry.create({
      data: {
        userId: order.userId,
        amount: order.charge,
        balanceAfter: order.user.balance,
        direction: 'CREDIT',
        category: 'PAYMENT',
        description: `Оплата заказа #${order.numericId} (ЮKassa)`,
        tenantId: order.tenantId,
        idempotencyKey: `manual-confirm-${paymentId}`
      }
    });
  });

  console.log(`[OrderConfirmation] Payment and order status updated to SUCCEEDED / PENDING`);

  // 2. Dispatch to BullMQ Queue via Redis
  const redisUrlStr = process.env.REDIS_URL || 'redis://:SmmP1anR3dis2026Secure!@redis:6379';
  console.log(`[OrderConfirmation] Connecting to Redis queue...`);

  let redisHost = 'redis';
  let redisPort = 6379;
  let redisPassword = 'SmmP1anR3dis2026Secure!';

  try {
    const parsed = new URL(redisUrlStr);
    redisHost = parsed.hostname;
    redisPort = parseInt(parsed.port, 10) || 6379;
    if (parsed.password) redisPassword = decodeURIComponent(parsed.password);
  } catch {}

  const ordersQueue = new Queue('orders-queue', {
    connection: {
      host: redisHost,
      port: redisPort,
      password: redisPassword
    }
  });

  const job = await ordersQueue.add('order-dispatch', {
    orderId: order.id,
    tenantId: order.tenantId
  }, {
    jobId: `dispatch-${order.id}-${Date.now()}`
  });

  console.log(`[OrderConfirmation] ✅ Dispatched order ${order.id} to queue with Job ID: ${job.id}`);
  await ordersQueue.close();
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
