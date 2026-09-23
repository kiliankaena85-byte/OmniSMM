import { db } from '../src/lib/db';

async function main() {
  const admins = await db.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true, email: true, role: true, telegramId: true }
  });
  console.log('Admins in DB:', admins);
  await db.$disconnect();
}

main().catch(console.error);
