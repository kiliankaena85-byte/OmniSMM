import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log('Purging database...');
  await prisma.promoCodeUsage.deleteMany({});
  await prisma.smartExecution.deleteMany({});
  await prisma.smartTask.deleteMany({});
  await prisma.smartCampaign.deleteMany({});
  await prisma.serviceSmartConfig.deleteMany({});
  await prisma.serviceRoute.deleteMany({});
  await prisma.refill.deleteMany({});
  await prisma.messageAttachment.deleteMany({});
  await prisma.ticketMessage.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.service.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.network.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.ledgerEntry.deleteMany({});
  await prisma.commission.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.provider.deleteMany({});
  console.log('Database fully purged successfully.');
  await prisma.$disconnect();
}
main().catch(console.error);

