import { db } from '../src/lib/db';

async function main() {
  const service = await db.service.findFirst({
    where: { numericId: 4083 },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      isActive: true,
      rate: true,
      externalId: true
    }
  });
  console.log(JSON.stringify(service, null, 2));
}

main().finally(async () => {
  await db.$disconnect();
});
