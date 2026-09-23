import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const db = new PrismaClient();

async function run() {
  const email = 'art@artmspektr.ru';
  let u = await db.user.findUnique({ where: { email } });
  
  if (!u) {
    u = await db.user.create({ data: { email, role: 'OWNER' } });
  } else {
    u = await db.user.update({ where: { email }, data: { role: 'OWNER' } });
  }
  
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  await db.authToken.create({
    data: {
      userId: u.id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    }
  });
  
  console.log('\n=== МАГИЧЕСКАЯ ССЫЛКА ДЛЯ art@artmspektr.ru ===');
  console.log(`http://localhost:3000/api/auth/verify?token=${token}`);
  console.log('====================================================\n');
}

run()
  .catch(console.error)
  .finally(() => db.$disconnect());
