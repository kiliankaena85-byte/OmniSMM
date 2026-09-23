/**
 * scripts/generate-owner-login-link.ts
 *
 * Generates an instant, cryptographically signed Magic Link for Owner / Admin login.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { db } from '../src/lib/db';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateLink() {
  const adminUser = await db.user.findFirst({
    where: { role: { in: ['OWNER', 'SUPER_ADMIN', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' }
  });

  if (!adminUser) {
    console.error('❌ Ни один пользователь с ролью OWNER / ADMIN не найден в БД.');
    process.exit(1);
  }

  // Generate 64-character secure token
  const rawToken = `owner_auth_${crypto.randomBytes(32).toString('hex')}`;
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.authToken.create({
    data: {
      userId: adminUser.id,
      token: hashedToken,
      expiresAt,
      used: false,
    }
  });

  const localLink = `http://localhost:3000/api/auth/verify?token=${rawToken}&tenant=smmplan&redirectTo=/admin/dashboard`;
  const tunnelLink = `https://test.smmplan.pro/api/auth/verify?token=${rawToken}&tenant=smmplan&redirectTo=/admin/dashboard`;

  console.log('\n========================================================================');
  console.log(`👑 МГНОВЕННАЯ ССЫЛКА ДЛЯ ВХОДА ВЛАДЕЛЬЦА (${adminUser.email}):`);
  console.log('========================================================================');
  console.log(`\n🔗 Локальный вход (localhost):\n${localLink}`);
  console.log(`\n🔗 Вход через Cloudflare Tunnel (test.smmplan.pro):\n${tunnelLink}\n`);
  console.log('========================================================================\n');

  await db.$disconnect();
}

generateLink().catch(console.error);
