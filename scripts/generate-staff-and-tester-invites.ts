/**
 * scripts/generate-staff-and-tester-invites.ts
 *
 * Generates ready-to-send invitation packages with 1-click Magic Links and QA keys
 * for Administrators, Owners, and QA Testers.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { db } from '../src/lib/db';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  console.log('========================================================================');
  console.log('📦  ПАКЕТ СЕКРЕТНЫХ КЛЮЧЕЙ И ССЫЛОК ДЛЯ АДМИНИСТРАТОРОВ И ТЕСТИРОВЩИКОВ');
  console.log('========================================================================\n');

  // 1. Find Staff accounts
  const staffUsers = await db.user.findMany({
    where: {
      role: { in: ['OWNER', 'SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SUPPORT', 'DEVELOPER'] }
    },
    orderBy: { createdAt: 'asc' }
  });

  // Ensure at least one tester account exists
  let testerUser = await db.user.findFirst({
    where: { email: 'tester@smmplan.pro' }
  });

  if (!testerUser) {
    testerUser = await db.user.create({
      data: {
        email: 'tester@smmplan.pro',
        role: 'DEVELOPER',
        balance: BigInt(500000), // 5 000 RUB for testing
        isEmailVerified: true,
        tenantId: 'smmplan'
      }
    });
  }

  // 2. Generate Owner / Admin 1-Click Access Links
  const ownerUser = staffUsers.find(u => u.role === 'OWNER') || staffUsers[0];
  const rawOwnerToken = `owner_auth_${crypto.randomBytes(32).toString('hex')}`;
  const hashedOwnerToken = crypto.createHash('sha256').update(rawOwnerToken).digest('hex');
  const ownerExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  if (ownerUser) {
    await db.authToken.create({
      data: {
        userId: ownerUser.id,
        token: hashedOwnerToken,
        expiresAt: ownerExpiresAt,
        used: false,
      }
    });
  }

  // 3. Generate Tester 1-Click Access Link
  const rawTesterToken = `qa_tester_${crypto.randomBytes(32).toString('hex')}`;
  const hashedTesterToken = crypto.createHash('sha256').update(rawTesterToken).digest('hex');
  const testerExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.authToken.create({
    data: {
      userId: testerUser.id,
      token: hashedTesterToken,
      expiresAt: testerExpiresAt,
      used: false,
    }
  });

  const baseUrlLocal = 'http://localhost:3000';
  const baseUrlTunnel = 'https://test.smmplan.pro';

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('👑 1. ДЛЯ ВЛАДЕЛЬЦА И ГЛАВНОГО АДМИНИСТРАТОРА (Полный доступ к панели):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Email: ${ownerUser?.email}`);
  console.log(`Роль: ${ownerUser?.role}`);
  console.log(`Срок действия ссылки: 7 дней (до ${ownerExpiresAt.toLocaleDateString('ru-RU')})\n`);
  console.log(`🔗 Вход на тестовом домене (Cloudflare Tunnel):\n${baseUrlTunnel}/api/auth/verify?token=${rawOwnerToken}&tenant=smmplan&redirectTo=/admin/dashboard\n`);
  console.log(`🔗 Вход локально (localhost):\n${baseUrlLocal}/api/auth/verify?token=${rawOwnerToken}&tenant=smmplan&redirectTo=/admin/dashboard\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 2. ДЛЯ QA-ТЕСТИРОВЩИКОВ (Тестирование заказов, пульт и баг-репорты):');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Email: ${testerUser.email}`);
  console.log(`Тестовый баланс: 5 000.00 ₽ (для проверки заказов)`);
  console.log(`Срок действия ссылки: 7 дней\n`);
  console.log(`🔗 1-Клик Вход для тестировщика (открывает витрину с доступом к тестам):\n${baseUrlTunnel}/api/auth/verify?token=${rawTesterToken}&tenant=smmplan&redirectTo=/?smm_qa_key=omnismm_qa_tester_2026_pass\n`);
  console.log(`🔑 Прямой ключ активации QA Dock на витрине:\n${baseUrlTunnel}/?smm_qa_key=omnismm_qa_tester_2026_pass\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📱 3. ГОТОВЫЙ ШАБЛОН СООБЩЕНИЯ ДЛЯ ОТПРАВКИ В TELEGRAM / ПОЧТУ:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`--- [СКОПИРОВАТЬ ДЛЯ ТЕСТИРОВЩИКА] ---
Привет! Доступ к тестовому контуру платформы SMMplan / SMMflux готов:

1. Ссылка для входа в 1 клик:
${baseUrlTunnel}/api/auth/verify?token=${rawTesterToken}&tenant=smmplan&redirectTo=/?smm_qa_key=omnismm_qa_tester_2026_pass

2. Что доступно:
- Авторизованный аккаунт тестировщика с тестовым балансом 5 000 ₽.
- Секретный пульт QA Dock (кнопка в левом нижнем углу) для быстрого переключения между брендами SMMplan (API) и SMMflux (Aurora).
- Горячие клавиши Ctrl + Shift + B для отправки мгновенного баг-репорта разработчикам.

⚠️ Ссылка персональная и одноразовая.
--------------------------------------\n`);

  await db.$disconnect();
}

main().catch(console.error);
