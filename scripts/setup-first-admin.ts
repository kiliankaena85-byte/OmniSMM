#!/usr/bin/env tsx
/**
 * SMMplan / SMMflux — Первичная инициализация супер-администратора
 * 
 * Использование:
 *   npx tsx scripts/setup-first-admin.ts
 *   npx tsx scripts/setup-first-admin.ts --email admin@example.com --password StrongPassword123 --tenant all --role OWNER
 */

import { parseArgs } from 'util';
import readline from 'readline';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

async function main() {
  console.log('\n================================================================');
  console.log('👑 SMMplan / SMMflux: Мастер создания Администратора');
  console.log('================================================================\n');

  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      email: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string', default: 'OWNER' },
      tenant: { type: 'string', default: 'all' },
      balance: { type: 'string', default: '50000' },
    },
    allowPositionals: true,
  });

  let email = values.email;
  let password = values.password;
  let role = (values.role || 'OWNER').toUpperCase();
  let tenant = values.tenant || 'all';
  let balanceRub = parseInt(values.balance || '50000', 10);

  // Интерактивный режим при отсутствии флагов
  if (!email) {
    email = await askQuestion('📧 Введите Email администратора [admin@smmplan.pro]: ');
    if (!email) email = 'admin@smmplan.pro';
  }

  if (!password) {
    password = await askQuestion('🔑 Введите пароль (мин. 8 символов) [AdminPass2026!]: ');
    if (!password) password = 'AdminPass2026!';
  }

  if (password.length < 6) {
    console.error('❌ Ошибка: Пароль должен быть не короче 6 символов.');
    process.exit(1);
  }

  const allowedRoles = ['OWNER', 'ADMIN', 'SUPPORT', 'FINANCE', 'MARKETER'];
  if (!allowedRoles.includes(role)) {
    console.error(`❌ Ошибка: Недопустимая роль "${role}". Разрешены: ${allowedRoles.join(', ')}`);
    process.exit(1);
  }

  const tenantsToCreate = tenant === 'all' ? ['smmplan', 'flux'] : [tenant.toLowerCase()];
  const passwordHash = await hashPassword(password);
  const balanceKopecks = BigInt(Math.max(0, balanceRub) * 100);

  console.log('\n⏳ Создание администратора в базе данных...');

  for (const tId of tenantsToCreate) {
    const user = await prisma.user.upsert({
      where: {
        email_tenantId: {
          email: email.toLowerCase(),
          tenantId: tId,
        },
      },
      update: {
        role,
        passwordHash,
        balance: balanceKopecks,
        isBlocked: false,
      },
      create: {
        email: email.toLowerCase(),
        tenantId: tId,
        role,
        passwordHash,
        balance: balanceKopecks,
        isBlocked: false,
      },
    });

    console.log(`✅ [${tId.toUpperCase()}] Пользователь создан/обновлен: ID=${user.id}, Роль=${user.role}`);
  }

  console.log('\n================================================================');
  console.log('🎉 СУПЕР-АДМИНИСТРАТОР УСПЕШНО НАСТРОЕН:');
  console.log('================================================================');
  console.log(`📧 Email:    ${email.toLowerCase()}`);
  console.log(`🔑 Пароль:   ${password}`);
  console.log(`🛡️  Роль:     ${role}`);
  console.log(`💰 Баланс:   ${balanceRub.toLocaleString('ru-RU')} ₽`);
  console.log(`🌐 Тенанты:  ${tenantsToCreate.join(', ')}`);
  console.log('----------------------------------------------------------------');
  console.log('🚀 Панели управления для входа:');
  console.log('   • SMMplan: http://localhost:3000/login  ➔ /admin');
  console.log('   • SMMflux: http://localhost:3000/login  ➔ /admin (через сессию flux)');
  console.log('================================================================\n');
}

main()
  .catch((err) => {
    console.error('❌ Критическая ошибка при создании администратора:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
