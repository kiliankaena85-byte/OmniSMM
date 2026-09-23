const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'art@artmspektr.ru';
  const user = await prisma.user.findFirst({ where: { email } });
  
  if (!user) {
    console.log('User not found!');
    return;
  }
  
  await prisma.user.update({
    where: { id: user.id },
    data: { role: 'OWNER' }
  });
  
  console.log('User updated successfully to OWNER.');
}

main().finally(() => prisma.$disconnect());
