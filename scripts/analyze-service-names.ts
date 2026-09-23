import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function analyze() {
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

  let affectedCount = 0;
  const samples = [];

  for (const srv of services) {
    for (const pattern of patterns) {
      if (pattern.test(srv.name)) {
        affectedCount++;
        const newName = srv.name.replace(pattern, '').trim();
        if (samples.length < 10) {
          samples.push({ old: srv.name, new: newName });
        }
        break; // Count once per service
      }
    }
  }

  console.log(`Total services analyzed: ${services.length}`);
  console.log(`Services with provider ID in name: ${affectedCount}`);
  if (affectedCount > 0) {
    console.log('\nSamples of cleanup:');
    samples.forEach(s => console.log(`"${s.old}"  =>  "${s.new}"`));
  }
}

analyze()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
