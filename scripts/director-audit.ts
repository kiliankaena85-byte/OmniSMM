import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DIRECTOR AUDIT ---');
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const stuckOrders = await prisma.order.count({
    where: {
      status: { in: ['PENDING', 'IN_PROGRESS'] },
      createdAt: { lt: twentyFourHoursAgo }
    }
  });
  
  const errorOrders = await prisma.order.count({
    where: { status: 'ERROR' }
  });
  
  const quarantinedServices = await prisma.service.count({
    where: { isQuarantined: true }
  });
  
  console.log(`[OPS] Orders stuck > 24h (PENDING/PROCESSING): ${stuckOrders}`);
  console.log(`[OPS] Orders in ERROR status: ${errorOrders}`);
  console.log(`[CFO] Quarantined services (awaiting rate approval): ${quarantinedServices}`);
  
  console.log('--- END AUDIT ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
