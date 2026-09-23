import { db } from '../src/lib/db';

async function main() {
  const users = await db.user.findMany({
    where: {
      email: {
        in: ['art@artmspektr.ru', 'art@artmspektr.pro', 'art@artmspektr.com', 'art@artmspektr']
      }
    },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      isEmailVerified: true,
      tenantId: true
    }
  });

  console.log('Пользователи в базе данных:');
  for (const u of users) {
    console.log(`- Email: ${u.email} | Роль: ${u.role} | Активен: ${u.isActive} | Tenant: ${u.tenantId}`);
  }
}

main().finally(() => db.$disconnect());
