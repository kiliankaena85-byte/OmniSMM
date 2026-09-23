import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function seedAdmin() {
  const email = 'admin@smmplan.pro';
  const tenantId = 'smmplan';
  const passwordHash = await hashPassword('admin12345');

  const admin = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email,
        tenantId,
      }
    },
    update: {
      role: 'OWNER',
      passwordHash,
      balance: BigInt(10000000), // 100,000.00 RUB
    },
    create: {
      email,
      role: 'OWNER',
      passwordHash,
      tenantId,
      balance: BigInt(10000000),
    }
  });

  console.log(`================================================================`);
  console.log(`✅ ТЕСТОВЫЙ АДМИНИСТРАТОР ГОТОВ ДЛЯ ВХОДА:`);
  console.log(`================================================================`);
  console.log(`URL входа: http://localhost:3000/login`);
  console.log(`Email:     ${admin.email}`);
  console.log(`Пароль:    admin12345`);
  console.log(`Роль:      ${admin.role}`);
  console.log(`Баланс:    100 000.00 ₽`);
  console.log(`================================================================\n`);
}

seedAdmin().catch(console.error).finally(() => prisma.$disconnect());
