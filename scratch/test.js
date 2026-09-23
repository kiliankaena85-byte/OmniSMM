const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const replacer = (key, value) => typeof value === 'bigint' ? value.toString() : value;

async function run() {
  console.log("Checking all sessions in DB...");
  const sessions = await prisma.session.findMany();
  console.log("All Sessions:", JSON.stringify(sessions, replacer, 2));

  console.log("Checking all users in DB...");
  const users = await prisma.user.findMany({
    select: { id: true, email: true, role: true, balance: true }
  });
  console.log("All Users:", JSON.stringify(users, replacer, 2));
}

run().catch(console.error).finally(() => prisma.$disconnect());
