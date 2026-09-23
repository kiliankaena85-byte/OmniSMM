import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("🏗️ Smmplan Data Architect: Изоляция АВТО-УСЛУГ...");

  const services = await prisma.service.findMany({
    where: {
      OR: [
        { name: { contains: "Авто", mode: 'insensitive' } },
        { name: { contains: "Подписка", mode: 'insensitive' } },
        { name: { contains: "будущи", mode: 'insensitive' } },
        { name: { contains: "прошлы", mode: 'insensitive' } },
        { name: { contains: "Глазик", mode: 'insensitive' } },
        { name: { contains: "Зрители", mode: 'insensitive' } } // Для twitch зрителей как автоактивности
      ]
    },
    include: { category: true }
  });

  let isolatedCount = 0;
  
  for (const s of services) {
    if (!s.category) continue;
    if (s.category.name === "Автоактивности") continue;

    const netId = s.category.networkId!;

    let autoCat = await prisma.category.findFirst({
        where: { networkId: netId, name: "Автоактивности" }
    });

    if (!autoCat) {
        autoCat = await prisma.category.create({
            data: { name: "Автоактивности", network: { connect: { id: netId } } }
        });
    }

    await prisma.service.update({
        where: { id: s.id },
        data: { categoryId: autoCat.id }
    });
    isolatedCount++;
  }

  console.log(`✅ Изолировано услуг в Автоактивности: ${isolatedCount}`);

  // Удаляем старые пустые категории
  const emptyCats = await prisma.category.findMany({
    where: { services: { none: {} } }
  });
  
  if (emptyCats.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: emptyCats.map(c => c.id) } }
    });
    console.log(`🗑️ Удалено пустых категорий после изоляции: ${emptyCats.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
