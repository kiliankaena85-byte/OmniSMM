import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- DB Check ---');
  console.log('process.env.DATABASE_URL:', process.env.DATABASE_URL);
  
  const users = await prisma.user.findMany({
    include: { authTokens: true }
  });
  console.log('Total users:', users.length);
  for (const user of users) {
    console.log(`User: ${user.email}, balance: ${user.balance}, tokens:`, user.authTokens.map(t => ({
      id: t.id,
      token: t.token,
      used: t.used,
      expiresAt: t.expiresAt,
      now: new Date(),
      diffMs: t.expiresAt.getTime() - Date.now(),
      isExpired: t.expiresAt.getTime() < Date.now()
    })));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
