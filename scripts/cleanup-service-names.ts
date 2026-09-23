import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupServiceNames() {
  const services = await prisma.service.findMany({
    select: { id: true, name: true }
  });

  const patterns = [
    /^\d+\.\s*/,       // "663. VK "
    /^\[\d+\]\s*/,     // "[125] VK "
    /^\(\d+\)\s*/,     // "(125) VK "
    /^\d+\s*-\s*/,     // "125 - VK "
    /^ID:\s*\d+\s*/i,  // "ID: 125 VK "
    /^ID\s*\d+\s*/i,   // "ID 125 VK "
  ];

  let updatedCount = 0;

  console.log('Starting cleanup...');

  for (const srv of services) {
    for (const pattern of patterns) {
      if (pattern.test(srv.name)) {
        const newName = srv.name.replace(pattern, '').trim();
        
        await prisma.service.update({
          where: { id: srv.id },
          data: { name: newName }
        });
        
        console.log(`[UPDATED] "${srv.name}"  =>  "${newName}"`);
        updatedCount++;
        break; // Process max one pattern per service
      }
    }
  }

  console.log(`\nCleanup complete. Total records updated: ${updatedCount}`);
}

cleanupServiceNames()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
