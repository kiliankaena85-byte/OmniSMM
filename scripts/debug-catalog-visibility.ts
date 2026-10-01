import { PrismaClient } from '@prisma/client';

if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile('.env');
}

const prisma = new PrismaClient();

async function main() {
  console.log('=== QUARANTINE AUDIT IN DB ===');

  const quarantinedCount = await prisma.service.count({
    where: { isQuarantined: true }
  });
  const notQuarantinedCount = await prisma.service.count({
    where: { isQuarantined: false }
  });
  console.log(`Total Quarantined: ${quarantinedCount}`);
  console.log(`Total Not Quarantined: ${notQuarantinedCount}`);

  // Sample quarantined reasons
  const samples = await prisma.service.findMany({
    where: { isQuarantined: true },
    select: {
      id: true,
      name: true,
      quarantineReason: true,
      quarantinedAt: true,
      rate: true,
      costPer1kRub: true,
      pricePer1000Cents: true,
      tenantId: true
    },
    take: 10
  });

  console.log('\nSample Quarantined Services:');
  console.table(samples);
}

main().catch(console.error).finally(() => prisma.$disconnect());
