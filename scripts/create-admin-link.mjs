import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

async function main() {
  const admin = await db.user.findFirst({
    where: { role: { in: ['ADMIN', 'OWNER'] } },
    select: { id: true, email: true, role: true },
  });

  if (!admin) {
    console.error('No admin user found. Run: npx prisma db seed');
    process.exit(1);
  }

  console.log('Found admin:', admin.email, '(role:', admin.role + ')');

  // Clean up old tokens for this user
  await db.authToken.deleteMany({ where: { userId: admin.id } });

  // Create fresh magic link
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000); // 4 hours

  await db.authToken.create({
    data: { token: hashedToken, userId: admin.id, expiresAt },
  });

  const link = `http://localhost:3000/api/auth/verify?token=${rawToken}`;
  console.log('\n=== ADMIN MAGIC LINK (valid 4h) ===');
  console.log(link);
  console.log('===================================\n');

  // Also create a test client user
  let client = await db.user.findFirst({ where: { role: 'USER' }, select: { id: true, email: true } });
  if (!client) {
    client = await db.user.create({
      data: { email: 'testclient@smmplan.test', role: 'USER', balance: 50000 },
    });
  }

  const rawToken2 = crypto.randomBytes(32).toString('hex');
  const hashed2 = crypto.createHash('sha256').update(rawToken2).digest('hex');
  const exp2 = new Date(Date.now() + 4 * 60 * 60 * 1000);
  await db.authToken.deleteMany({ where: { userId: client.id } });
  await db.authToken.create({ data: { token: hashed2, userId: client.id, expiresAt: exp2 } });

  const link2 = `http://localhost:3000/api/auth/verify?token=${rawToken2}`;
  console.log('=== CLIENT MAGIC LINK (valid 4h) ===');
  console.log('Client email:', client.email);
  console.log(link2);
  console.log('=====================================\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
