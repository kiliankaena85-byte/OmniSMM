import crypto from 'crypto';
import { db } from '../src/lib/db';

async function main() {
  const superAdmin = await db.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!superAdmin) {
    console.error('No super admin user found');
    return;
  }

  const rawToken = `owner_magic_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

  await db.authToken.create({
    data: {
      userId: superAdmin.id,
      token: rawToken,
      expiresAt,
      used: false
    }
  });

  console.log('SUPER_ADMIN_LINK_LOCAL:', `http://localhost:3000/api/auth/verify?token=${rawToken}&redirect=/admin/dashboard`);
  console.log('SUPER_ADMIN_LINK_TUNNEL:', `https://test.smmplan.pro/api/auth/verify?token=${rawToken}&redirect=/admin/dashboard`);
  console.log('EMAIL:', superAdmin.email);

  await db.$disconnect();
}

main().catch(console.error);
