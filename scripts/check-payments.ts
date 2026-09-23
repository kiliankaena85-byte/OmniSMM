import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Reading recent payments from database...");
  const recentPayments = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      amount: true,
      status: true,
      gateway: true,
      gatewayId: true,
      userId: true,
      createdAt: true
    }
  });
  console.log("Recent Payments:", JSON.stringify(recentPayments, null, 2));

  console.log("\nReading recent security events...");
  const recentEvents = await prisma.securityEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15
  });
  console.log("Recent Security Events:", JSON.stringify(recentEvents, null, 2));

  console.log("\nReading recent admin audit logs...");
  const recentAudit = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log("Recent Admin Audit Logs:", JSON.stringify(recentAudit, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
