import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'e2e-tester@test.com';
  let user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        balance: 200000_00,
        role: 'OWNER'
      }
    });
  }

  // Find or create a ticket
  let ticket = await prisma.ticket.findFirst({
    where: { userId: user.id }
  });

  if (!ticket) {
    ticket = await prisma.ticket.create({
      data: {
        userId: user.id,
        subject: 'Тестовый запрос поддержки',
        status: 'OPEN',
        messages: {
          create: {
            sender: 'USER',
            text: 'Привет! Это тестовое сообщение.'
          }
        }
      }
    });
  }

  console.log(`TICKET_ID:${ticket.id}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
