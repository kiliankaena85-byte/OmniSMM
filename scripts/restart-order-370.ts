import 'dotenv/config';
import { db } from '@/lib/db';
import { redis } from '@/lib/redis';
import { ordersQueue } from '@/lib/queue-manager';

async function main() {
  const orderId = 'cmtmdngft0003ndmjgy47w3xk';
  console.log('Fetching order:', orderId);
  
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { service: true, provider: true }
  });

  if (!order) {
    console.error('Order not found!');
    return;
  }

  console.log('Order found:', {
    id: order.id,
    numericId: order.numericId,
    status: order.status,
    service: order.service.name,
    provider: order.provider?.name,
    link: order.link,
    quantity: order.quantity
  });

  // 1. Clear Redis dispatch lock
  const redisKey = `order:dispatched:${order.id}`;
  const deletedLock = await redis.del(redisKey);
  console.log(`Cleared Redis lock '${redisKey}':`, deletedLock);

  // 2. Reset order status to PENDING
  await db.order.update({
    where: { id: order.id },
    data: {
      status: 'PENDING',
      error: null,
      retryCount: 0,
      externalId: null
    }
  });
  console.log('Order status reset to PENDING in database.');

  // 3. Enqueue to BullMQ
  const jobId = `dispatch-${order.id}-${Date.now()}`;
  const job = await ordersQueue.add('order-dispatch', { orderId: order.id }, { jobId });
  console.log('BullMQ job queued successfully with ID:', job.id);

  await ordersQueue.close();
  await redis.quit();
  console.log('Done!');
}

main().catch(console.error).finally(() => process.exit(0));
