import { db } from '../src/lib/db';
import { hashPassword } from '../src/lib/auth/password';

export const REAL_OWNERS = [
  {
    email: 'art@artmspektr.ru',
    role: 'OWNER',
    tenantId: 'smmplan',
    password: 'OwnerPassword2026!',
    description: 'Владелец платформы (OWNER — Артём)',
  },
  {
    email: 'nikita8888@list.ru',
    role: 'OWNER',
    tenantId: 'smmplan',
    password: 'OwnerPassword2026!',
    description: 'Владелец платформы (OWNER — Никита list.ru)',
  },
  {
    email: 'nikita8888@inbox.ru',
    role: 'OWNER',
    tenantId: 'smmplan',
    password: 'OwnerPassword2026!',
    description: 'Владелец платформы (OWNER — Никита inbox.ru)',
  },
];

export const TEST_ROLES = [
  {
    email: 'test-owner@smmplan.pro',
    role: 'OWNER',
    tenantId: 'smmplan',
    password: 'TestOwner2026!',
    description: 'Тестовый аккаунт Владельца (OWNER)',
  },
  {
    email: 'test-admin@smmplan.pro',
    role: 'ADMIN',
    tenantId: 'smmplan',
    password: 'TestAdmin2026!',
    description: 'Тестовый аккаунт Администратора (ADMIN)',
  },
  {
    email: 'test-manager@smmplan.pro',
    role: 'MANAGER',
    tenantId: 'smmplan',
    password: 'TestManager2026!',
    description: 'Тестовый аккаунт Менеджера (MANAGER)',
  },
  {
    email: 'test-operator@smmplan.pro',
    role: 'OPERATOR',
    tenantId: 'smmplan',
    password: 'TestOperator2026!',
    description: 'Тестовый аккаунт Оператора (OPERATOR)',
  },
  {
    email: 'test-support@smmplan.pro',
    role: 'SUPPORT',
    tenantId: 'smmplan',
    password: 'TestSupport2026!',
    description: 'Тестовый аккаунт Специалиста поддержки (SUPPORT)',
  },
  {
    email: 'test-user@smmplan.pro',
    role: 'USER',
    tenantId: 'smmplan',
    password: 'TestUser2026!',
    description: 'Тестовый Клиент SMMplan (USER)',
  },
  {
    email: 'test-user@smmflux.ru',
    role: 'USER',
    tenantId: 'flux',
    password: 'TestFlux2026!',
    description: 'Тестовый Клиент SMMflux (USER)',
  },
];

const PRESERVED_CLIENTS = ['clienttreederrrr@smmplan.pro'];

async function seedAccounts() {
  console.log('🧹 [1/3] Очистка лишних сотрудников и устаревших тестовых записей...');

  const allActiveAccounts = [...REAL_OWNERS, ...TEST_ROLES];
  const keepEmails = new Set([
    ...allActiveAccounts.map((a) => a.email.toLowerCase()),
    ...PRESERVED_CLIENTS.map((c) => c.toLowerCase()),
  ]);

  // Find all obsolete staff/test accounts
  const obsoleteUsers = await db.user.findMany({
    where: {
      email: { notIn: Array.from(keepEmails) },
      OR: [
        { role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'SUPPORT'] } },
        { email: { startsWith: 'owasp_' } },
        { email: { startsWith: 'collision_' } },
        { email: { startsWith: 'filter-test-' } },
        { email: { startsWith: 'test_ticket_' } },
        {
          email: {
            in: [
              'admin@smmplan.pro',
              'administrator@smmplan.pro',
              'manager@smmplan.pro',
              'operator@smmplan.pro',
              'support@smmplan.pro',
              'user@smmplan.pro',
              'user@smmflux.ru',
            ],
          },
        },
      ],
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`Найдено ${obsoleteUsers.length} устаревших записей для очистки.`);

  for (const user of obsoleteUsers) {
    try {
      await db.session.deleteMany({ where: { userId: user.id } });
      await db.authToken.deleteMany({ where: { userId: user.id } });
      await db.manualBalanceAdjustment.deleteMany({
        where: {
          OR: [{ userId: user.id }, { requestedBy: user.id }, { approvedBy: user.id }],
        },
      });
      await db.auditLog.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
      console.log(`  🗑️ Удален: ${user.email} (${user.role})`);
    } catch {
      await db.user.update({
        where: { id: user.id },
        data: { isDeleted: true, isActive: false, role: 'USER' },
      });
      console.log(`  ⚠️ Деактивирован (soft-delete): ${user.email}`);
    }
  }

  console.log('\n👑 [2/3] Настройка реальных Владельцев (OWNER):');
  for (const acc of REAL_OWNERS) {
    const passwordHash = await hashPassword(acc.password);
    const existing = await db.user.findFirst({
      where: {
        email: acc.email.toLowerCase(),
        tenantId: acc.tenantId,
      },
    });

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          role: 'OWNER',
          passwordHash,
          isActive: true,
          isDeleted: false,
          isEmailVerified: true,
          twoFactorEnabled: false,
        },
      });
      console.log(`  ✅ [ОБНОВЛЕН OWNER] ${acc.email} -> Пароль: ${acc.password}`);
    } else {
      await db.user.create({
        data: {
          email: acc.email.toLowerCase(),
          role: 'OWNER',
          tenantId: acc.tenantId,
          passwordHash,
          isActive: true,
          isDeleted: false,
          isEmailVerified: true,
          twoFactorEnabled: false,
          balance: BigInt(5000000), // 50 000.00 ₽
        },
      });
      console.log(`  ✨ [СОЗДАН OWNER] ${acc.email} -> Пароль: ${acc.password}`);
    }
  }

  console.log('\n🧪 [3/3] Настройка тестовых аккаунтов (по 1 на роль):');
  for (const acc of TEST_ROLES) {
    const passwordHash = await hashPassword(acc.password);
    const existing = await db.user.findFirst({
      where: {
        email: acc.email.toLowerCase(),
        tenantId: acc.tenantId,
      },
    });

    if (existing) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          role: acc.role,
          passwordHash,
          isActive: true,
          isDeleted: false,
          isEmailVerified: true,
          twoFactorEnabled: false,
        },
      });
      console.log(`  ✅ [ОБНОВЛЕН TEST] ${acc.email} (${acc.role}) -> Пароль: ${acc.password}`);
    } else {
      await db.user.create({
        data: {
          email: acc.email.toLowerCase(),
          role: acc.role,
          tenantId: acc.tenantId,
          passwordHash,
          isActive: true,
          isDeleted: false,
          isEmailVerified: true,
          twoFactorEnabled: false,
          balance: BigInt(1000000), // 10 000.00 ₽
        },
      });
      console.log(`  ✨ [СОЗДАН TEST] ${acc.email} (${acc.role}) -> Пароль: ${acc.password}`);
    }
  }

  // Client password sync
  const clientHash = await hashPassword('ClientPassword2026!');
  await db.user.updateMany({
    where: { email: 'clienttreederrrr@smmplan.pro' },
    data: {
      passwordHash: clientHash,
      isActive: true,
      isEmailVerified: true,
      role: 'USER',
    },
  });
  console.log('  ✅ [СОХРАНЕН КЛИЕНТ] clienttreederrrr@smmplan.pro (USER) -> Пароль: ClientPassword2026!');

  console.log('\n🎉 Все учетные записи успешно синхронизированы!');
}

seedAccounts()
  .catch((err) => {
    console.error('❌ Ошибка при инициализации аккаунтов:', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
