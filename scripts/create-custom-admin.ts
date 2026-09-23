import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth/password';

async function main() {
  const emails = [
    'art@artmspektr.ru',
    'art@artmspektr.pro',
    'art@artmspektr.com',
    'art@artmspektr'
  ];
  const passwordRaw = 'Sokol2203';
  const passwordHash = await hashPassword(passwordRaw);

  console.log(`=== СОЗДАНИЕ УЧЕТНОЙ ЗАПИСИ АДМИНИСТРАТОРА ===`);
  console.log(`Пароль: ${passwordRaw}`);
  console.log(`Хэш пароля: ${passwordHash.substring(0, 20)}...`);

  for (const email of emails) {
    const cleanEmail = email.toLowerCase().trim();
    
    // Check if user already exists
    const existing = await db.user.findFirst({
      where: { email: cleanEmail }
    });

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          role: 'OWNER',
          isActive: true,
          isDeleted: false,
          isEmailVerified: true
        }
      });
      console.log(`✅ Обновлен существующий пользователь: ${cleanEmail} -> Роль: OWNER`);
    } else {
      await db.user.create({
        data: {
          email: cleanEmail,
          passwordHash,
          role: 'OWNER',
          isActive: true,
          isDeleted: false,
          isEmailVerified: true,
          tenantId: 'smmplan'
        }
      });
      console.log(`✅ Создан новый администратор: ${cleanEmail} -> Роль: OWNER`);
    }
  }

  console.log('\nУспешно созданы учетные записи Владельца (OWNER)!');
}

main().finally(() => db.$disconnect());
