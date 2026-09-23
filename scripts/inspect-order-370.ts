import { db } from '../src/lib/db';

async function main() {
  const order = await db.order.findFirst({
    where: {
      OR: [
        { numericId: 370 },
        { id: '370' }
      ]
    },
    include: {
      service: true,
      provider: true,
      user: true,
      payment: true
    }
  });

  if (!order) {
    console.log('Order 370 not found!');
    return;
  }

  console.log('=== ORDER 370 DETAILS ===');
  console.log(JSON.stringify({
    id: order.id,
    numericId: order.numericId,
    status: order.status,
    link: order.link,
    quantity: order.quantity,
    price: order.price?.toString(),
    cost: order.cost?.toString(),
    providerId: order.providerId,
    providerOrderId: order.providerOrderId,
    serviceId: order.serviceId,
    service: {
      id: order.service?.id,
      name: order.service?.name,
      providerId: order.service?.providerId,
      providerServiceId: order.service?.providerServiceId,
      minQty: order.service?.minQty,
      maxQty: order.service?.maxQty,
      isActive: order.service?.isActive
    },
    provider: {
      id: order.provider?.id,
      name: order.provider?.name,
      apiUrl: order.provider?.apiUrl,
      balance: order.provider?.balance,
      isActive: order.provider?.isActive,
      status: order.provider?.status
    }
  }, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log('=== SERVICE DETAILS ===');
  console.log(JSON.stringify(order.service, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));

  console.log('=== PROVIDER DETAILS ===');
  console.log(JSON.stringify(order.provider, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
}

main().catch(console.error).finally(() => process.exit(0));
