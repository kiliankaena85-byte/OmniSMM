import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('--- STARTING BASKET RELATIONS MIGRATION ---');

  // Find all historical payments that have orderId but no orders mapped backwards
  const oldPayments = await db.payment.findMany({
    where: {
      orderId: { not: null }
    }
  });

  console.log(`Found ${oldPayments.length} legacy payments. Updating relation...`);

  let counter = 0;
  for (const payment of oldPayments) {
    if (payment.orderId) {
      // Find the corresponding order
      const order = await db.order.findUnique({
        where: { id: payment.orderId }
      });

      if (order && !order.paymentId) {
        // Link the order back to this payment
        await db.order.update({
          where: { id: order.id },
          data: { paymentId: payment.id }
        });
        counter++;
      }
    }
  }

  console.log(`Migration Complete. Successfully updated ${counter} orders with backward paymentId.`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
