import crypto from 'crypto';
import { db } from '../src/lib/db';

async function main() {
  const superAdmin = await db.user.findFirst({
    where: { role: { in: ['OWNER', 'SUPER_ADMIN', 'ADMIN'] } },
    orderBy: { createdAt: 'asc' }
  });

  if (!superAdmin) {
    console.error('No admin found');
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours TTL

  await db.authToken.create({
    data: {
      userId: superAdmin.id,
      token: hashedToken,
      expiresAt,
      used: false
    }
  });

  console.log('VALID_MAGIC_LINK:', `https://test.smmplan.pro/api/auth/verify?token=${rawToken}&redirectTo=/admin/dashboard`);
  console.log('LOCAL_MAGIC_LINK:', `http://localhost:3000/api/auth/verify?token=${rawToken}&redirectTo=/admin/dashboard`);
  console.log('USER:', superAdmin.email, superAdmin.role);

  await db.$disconnect();
}

main().catch(console.error);
