import { PrismaClient } from "@prisma/client";
import { slugify } from "../src/utils/slugify";
const prisma = new PrismaClient();

async function main() {
  const cats = await prisma.category.findMany();
  for (let i = 0; i < cats.length; i++) {
    const s = slugify(cats[i].name) + "-" + cats[i].id.slice(-6); // last 6 chars are unique
    await prisma.category.update({
      where: { id: cats[i].id },
      data: { slug: s }
    });
  }
  
  const nets = await prisma.network.findMany();
  for (let i = 0; i < nets.length; i++) {
    const s = slugify(nets[i].name) + "-" + nets[i].id.slice(-6);
    await prisma.network.update({
      where: { id: nets[i].id },
      data: { slug: s }
    });
  }
  
  console.log("Slugs generated safely");
  await prisma.$disconnect();
}
main();
