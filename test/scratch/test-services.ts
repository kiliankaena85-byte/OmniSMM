import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('Total services:', await prisma.service.count());
  console.log('Active services:', await prisma.service.count({where:{isActive:true}}));
  console.log('E2E service:', await prisma.service.findFirst({where:{name:{contains:'E2E'}}}));
  console.log('Networks:', await prisma.network.count());
  console.log('Active Networks:', await prisma.network.count({where:{isActive:true}}));
  
  await prisma.$disconnect();
}
main();
