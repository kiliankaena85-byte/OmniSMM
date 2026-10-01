import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const q = '4f5abfd64859fa';
  console.log(`Searching for "${q}" across tables...`);

  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { checkoutUrl: { contains: q } },
        { gatewayId: { contains: q } },
      ]
    }
  });
  console.log('Payments matching:', payments);

  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { link: { contains: q } },
        { error: { contains: q } },
      ]
    }
  });
  console.log('Orders matching:', orders);

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      details: { contains: q }
    }
  });
  console.log('AuditLogs matching:', auditLogs.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
