import { db } from '../src/lib/db';

async function main() {
  const ids = [
    'cmswm5ccd001z1udadw4zhtx1',
    'cmswm5ce000291udaoktuwssx',
    'cmswm5cge002n1udanp2gqsi5'
  ];

  const orders = await db.order.findMany({
    where: { id: { in: ids } },
    include: {
      provider: true,
      service: true,
      user: { select: { id: true, email: true } }
    }
  });

  console.log('Found orders count:', orders.length);
  orders.forEach(o => {
    console.log({
      id: o.id,
      numericId: o.numericId,
      status: o.status,
      providerName: o.provider?.name || 'No provider / Mock',
      providerId: o.providerId,
      serviceName: o.service?.name,
      userEmail: o.user?.email,
      charge: o.charge,
      quantity: o.quantity,
      remains: o.remains,
      createdAt: o.createdAt,
    });
  });
}

main().catch(console.error);
