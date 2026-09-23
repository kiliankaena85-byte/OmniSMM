import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding AnalyticsEvents to match mock database orders...');

  // Get completed orders count in the last 30 days
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const completedOrders = await prisma.order.count({
    where: {
      status: 'COMPLETED',
      createdAt: { gte: startDate, lte: endDate }
    }
  });

  console.log(`Found ${completedOrders} completed orders in the last 30 days.`);

  // Clear existing analytics events to prevent duplication
  await prisma.analyticsEvent.deleteMany({});

  // We want to construct a logical funnel:
  // LINK_PASTED -> SERVICE_SELECTED -> CHECKOUT_INITIATED -> PAYMENT_CLICKED -> COMPLETED (orders)
  // Let's make:
  // PAYMENT_CLICKED = completedOrders * 1.5
  // CHECKOUT_INITIATED = PAYMENT_CLICKED * 1.3
  // SERVICE_SELECTED = CHECKOUT_INITIATED * 1.6
  // LINK_PASTED = SERVICE_SELECTED * 1.5

  const paymentClickedCount = Math.max(30, Math.round(completedOrders * 1.5));
  const checkoutInitiatedCount = Math.round(paymentClickedCount * 1.35);
  const serviceSelectedCount = Math.round(checkoutInitiatedCount * 1.6);
  const linkPastedCount = Math.round(serviceSelectedCount * 1.5);

  console.log(`Generating funnel events:`);
  console.log(`- LINK_PASTED: ${linkPastedCount}`);
  console.log(`- SERVICE_SELECTED: ${serviceSelectedCount}`);
  console.log(`- CHECKOUT_INITIATED: ${checkoutInitiatedCount}`);
  console.log(`- PAYMENT_CLICKED: ${paymentClickedCount}`);

  // Helper to generate events
  const generateEvents = async (event: string, count: number) => {
    const eventsData = [];
    for (let i = 0; i < count; i++) {
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000));
      eventsData.push({
        event,
        sessionId: `sess_${Math.random().toString(36).substring(2, 15)}`,
        createdAt,
        metadata: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          ip: '127.0.0.1'
        }
      });
    }

    // Batch create
    await prisma.analyticsEvent.createMany({
      data: eventsData
    });
  };

  await generateEvents('LINK_PASTED', linkPastedCount);
  await generateEvents('SERVICE_SELECTED', serviceSelectedCount);
  await generateEvents('CHECKOUT_INITIATED', checkoutInitiatedCount);
  await generateEvents('PAYMENT_CLICKED', paymentClickedCount);

  console.log('Successfully seeded analytics events! 🎉');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
