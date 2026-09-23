import crypto from 'crypto';
import { db } from '../src/lib/db';

async function main() {
  const adminUser = await db.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' }
  });

  if (!adminUser) {
    console.error('No admin user found');
    return;
  }

  const rawToken = `owner_magic_${crypto.randomBytes(24).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

  await db.authToken.create({
    data: {
      userId: adminUser.id,
      token: rawToken,
      expiresAt,
      used: false
    }
  });

  console.log('MAGIC_LINK_LOCAL:', `http://localhost:3000/api/auth/verify?token=${rawToken}&redirect=/admin/dashboard`);
  console.log('MAGIC_LINK_TUNNEL:', `https://test.smmplan.pro/api/auth/verify?token=${rawToken}&redirect=/admin/dashboard`);
  console.log('ADMIN_EMAIL:', adminUser.email);
  console.log('ADMIN_ROLE:', adminUser.role);

  await db.$disconnect();
}

main().catch(console.error);
