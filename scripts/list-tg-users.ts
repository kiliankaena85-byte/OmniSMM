import { db } from '../src/lib/db';

async function main() {
  const users = await db.user.findMany({
    where: { telegramId: { not: null } },
    select: { id: true, email: true, role: true, telegramId: true }
  });
  console.log('Users with telegramId in DB:', users);
  await db.$disconnect();
}

main().catch(console.error);
