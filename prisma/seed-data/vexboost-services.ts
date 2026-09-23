import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log("VexBoost Seeder started...");

  // Mocking the data because API returned "user_inactive"
  const rawServices = [
    {
      id: "vex_instagram_1",
      service: "Instagram Followers - Fast Delivery",
      type: "default",
      category: "Instagram",
      rate: "1.5",
      resell: "5.0",
      description: "HQ Quality, Instant Start",
      link_type: "profile",
      min_qty: "100",
      max_qty: "10000"
    },
    {
      id: "vex_youtube_2",
      service: "YouTube Views - WorldWide",
      type: "default",
      category: "YouTube",
      rate: "3.2",
      resell: "10.0",
      description: "Non-drop, 30 days refill",
      link_type: "video",
      min_qty: "500",
      max_qty: "50000"
    }
  ];

  // Get a category to map to
  const category = await prisma.category.findFirst({
    where: { name: { contains: "Test" } }
  });

  let categoryId = category ? category.id : null;
  if (!categoryId) {
    const firstCat = await prisma.category.findFirst({ select: { id: true } });
    categoryId = firstCat ? firstCat.id : null;
  }

  for (const item of rawServices) {
    const id = String(item.id);
    const name = String(item.service);
    const rateInt = Math.round(parseFloat(item.rate));
    const markupInt = Math.round(parseFloat(item.resell));
    const minQty = Math.round(parseFloat(item.min_qty));
    const maxQty = Math.round(parseFloat(item.max_qty));
    const extId = String(item.id);
    const randomNumericId = Math.floor(Math.random() * 1000000) + 10000;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "Service" ("id", "numericId", "name", "categoryId", "rate", "markup", "minQty", "maxQty", "externalId", "updatedAt") 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) 
       ON CONFLICT ("id") DO NOTHING;`,
      id, randomNumericId, name, categoryId, rateInt, markupInt, minQty, maxQty, extId
    );
  }

  console.log("VexBoost raw insert completed successfully.");
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
