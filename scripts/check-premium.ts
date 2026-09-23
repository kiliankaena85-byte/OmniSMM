import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.category.updateMany({ where: { name: '💎 Премиум' }, data: { name: '💎 Premium Подписчики' } })
  .then(() => console.log('Updated in DB'))
  .finally(() => prisma.$disconnect());
